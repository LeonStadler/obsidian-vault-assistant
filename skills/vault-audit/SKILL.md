---
name: vault-audit
description: Audit an Obsidian vault for stale content, broken links, duplicate notes, naming drift, and markdown rule violations.
---

# Vault Audit

Use this skill when the user wants the vault checked for quality, consistency, or drift.

## Workflow

1. Scan the requested area for likely problems.
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

