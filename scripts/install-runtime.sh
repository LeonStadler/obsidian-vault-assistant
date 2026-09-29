#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  printf 'Usage: %s RUNTIME_DIRECTORY\n' "$0" >&2
  exit 64
fi
plugin_dir="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$1"
if ! command -v npm >/dev/null 2>&1; then
  printf 'The MCP runtime requires installation or an update, but npm is missing from PATH. Install Node.js and restart the host.\n' >&2
  exit 69
fi
mkdir -p "$runtime_dir"
: > "$runtime_dir/.runtime-lock.json"
cp "$plugin_dir/package.json" "$plugin_dir/package-lock.json" "$runtime_dir/"
for attempt in 1 2 3; do
  if npm ci --prefix "$runtime_dir" --ignore-scripts --no-audit --no-fund >&2; then
    cp "$plugin_dir/package-lock.json" "$runtime_dir/.runtime-lock.json"
    exit 0
  else
    install_status="$?"
    printf '{"event":"runtime_install_failed","attempt":%s,"exitCode":%s}\n' "$attempt" "$install_status" >&2
  fi
done
exit "$install_status"
