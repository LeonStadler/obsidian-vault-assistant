---
name: vault-audit
description: Audit an Obsidian vault for stale content, broken links, duplicate notes, naming drift, and markdown rule violations.
---

# Vault Audit

Use this skill when the user wants the vault checked for quality, consistency, or drift.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault reads.

- scan the requested area through MCP list and read tools
- report concrete file paths and exact problems
- do not delete or rewrite notes unless explicitly asked
- if MCP is unavailable, tell the user to run `scripts/install-local.sh "/absolute/path/to/Obsidian Vault"` and restart Codex

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
