#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  printf 'Usage: %s "/absolute/path/to/Obsidian Vault"\n' "$0" >&2
  exit 64
fi

vault_path="$1"
plugin_dir="${CODEX_HOME:-$HOME/.codex}/plugins/obsidian-vault-assistant"
marketplace_dir="$HOME/.agents/plugins"
marketplace_file="$marketplace_dir/marketplace.json"
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$vault_path" ]; then
  printf 'Vault path does not exist or is not a directory: %s\n' "$vault_path" >&2
  exit 66
fi

if ! command -v codex >/dev/null 2>&1; then
  printf 'Codex CLI was not found in PATH.\n' >&2
  exit 69
fi

if ! command -v npx >/dev/null 2>&1; then
  printf 'npx was not found in PATH. Install Node.js first.\n' >&2
  exit 69
fi

mkdir -p "$plugin_dir" "$marketplace_dir" /tmp/codex-npm-cache

if [ "$repo_dir" != "$plugin_dir" ]; then
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude '.vault-path' \
    "$repo_dir/" \
    "$plugin_dir/"
fi

printf '%s\n' "$vault_path" > "$plugin_dir/.vault-path"
chmod +x "$plugin_dir/scripts/start-vault-mcp.sh"

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

codex mcp remove obsidianVaultFilesystem >/dev/null 2>&1 || true
codex mcp add obsidianVaultFilesystem -- bash "$plugin_dir/scripts/start-vault-mcp.sh"

printf 'Installed Obsidian Vault Assistant.\n'
printf 'Plugin: %s\n' "$plugin_dir"
printf 'Vault path: %s\n' "$vault_path"
printf 'Marketplace: %s\n' "$marketplace_file"
printf 'MCP: obsidianVaultFilesystem via scripts/start-vault-mcp.sh\n'
printf 'Restart Codex, then enable the plugin from Local Plugins.\n'
