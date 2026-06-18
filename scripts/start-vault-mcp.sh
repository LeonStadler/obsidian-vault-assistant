#!/usr/bin/env bash
set -euo pipefail

plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
vault_path_file="$plugin_dir/.vault-path"

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

exec npx --cache /tmp/codex-npm-cache -y @modelcontextprotocol/server-filesystem "$vault_path"
