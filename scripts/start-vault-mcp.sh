#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
mcp_server_dir="$plugin_dir/.mcp-server"
mcp_server_entry="$mcp_server_dir/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"
vault_path=""

if [ "$#" -ge 1 ] && [ -n "$1" ]; then
  vault_path="$1"
else
  vault_path_file="$plugin_dir/.vault-path"
  if [ -f "$vault_path_file" ]; then
    vault_path="$(tr -d '\n' < "$vault_path_file")"
  fi
fi

if [ -z "$vault_path" ]; then
  printf 'Vault path missing. Pass it as the first argument or run: scripts/install-local.sh "$HOME/Documents/Obsidian Vault"\n' >&2
  exit 78
fi

if [ ! -d "$vault_path" ]; then
  printf 'Configured vault path does not exist: %s\n' "$vault_path" >&2
  exit 66
fi

if [ ! -f "$mcp_server_entry" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    printf 'MCP server is not installed and npm was not found. Run: scripts/install-local.sh "%s"\n' "$vault_path" >&2
    exit 69
  fi

  mkdir -p "$mcp_server_dir"
  npm install --prefix "$mcp_server_dir" --no-save @modelcontextprotocol/server-filesystem >/dev/null
fi

if [ ! -f "$mcp_server_entry" ]; then
  printf 'MCP server install failed. Run: scripts/install-local.sh "%s"\n' "$vault_path" >&2
  exit 70
fi

exec node "$mcp_server_entry" "$vault_path"
