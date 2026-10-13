#!/bin/bash
set -euo pipefail
plugin_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
if [ -f "$plugin_dir/runtime/bin/node" ]; then
  node_executable="$plugin_dir/runtime/bin/node"
  if [ ! -x "$node_executable" ]; then /bin/chmod u+x "$node_executable"; fi
else
  node_executable="$(command -v node)" || { printf 'Use a packaged installation or install Node.js for development.\n' >&2; exit 69; }
fi
exec "$node_executable" "$plugin_dir/scripts/configure-vault.bundle.mjs" "$@"
