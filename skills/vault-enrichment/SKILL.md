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
- respect configured retrieval roots and exclusions while gathering context
- write only the smallest meaningful change back to the vault
- if the Vault is not configured, call `configure_vault` on `obsidianVaultFilesystem` so the user can select it in the MCP App UI; do not use `Md.obsidian Integration`, Computer Use, or open Obsidian for setup; if MCP remains unavailable, stop and explain that the Vault was not checked

## Workflow

1. Use the `vault-context` relevance workflow before editing: search with targeted terms and read only the target note plus the few canonical notes needed for the change.
2. Add durable knowledge, not temporary chatter.
3. Insert internal links to hubs, references, and related projects only when they are relevant to the target note.
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
