---
name: vault-structure
description: Build or repair Obsidian vault structure, including hubs, folder notes, navigation links, naming consistency, and canonical note placement.
---

# Vault Structure

Use this skill when the vault needs better navigation, cleaner hierarchy, or repaired structure.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault reads and writes.

- inspect hubs, folder notes, and link targets through MCP
- apply structural edits only after checking affected paths
- if MCP is unavailable, tell the user to run `scripts/install-local.sh "/absolute/path/to/Obsidian Vault"` and restart Codex

## Workflow

1. Identify the area that should become canonical.
2. Check existing hubs, folder notes, and linked entry points via `obsidianVaultFilesystem`.
3. Propose the smallest structural change that improves navigation.
4. Update links consistently if a note moves or is renamed.
5. Keep similar content together inside the same area.

## Output

- structure proposal
- affected folders and notes
- link migration notes

## Rules

- prefer stable hub notes for each area
- do not create duplicate canonical notes
- do not rename or move without link awareness
