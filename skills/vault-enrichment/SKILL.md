---
name: vault-enrichment
description: Enrich existing Obsidian notes with durable context, internal links, structure, and corrections while preserving canonical vault patterns.
---

# Vault Enrichment

Use this skill when the user wants existing notes to become more useful, more complete, or more connected.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault reads and writes.

- call `list_allowed_directories` first when the allowed vault root is unclear
- use absolute vault paths such as `$HOME/Documents/Obsidian Vault/...`; relative paths resolve against the MCP process working directory, not the vault root
- write only the smallest meaningful change back to the vault
- if MCP is unavailable, rerun `scripts/install-local.sh "$HOME/Documents/Obsidian Vault"` and restart the client

## Workflow

1. Read the target note and nearby canonical notes via `obsidianVaultFilesystem`.
2. Add durable knowledge, not temporary chatter.
3. Insert internal links to hubs, references, and related projects.
4. Keep edits small and focused.
5. Preserve the note's current role unless a stronger canonical placement exists.

## Output

- edited note content or a change plan
- note paths used as context
- any link or structure improvements

## Prefer

- evergreen facts
- operational context
- stable terminology
- explicit links to canonical notes

## Avoid

- duplicating temporary diary material
- adding unrelated side topics
- moving content without a good reason
