---
name: vault-templates
description: Create and refine reusable Obsidian templates for hubs, projects, references, SOPs, and daily-note patterns.
---

# Vault Templates

Use this skill when the user wants a template for repeatable note types or wants an existing template improved.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault reads and writes.

- call `list_allowed_directories` first when the allowed vault root is unclear
- use absolute vault paths such as `$HOME/Documents/Obsidian Vault/...`; relative paths resolve against the MCP process working directory, not the vault root
- respect configured retrieval roots and exclusions while gathering context
- write new or updated template files only inside the configured vault
- before the first Vault file operation, call `get_vault_status` on `obsidianVaultFilesystem`; if it is not `ready`, call `configure_vault` so the user can select and connect a local Vault in the MCP App UI; do not use `Md.obsidian Integration`, Computer Use, or open Obsidian for setup; if MCP remains unavailable, stop and explain that the Vault was not checked

## Workflow

1. Identify the note type and its purpose.
2. Use the `vault-context` relevance workflow to read only similar notes and existing templates from the relevant area.
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
