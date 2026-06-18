#!/usr/bin/env python3
"""Smoke-test all obsidianVaultFilesystem MCP tools via stdio JSON-RPC."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any


class McpClient:
    def __init__(self, command: list[str]) -> None:
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
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
    if "access denied" in lowered or "error" in lowered or "failed" in lowered:
        return False
    if name == "read_media_file" and detail == "skipped":
        return True
    return len(detail.strip()) > 0


def main() -> int:
    plugin_dir = Path(os.environ.get("PLUGIN_DIR", Path.home() / ".codex/plugins/obsidian-vault-assistant"))
    start_script = plugin_dir / "scripts/start-vault-mcp.sh"
    vault_path = os.environ.get("VAULT_PATH", "").strip()
    if not vault_path and (plugin_dir / ".vault-path").exists():
        vault_path = (plugin_dir / ".vault-path").read_text().strip()
    if not vault_path:
        print("Set VAULT_PATH or create .vault-path before running the smoke test.", file=sys.stderr)
        return 1
    if not start_script.exists():
        print(f"Missing start script: {start_script}", file=sys.stderr)
        return 1

    client = McpClient(["bash", str(start_script), vault_path])

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

        media_result = "skipped"
        icon_candidates = list(Path(vault_root).rglob("*.png"))
        if icon_candidates:
            icon_path = str(icon_candidates[0].relative_to(vault_root))
            media = extract_text(
                client.request(
                    "tools/call",
                    {"name": "read_media_file", "arguments": {"path": icon_path}},
                )
            )
            media_result = "ok" if "image" in media.lower() or "base64" in media.lower() else media[:80]
        results.append(("read_media_file", media_result))

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
                shutil.rmtree(path, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
