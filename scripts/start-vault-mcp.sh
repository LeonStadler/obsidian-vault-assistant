#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
stable_plugin_dir="${CODEX_HOME:-$HOME/.codex}/plugins/obsidian-vault-assistant"
config_dir="$stable_plugin_dir"
mcp_server_dir="$config_dir/.mcp-server"
mcp_server_entry="$mcp_server_dir/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"

mkdir -p "$config_dir" "$mcp_server_dir"
if [ ! -f "$mcp_server_entry" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    printf 'MCP runtime is missing and npm was not found in PATH.\n' >&2
    exit 69
  fi
  npm install --prefix "$mcp_server_dir" --no-save --ignore-scripts @modelcontextprotocol/server-filesystem >&2
fi

export VAULT_MCP_CONFIG_DIR="$config_dir"
export VAULT_MCP_NODE_MODULES="$mcp_server_dir/node_modules"
export VAULT_MCP_FILESYSTEM_ENTRY="$mcp_server_entry"
exec node "$plugin_dir/scripts/vault-mcp-server.mjs"
