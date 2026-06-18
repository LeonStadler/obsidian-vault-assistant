---
name: vault-templates
description: Create and refine reusable Obsidian templates for hubs, projects, references, SOPs, and daily-note patterns.
---

# Vault Templates

Use this skill when the user wants a template for repeatable note types or wants an existing template improved.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault reads and writes.

- inspect existing templates and note patterns through MCP
- write new or updated template files only inside the configured vault
- if MCP is unavailable, tell the user to run `scripts/install-local.sh "/absolute/path/to/Obsidian Vault"` and restart Codex

## Workflow

1. Identify the note type and its purpose.
2. Read similar notes and existing templates via `obsidianVaultFilesystem`.
3. List the minimum sections the note must contain.
4. Add optional sections only when they provide real value.
5. Keep templates simple enough to reuse and aligned with vault conventions.

## Output

- template draft in Markdown
- short explanation of when to use it
- any required companion notes or links

## Good template targets

- hub notes
- reference notes
- project notes
- SOPs
- daily notes
