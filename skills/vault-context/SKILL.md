---
name: vault-context
description: Search an Obsidian vault for relevant context, answer questions with cited evidence, or build a compact context pack for follow-up work.
---

# Vault Context

Use this skill for Vault-relevant requests about projects, people, decisions, processes, notes, or existing knowledge. Do not use it for general questions that do not need Vault context.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault file access.

- call `list_allowed_directories` first when the allowed vault root is unclear
- use absolute vault paths such as `$HOME/Documents/Obsidian Vault/...`; relative paths resolve against the MCP process working directory, not the vault root
- respect the configured retrieval roots and do not read outside them
- respect saved exclusions, including `.obsidian`, `.git`, and `.trash`; other Vault folders remain accessible unless explicitly excluded; accessing an excluded path requires the user to update the saved scope first
- prefer subdirectory `search_files` scans on macOS if a full-vault search returns `EPERM`
- before the first Vault file operation, call `get_vault_status` on `obsidianVaultFilesystem`; if it is not `ready`, call `configure_vault` so the user can select and connect a local Vault in the MCP App UI; do not use `Md.obsidian Integration`, Computer Use, or open Obsidian for setup
- if the MCP is unavailable after setup, stop the Vault workflow, explain that the Vault was not checked, and do not fabricate Vault context

## Workflow

1. Derive two to five precise search terms from the user's current goal, such as a project name, person, system, or decision.
2. Search only likely folders or targeted filenames first. Do not perform a full-vault scan unless the user explicitly asks for one.
3. Rank the results by direct relevance, recency when known, and canonical ownership. Prefer current project notes, hubs, and reference notes over temporary or duplicate material.
4. Read only the best matching notes needed to answer the request. Start with up to three sources; expand to five only when the first sources leave a concrete gap.
5. For large notes, retain only the relevant sections and nearby headings instead of carrying the full file into the context.
6. Keep the assembled context dynamic but below roughly 24,000 characters per request. Prefer fewer sources when the answer is already supported.
7. Build a compact context pack: relevant facts, decisions, open questions, and exact source paths. Exclude unrelated content even if it appeared in search.
8. For direct questions, summarize only the facts that matter, add a short `Sources:` line with the used note paths, and flag uncertainty instead of guessing.

For a repository-wide project context pack or a request to determine where project documentation belongs, use `project-documentation` instead. It adds repository classification and canonical project routing.

## Output

For questions:

- short answer
- supporting note paths
- conflicts or missing context

For discovery:

- best matching notes
- short evidence summary
- suggested next query if context is still incomplete

## Do

- keep the answer concise
- mention what is already canonical
- preserve the user's terminology when possible
- state when the available vault context is incomplete or conflicting
- keep project context scoped to the project or topic named in the request
- recommend Luna for ordinary retrieval and small edits; recommend a stronger model when synthesis exceeds the context budget or conflicts cannot be resolved

## Don't

- rewrite notes unless explicitly asked
- invent sources
- overfit to one temporary note if a stable note exists
- treat the entire vault as default chat context
- retain or repeat unrelated personal, project, or operational details
- create an automatic Memory note, vector index, or other persistent copy of the context
