---
name: vault-audit
description: Audit an Obsidian vault for stale content, broken links, duplicate notes, naming drift, and markdown rule violations.
---

# Vault Audit

Use this skill when the user wants the vault checked for quality, consistency, or drift.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault reads.

- call `list_allowed_directories` first when the allowed vault root is unclear
- use absolute vault paths such as `$HOME/Documents/Obsidian Vault/...`; relative paths resolve against the MCP process working directory, not the vault root
- prefer subdirectory `search_files` scans on macOS if a full-vault search returns `EPERM`
- report concrete file paths and exact problems; do not delete or rewrite notes unless explicitly asked
- if MCP is unavailable, rerun `scripts/install-local.sh "$HOME/Documents/Obsidian Vault"` and restart the client

## Workflow

1. Scan the requested area for likely problems via `obsidianVaultFilesystem`.
2. Prioritize issues that affect navigation, correctness, or canonical ownership.
3. Separate real issues from stylistic preferences.
4. Report concrete file paths and exact problems.
5. Suggest fixes without making destructive changes by default.

## Output

- issue list sorted by importance
- affected file paths
- recommended fix for each issue

## Check for

- broken or stale links
- duplicate or overlapping notes
- outdated process docs
- naming inconsistencies
- markdown convention drift
