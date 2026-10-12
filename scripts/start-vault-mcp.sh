#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
server_bundle="$plugin_dir/scripts/vault-mcp-server.bundle.mjs"
filesystem_bundle="$plugin_dir/scripts/filesystem-server.bundle.mjs"
config_dir="${VAULT_MCP_CONFIG_DIR:-${CODEX_HOME:-$HOME/.codex}/plugins/obsidian-vault-assistant}"

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is required to run the Obsidian Vault Assistant. Install Node.js 18 or later, then restart Codex. No npm package installation is needed.\n' >&2
  exit 69
fi

node_major_version="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major_version" -lt 18 ]; then
  printf 'Node.js 18 or later is required to run the Obsidian Vault Assistant. Current version: %s.\n' "$(node --version)" >&2
  exit 69
fi

if [ ! -f "$server_bundle" ] || [ ! -f "$filesystem_bundle" ]; then
  printf 'The packaged Vault MCP runtime is incomplete. Reinstall the Obsidian Vault Assistant plugin.\n' >&2
  exit 70
fi

export VAULT_MCP_CONFIG_DIR="$config_dir"
exec node "$server_bundle"
