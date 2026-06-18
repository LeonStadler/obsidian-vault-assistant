---
name: vault-context
description: Search an Obsidian vault for relevant context, answer questions with cited evidence, or build a compact context pack for follow-up work.
---

# Vault Context

Use this skill when the user asks what the vault already knows, wants a compact context pack before edits, or needs evidence for a specific topic, project, person, process, or note cluster.

## MCP

Use the `obsidianVaultFilesystem` MCP server for all vault file access.

- read, list, search, and inspect files only inside the configured vault directory
- prefer MCP tools over shell commands for vault reads
- if MCP is unavailable, tell the user to run `scripts/install-local.sh "/absolute/path/to/Obsidian Vault"` and restart Codex

## Workflow

1. Use `obsidianVaultFilesystem` to search the vault for the most relevant notes first.
2. Prefer canonical hubs, reference notes, and current project notes.
3. For direct questions: summarize only the facts that matter and cite file paths.
4. For discovery requests: build a ranked context pack with the best sources and gaps.
5. Flag uncertainty instead of guessing.

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

## Don't

- rewrite notes unless explicitly asked
- invent sources
- overfit to one temporary note if a stable note exists
