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
- respect configured retrieval roots and exclusions while gathering context
- prefer subdirectory `search_files` scans on macOS if a full-vault search returns `EPERM`
- report concrete file paths and exact problems; do not delete or rewrite notes unless explicitly asked
- if the Vault is not configured, call `configure_vault` on `obsidianVaultFilesystem` so the user can select it in the MCP App UI; do not use `Md.obsidian Integration`, Computer Use, or open Obsidian for setup; if MCP remains unavailable, stop and explain that the Vault was not checked

## Workflow

1. Limit the audit to the requested area. Use targeted queries and folders; scan the whole vault only when the user explicitly requests a vault-wide audit.
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
