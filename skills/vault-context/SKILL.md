---
name: vault-context
description: Search an Obsidian vault for relevant context, summarize canonical facts, and cite the note paths that support the answer.
---

# Vault Context

Use this skill when the user asks what the vault already knows about a topic, project, person, process, or note cluster.

## Workflow

1. Search the vault for the most relevant notes first.
2. Prefer canonical hubs, reference notes, and current project notes.
3. Summarize only the facts that matter for the request.
4. Include file paths for each important source.
5. Flag uncertainty instead of guessing.

## Output

- short answer
- supporting note paths
- conflicts or missing context

## Do

- keep the answer concise
- mention what is already canonical
- preserve the user's terminology when possible

## Don't

- rewrite notes unless explicitly asked
- invent sources
- overfit to one temporary note if a stable note exists

