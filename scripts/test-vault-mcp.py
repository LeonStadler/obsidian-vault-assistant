#!/usr/bin/env python3
"""Smoke-test all obsidianVaultFilesystem MCP tools via stdio JSON-RPC."""

from __future__ import annotations

import json
import base64
import os
import shutil
import subprocess
import sys
import tempfile
import selectors
import uuid
from pathlib import Path
from typing import Any


class McpClient:
    def __init__(self, command: list[str], environment: dict[str, str]) -> None:
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=environment,
        )
        self.request_id = 0

    def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }
        assert self.process.stdin is not None
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()

    def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self.request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params or {},
        }
        assert self.process.stdin is not None
        assert self.process.stdout is not None
        self.process.stdin.write(json.dumps(payload) + "\n")
        self.process.stdin.flush()

        while True:
            with selectors.DefaultSelector() as selector:
                selector.register(self.process.stdout, selectors.EVENT_READ)
                if not selector.select(timeout=30):
                    raise TimeoutError(f"MCP did not respond to {method} within 30 seconds")
            line = self.process.stdout.readline()
            if not line:
                stderr = self.process.stderr.read() if self.process.stderr else ""
                raise RuntimeError(f"MCP connection closed while waiting for {method}: {stderr}")
            message = json.loads(line)
            if message.get("id") == self.request_id:
                if "error" in message:
                    raise RuntimeError(f"{method} failed: {message['error']}")
                return message["result"]

    def close(self) -> str:
        if self.process.stdin:
            self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        stderr = self.process.stderr.read() if self.process.stderr else ""
        return stderr


def extract_text(result: dict[str, Any]) -> str:
    content = result.get("content", [])
    parts: list[str] = []
    for item in content:
        if item.get("type") == "text":
            parts.append(item.get("text", ""))
    return "\n".join(parts)


def is_success(name: str, detail: str) -> bool:
    lowered = detail.lower()
    if any(value in lowered for value in ["access denied", "error", "failed", "missing", "not configured"]):
        return False
    if name == "read_media_file" and detail == "skipped":
        return True
    return len(detail.strip()) > 0


