#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s [VAULT_PATH]\n' "$0"
  printf '       %s --select [--retrieval-root PATH]... [--exclude PATH]...\n' "$0"
}

plugin_dir="${PLUGIN_INSTALL_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
vault_path=""
select_vault=0
retrieval_roots=()
exclude_paths=(".obsidian" ".git" "Attachments" "Archive" "Archiv")
custom_roots=0
custom_excludes=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --select)
      select_vault=1
      shift
      ;;
    --retrieval-root)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        printf 'Missing value for --retrieval-root.\n' >&2
        usage >&2
        exit 64
      fi
      retrieval_roots+=("$2")
      custom_roots=1
      shift 2
      ;;
    --exclude)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        printf 'Missing value for --exclude.\n' >&2
        usage >&2
        exit 64
      fi
      if [ "$custom_excludes" -eq 0 ]; then
        exclude_paths=()
        custom_excludes=1
      fi
      exclude_paths+=("$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    -* )
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 64
      ;;
    *)
      if [ -n "$vault_path" ]; then
        printf 'Only one VAULT_PATH may be provided.\n' >&2
        usage >&2
        exit 64
      fi
      vault_path="$1"
      shift
      ;;
  esac
done

if [ "$select_vault" -eq 1 ] && [ -n "$vault_path" ]; then
  printf 'Use either --select or VAULT_PATH, not both.\n' >&2
  exit 64
fi

if [ "$select_vault" -eq 1 ] || [ -z "$vault_path" ]; then
  if [ "$(uname -s)" != "Darwin" ] || ! command -v osascript >/dev/null 2>&1; then
    if [ -z "$vault_path" ]; then
      printf 'A local folder dialog is only available on macOS. Pass VAULT_PATH explicitly.\n' >&2
      usage >&2
      exit 69
    fi
  else
    vault_path="$(osascript -e 'POSIX path of (choose folder with prompt "Select your Obsidian vault")')"
  fi
fi

if [ ! -d "$vault_path" ]; then
  printf 'Vault path does not exist or is not a directory: %s\n' "$vault_path" >&2
  exit 66
fi

vault_path="$(cd "$vault_path" && pwd -P)"

if [ "$(uname -s)" = "Darwin" ] && command -v osascript >/dev/null 2>&1 && [ "$select_vault" -eq 1 ]; then
  if [ "$custom_roots" -eq 0 ]; then
    roots_input="$(osascript -e 'text returned of (display dialog "Which relative vault folders should be searched? Use comma-separated paths; . means the whole vault." default answer "." with title "Vault retrieval scope")')"
    retrieval_roots=()
    while IFS= read -r root; do
      [ -n "$root" ] && retrieval_roots+=("$root")
    done < <(printf '%s' "$roots_input" | tr ',' '\n' | sed 's/^ *//;s/ *$//')
  fi

  if [ "$custom_excludes" -eq 0 ]; then
    excludes_input="$(osascript -e 'text returned of (display dialog "Which relative vault folders should be excluded? Use comma-separated paths." default answer ".obsidian, .git, Attachments, Archive, Archiv" with title "Vault exclusions")')"
    exclude_paths=()
    while IFS= read -r exclude; do
      [ -n "$exclude" ] && exclude_paths+=("$exclude")
    done < <(printf '%s' "$excludes_input" | tr ',' '\n' | sed 's/^ *//;s/ *$//')
  fi
fi

if [ "${#retrieval_roots[@]}" -eq 0 ]; then
  retrieval_roots=(".")
fi

mkdir -p "$plugin_dir"
CONFIG_ROOTS="$(printf '%s\n' "${retrieval_roots[@]}")" \
CONFIG_EXCLUDES="$(printf '%s\n' "${exclude_paths[@]}")" \
VAULT_PATH="$vault_path" PLUGIN_DIR="$plugin_dir" python3 - <<'PY'
import json
import os
from pathlib import Path

vault_path = Path(os.environ["VAULT_PATH"])
plugin_dir = Path(os.environ["PLUGIN_DIR"])
roots = [value.strip() for value in os.environ["CONFIG_ROOTS"].splitlines() if value.strip()]
excludes = [value.strip() for value in os.environ["CONFIG_EXCLUDES"].splitlines() if value.strip()]

for relative_path in roots + excludes:
    candidate = (vault_path / relative_path).resolve()
    try:
        candidate.relative_to(vault_path)
    except ValueError as error:
        raise SystemExit(f"Path must stay inside the selected vault: {relative_path}") from error

config = {
    "retrievalRoots": roots,
    "excludePaths": excludes,
}
(plugin_dir / ".vault-path").write_text(f"{vault_path}\n")
(plugin_dir / ".vault-config.json").write_text(json.dumps(config, indent=2) + "\n")
PY

chmod 600 "$plugin_dir/.vault-path" "$plugin_dir/.vault-config.json"
printf 'Configured Obsidian vault: %s\n' "$vault_path"
printf 'Retrieval roots: %s\n' "$(IFS=', '; printf '%s' "${retrieval_roots[*]}")"
printf 'Excluded paths: %s\n' "$(IFS=', '; printf '%s' "${exclude_paths[*]}")"
