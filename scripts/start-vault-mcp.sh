#!/usr/bin/env bash
set -euo pipefail

codex_home="${CODEX_HOME:-$HOME/.codex}"
config_dir="$codex_home/plugins/obsidian-vault-assistant"
vault_path_file="$config_dir/.vault-path"
npm_cache_dir="/tmp/codex-obsidian-vault-npm-cache"

if [ ! -f "$vault_path_file" ]; then
  plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
  fallback_vault_path_file="$plugin_dir/.vault-path"
  if [ -f "$fallback_vault_path_file" ]; then
    vault_path_file="$fallback_vault_path_file"
  fi
fi

if [ ! -f "$vault_path_file" ]; then
  printf 'Vault path not configured. Run: scripts/install-local.sh "/absolute/path/to/Obsidian Vault"\n' >&2
  exit 78
fi

vault_path="$(tr -d '\n' < "$vault_path_file")"

if [ -z "$vault_path" ]; then
  printf 'Vault path file is empty: %s\n' "$vault_path_file" >&2
  exit 78
fi

if [ ! -d "$vault_path" ]; then
  printf 'Configured vault path does not exist: %s\n' "$vault_path" >&2
  exit 66
fi

mkdir -p "$npm_cache_dir"

exec npx --cache "$npm_cache_dir" -y @modelcontextprotocol/server-filesystem "$vault_path"