def run_smoke(config_dir: Path) -> int:
    plugin_dir = Path(os.environ.get("PLUGIN_DIR", Path(__file__).resolve().parent.parent))
    start_script = plugin_dir / "scripts/start-vault-mcp.sh"
    vault = config_dir / "vault"
    vault.mkdir()
    archive = vault / "Archive"
    archive.mkdir()
    (archive / "private.md").write_text("EXCLUDED_CONTENT")
    (vault / "archive-alias").symlink_to(archive, target_is_directory=True)
    outside = config_dir / "outside"
    outside.mkdir()
    (outside / "private.md").write_text("OUTSIDE_CONTENT")
    (vault / "outside-alias").symlink_to(outside, target_is_directory=True)
    (config_dir / ".vault-path").write_text(str(vault) + "\n")
    (config_dir / ".vault-config.json").write_text(json.dumps({"retrievalRoots": ["."], "excludePaths": ["Archive"]}))
    environment = {**os.environ, "VAULT_MCP_CONFIG_DIR": str(config_dir)}
    client = McpClient(["bash", str(start_script)], environment)

    results: list[tuple[str, str]] = []
    test_dir_name = f".codex-mcp-test-{uuid.uuid4().hex[:8]}"
    test_file_name = "mcp-smoke-test.md"
    moved_file_name = "mcp-smoke-test-moved.md"
    cleanup_paths: list[Path] = []

    try:
        init = client.request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "vault-mcp-smoke-test", "version": "1.0.0"},
            },
        )
        results.append(("initialize", init.get("serverInfo", {}).get("name", "ok")))

        client.notify("notifications/initialized")

        tools = client.request("tools/list")
        tool_names = sorted(tool.get("name", "") for tool in tools.get("tools", []))
        results.append(("tools/list", ", ".join(tool_names)))

        setup_tool = next((tool for tool in tools.get("tools", []) if tool.get("name") == "configure_vault"), None)
        setup_meta = setup_tool.get("_meta", {}) if setup_tool else {}
        setup_uri = setup_meta.get("ui", {}).get("resourceUri", "")
        results.append(("configure_vault_ui", setup_uri if setup_uri else "missing UI resource metadata"))

        resources = client.request("resources/list").get("resources", [])
        resource_uri = resources[0].get("uri", "") if resources else ""
        resource = client.request("resources/read", {"uri": resource_uri}) if resource_uri else {}
        resource_content = resource.get("contents", [{}])[0]
        resource_ok = resource_content.get("mimeType") == "text/html;profile=mcp-app" and "Vault auswählen" in resource_content.get("text", "")
        results.append(("vault_setup_resource", "ok" if resource_ok else "missing MCP App resource"))

        config_state = client.request("tools/call", {"name": "configure_vault", "arguments": {}}).get("structuredContent", {})
        results.append(("configure_vault", "configured" if config_state.get("configured") else "not configured"))

        allowed = extract_text(client.request("tools/call", {"name": "list_allowed_directories", "arguments": {}}))
        vault_root = allowed.splitlines()[-1].strip()
        results.append(("list_allowed_directories", vault_root))

        test_dir = f"{vault_root}/{test_dir_name}"
        test_file = f"{test_dir}/{test_file_name}"
        moved_file = f"{test_dir}/{moved_file_name}"
        cleanup_paths.append(Path(test_dir))

        created = extract_text(
            client.request(
                "tools/call",
                {"name": "create_directory", "arguments": {"path": test_dir}},
            )
        )
        results.append(("create_directory", created.strip() or test_dir))

        written = extract_text(
            client.request(
                "tools/call",
                {
                    "name": "write_file",
                    "arguments": {
                        "path": test_file,
                        "content": "# MCP smoke test\n\nTemporary file for plugin validation.\n",
                    },
                },
            )
        )
        results.append(("write_file", written.strip() or "written"))

        read_text = extract_text(
            client.request(
                "tools/call",
                {"name": "read_text_file", "arguments": {"path": test_file}},
            )
        )
        results.append(("read_text_file", "ok" if "MCP smoke test" in read_text else read_text[:80]))

        read_file = extract_text(
            client.request(
                "tools/call",
                {"name": "read_file", "arguments": {"path": test_file}},
            )
        )
        results.append(("read_file", "ok" if "MCP smoke test" in read_file else read_file[:80]))

        read_multiple = extract_text(
            client.request(
                "tools/call",
                {"name": "read_multiple_files", "arguments": {"paths": [test_file]}},
            )
        )
        results.append(("read_multiple_files", "ok" if "MCP smoke test" in read_multiple else read_multiple[:80]))

        edited = extract_text(
            client.request(
                "tools/call",
                {
                    "name": "edit_file",
                    "arguments": {
                        "path": test_file,
                        "edits": [
                            {
                                "oldText": "Temporary file for plugin validation.",
                                "newText": "Edited by MCP smoke test.",
                            }
                        ],
                    },
                },
            )
        )
        results.append(("edit_file", edited.strip() or "edited"))

        listed = extract_text(
            client.request(
                "tools/call",
                {"name": "list_directory", "arguments": {"path": test_dir}},
            )
        )
        results.append(("list_directory", "ok" if test_file_name in listed else listed[:120]))

        listed_sizes = extract_text(
            client.request(
                "tools/call",
                {"name": "list_directory_with_sizes", "arguments": {"path": test_dir}},
            )
        )
        results.append(("list_directory_with_sizes", "ok" if test_file_name in listed_sizes else listed_sizes[:120]))

        file_info = extract_text(
            client.request(
                "tools/call",
                {"name": "get_file_info", "arguments": {"path": test_file}},
            )
        )
        results.append(("get_file_info", "ok" if test_file_name in file_info or "size" in file_info.lower() else file_info[:120]))

        tree = extract_text(
            client.request(
                "tools/call",
                {"name": "directory_tree", "arguments": {"path": test_dir}},
            )
        )
        results.append(("directory_tree", "ok" if test_file_name in tree else tree[:120]))

        search = extract_text(
            client.request(
                "tools/call",
                {
                    "name": "search_files",
                    "arguments": {"path": test_dir, "pattern": test_file_name},
                },
            )
        )
        results.append(("search_files", "ok" if moved_file_name in search or test_file_name in search else search[:120]))

        moved = extract_text(
            client.request(
                "tools/call",
                {
                    "name": "move_file",
                    "arguments": {
                        "source": test_file,
                        "destination": moved_file,
                    },
                },
            )
        )
        results.append(("move_file", moved.strip() or "moved"))

        image_path = Path(test_dir) / "smoke.png"
        image_path.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="))
        media = client.request("tools/call", {"name": "read_media_file", "arguments": {"path": str(image_path)}})
        results.append(("read_media_file", "ok" if any(item.get("type") == "image" for item in media.get("content", [])) else "failed"))

        for name, arguments in [
            ("read_text_file", {"path": str(archive / "private.md")}),
            ("read_multiple_files", {"paths": [moved_file, str(archive / "private.md")]}),
            ("write_file", {"path": str(archive / "new.md"), "content": "blocked"}),
            ("create_directory", {"path": str(archive / "new-folder" / "nested")}),
            ("move_file", {"source": moved_file, "destination": str(archive / "moved.md")}),
            ("read_text_file", {"path": str(vault / "archive-alias" / "private.md")}),
            ("read_text_file", {"path": str(vault / "outside-alias" / "private.md")}),
            ("read_text_file", {"path": "relative.md"}),
        ]:
            denied = client.request("tools/call", {"name": name, "arguments": arguments})
            results.append((f"scope_denies_{name}", "ok" if denied.get("isError") else "failed to deny access"))

        for name, arguments in [
            ("list_directory", {"path": str(vault)}),
            ("list_directory_with_sizes", {"path": str(vault), "sortBy": "size"}),
            ("directory_tree", {"path": str(vault)}),
            ("search_files", {"path": str(vault), "pattern": "**/*"}),
        ]:
            response = client.request("tools/call", {"name": name, "arguments": arguments})
            text = extract_text(response)
            hidden = all(value not in text for value in ["Archive", "archive-alias", "outside-alias", "private.md"])
            results.append((f"scope_filters_{name}", "ok" if hidden and not response.get("isError") else "failed to filter scope"))

        invalid = client.request("tools/call", {"name": "save_vault_scope", "arguments": {"retrievalRoots": ["../outside"], "excludePaths": []}})
        results.append(("reject_invalid_scope", "ok" if invalid.get("isError") else "failed"))
        state = client.request("tools/call", {"name": "configure_vault", "arguments": {}})
        results.append(("preserve_scope_after_invalid_save", "ok" if state.get("structuredContent", {}).get("excludePaths") == ["Archive"] else "failed"))
        saved = client.request("tools/call", {"name": "save_vault_scope", "arguments": {"retrievalRoots": [f" {test_dir_name} "], "excludePaths": [" Archive "]}})
        results.append(("save_trimmed_scope", "ok" if saved.get("structuredContent", {}).get("retrievalRoots") == [test_dir_name] else "failed"))
        outside_root = client.request("tools/call", {"name": "list_directory", "arguments": {"path": str(vault)}})
        results.append(("deny_outside_narrowed_root", "ok" if outside_root.get("isError") else "failed"))

        fresh = config_dir / "fresh"
        fresh.mkdir()
        (fresh / ".mcp-server").symlink_to(config_dir / ".mcp-server", target_is_directory=True)
        fresh_client = McpClient(["bash", str(start_script)], {**environment, "VAULT_MCP_CONFIG_DIR": str(fresh)})
        try:
            fresh_client.request("initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "fresh-vault-smoke", "version": "1.0.0"}})
            fresh_client.notify("notifications/initialized")
            fresh_tools = fresh_client.request("tools/list").get("tools", [])
            results.append(("unconfigured_setup_tools", "ok" if {tool["name"] for tool in fresh_tools} == {"configure_vault", "choose_vault", "save_vault_scope"} else "failed"))
            fresh_state = fresh_client.request("tools/call", {"name": "configure_vault", "arguments": {}})
            results.append(("unconfigured_setup_state", "ok" if fresh_state.get("structuredContent", {}).get("configured") is False else "failed"))
        finally:
            fresh_client.close()

        passed = 0
        failed = 0
        print("Vault MCP smoke test results:\n")
        for name, detail in results:
            status = "PASS" if is_success(name, detail) else "FAIL"
            if status == "PASS":
                passed += 1
            else:
                failed += 1
            print(f"[{status}] {name}: {detail}")

        print(f"\nSummary: {passed} passed, {failed} failed, {len(results)} total")
        return 0 if failed == 0 else 2
    finally:
        client.close()
        for path in cleanup_paths:
            if path.exists():
                shutil.rmtree(path)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="vault-mcp-smoke-") as directory:
        return run_smoke(Path(directory).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
