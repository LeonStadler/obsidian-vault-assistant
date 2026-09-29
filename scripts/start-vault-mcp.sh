#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
stable_plugin_dir="${CODEX_HOME:-$HOME/.codex}/plugins/obsidian-vault-assistant"
config_dir="${VAULT_MCP_CONFIG_DIR:-$stable_plugin_dir}"
mcp_server_dir="$config_dir/.mcp-server"
mcp_server_entry="$mcp_server_dir/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"

mkdir -p "$config_dir" "$mcp_server_dir"
if [ ! -f "$mcp_server_entry" ] || ! cmp -s "$plugin_dir/package-lock.json" "$mcp_server_dir/.runtime-lock.json"; then
  bash "$plugin_dir/scripts/install-runtime.sh" "$mcp_server_dir"
fi

export VAULT_MCP_CONFIG_DIR="$config_dir"
export VAULT_MCP_NODE_MODULES="$mcp_server_dir/node_modules"
export VAULT_MCP_FILESYSTEM_ENTRY="$mcp_server_entry"
exec node "$plugin_dir/scripts/vault-mcp-server.mjs"
