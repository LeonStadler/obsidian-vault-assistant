#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 0 ] && [ "$1" = "--help" ]; then
  printf 'Usage: %s [VAULT_PATH]\n' "$0"
  printf '       %s --select [--retrieval-root PATH]... [--exclude PATH]...\n' "$0"
  exit 0
fi

plugin_dir="${CODEX_HOME:-$HOME/.codex}/plugins/obsidian-vault-assistant"
marketplace_dir="$HOME/.agents/plugins"
marketplace_file="$marketplace_dir/marketplace.json"
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  printf 'npm was not found in PATH. Install Node.js first.\n' >&2
  exit 69
fi

mkdir -p "$plugin_dir" "$marketplace_dir"

if [ "$repo_dir" != "$plugin_dir" ]; then
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude '.vault-path' \
    --exclude '.vault-config.json' \
    --exclude '.mcp-server' \
    "$repo_dir/" \
    "$plugin_dir/"
fi

chmod +x "$plugin_dir/scripts/start-vault-mcp.sh"
chmod +x "$plugin_dir/scripts/configure-vault.sh"

if [ "$#" -eq 0 ]; then
  "$plugin_dir/scripts/configure-vault.sh" --select
else
  "$plugin_dir/scripts/configure-vault.sh" "$@"
fi

vault_path="$(tr -d '\n' < "$plugin_dir/.vault-path")"

mcp_server_dir="$plugin_dir/.mcp-server"
mkdir -p "$mcp_server_dir"
npm install --prefix "$mcp_server_dir" --no-save @modelcontextprotocol/server-filesystem

MARKETPLACE_FILE="$marketplace_file" python3 - <<'PY'
import json
import os
from pathlib import Path

path = Path(os.environ["MARKETPLACE_FILE"])
entry = {
    "name": "obsidian-vault-assistant",
    "source": {
        "source": "local",
        "path": "./.codex/plugins/obsidian-vault-assistant",
    },
    "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL",
    },
    "category": "Productivity",
}

if path.exists():
    data = json.loads(path.read_text())
else:
    data = {
        "name": "local-plugins",
        "interface": {"displayName": "Local Plugins"},
        "plugins": [],
    }

data.setdefault("name", "local-plugins")
data.setdefault("interface", {"displayName": "Local Plugins"})
data.setdefault("plugins", [])
data["plugins"] = [plugin for plugin in data["plugins"] if plugin.get("name") != entry["name"]]
data["plugins"].append(entry)
path.write_text(json.dumps(data, indent=2) + "\n")
PY

legacy_mcp_detected=0
if command -v codex >/dev/null 2>&1; then
  legacy_mcp_list="$(codex mcp list 2>/dev/null || true)"
  if printf '%s\n' "$legacy_mcp_list" | grep -q 'obsidianVaultFilesystem'; then
    legacy_mcp_detected=1
  fi
fi

printf 'Installed Obsidian Vault Assistant.\n'
printf 'Plugin: %s\n' "$plugin_dir"
printf 'Vault path: %s\n' "$vault_path"
printf 'Marketplace: %s\n' "$marketplace_file"
printf 'MCP: bundled via .mcp.json and configured locally\n'
if [ "$legacy_mcp_detected" -eq 1 ]; then
  printf 'Notice: an existing global obsidianVaultFilesystem entry was detected; it was not changed. Remove it manually after verifying the bundled MCP.\n'
fi
printf 'Restart Codex, then enable the plugin from Local Plugins and start a new task.\n'
