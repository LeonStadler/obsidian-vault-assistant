#!/bin/bash
set -euo pipefail
plugin_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
server_bundle="$plugin_dir/scripts/vault-mcp-server.bundle.mjs"
filesystem_bundle="$plugin_dir/scripts/filesystem-server.bundle.mjs"
if [ -f "$plugin_dir/runtime/bin/node" ]; then
  node_executable="$plugin_dir/runtime/bin/node"
  # Some MCPB extractors omit Unix execute bits. Restore only our packaged runtime.
  if [ ! -x "$node_executable" ]; then /bin/chmod u+x "$node_executable"; fi
else
  # Source/developer installation only. Distribution packages always include runtime/.
  if ! command -v node >/dev/null 2>&1; then
    printf 'Node.js is required for a source checkout. Install the packaged Obsidian Vault Assistant or use Node.js 18 or later for development.\n' >&2
    exit 69
  fi
  node_executable="$(command -v node)"
fi
node_major_version="$("$node_executable" -p 'process.versions.node.split(".")[0]')"
if [ "$node_major_version" -lt 18 ]; then
  printf 'Node.js 18 or later is required for development. Use a packaged installation or update your development runtime.\n' >&2
  exit 69
fi
if [ ! -f "$server_bundle" ] || [ ! -f "$filesystem_bundle" ]; then
  printf 'The packaged Vault MCP runtime is incomplete. Rebuild the development checkout or reinstall the plugin package.\n' >&2
  exit 70
fi
exec "$node_executable" "$server_bundle" "$@"
