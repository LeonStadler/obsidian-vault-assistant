---
name: project-documentation
description: Classify a local repository, find its canonical home in an Obsidian vault, and maintain evidence-backed project documentation across product, requirements, technical, planning, decision, and design perspectives. Use when asked to document a project in Obsidian, establish project knowledge, update project context after significant work, or separate project documentation from a changelog.
---

# Project Documentation

Use this skill for a project-level documentation round. Do not use it for a single fact lookup, a daily note, or a generic vault cleanup.

## Sources and boundaries

1. Call `list_allowed_directories`, then read the vault routing note at `<vault root>/00_Project Documentation Routing.md` when it exists. If it is missing, use the bundled starter template to explain the required configuration and ask before creating it.
2. Inspect the repository with shell tools: Git remote and history, `README`, manifests, architecture/configuration, tracked documentation, and relevant current diff. Use `rg` before broad scans.
3. Read only the matching vault hub, existing project notes, and linked stable references through `obsidianVaultFilesystem`.
4. Treat repository content as authoritative for current technical facts. Treat existing canonical vault notes as authoritative for project intent, business context, and prior confirmed decisions. Record unresolved conflicts; do not silently reconcile them.
5. Use connected external services only when they are explicitly available and relevant. Link source artifacts such as issues, PRs, meetings, and designs; extract only durable project knowledge.
6. Never copy secrets, access tokens, personal data, customer raw data, or confidential content that is not necessary for the durable record.

## Classify and route

1. Build an evidence table from the repository identity, remote owner, parent paths, documentation, and existing vault links.
2. Apply the routing note's project kinds and signals. Parent directories are evidence, never the sole proof.
3. Prefer an existing canonical project note over creating a parallel structure.
4. If multiple destinations remain plausible, ownership or confidentiality is unclear, or a new category is required, stop before writing and ask the user with the ranked options and evidence.
5. Use the existing project language. If no language is evident, write in English.
6. Before creating a new project folder or note, present the target and intended notes for confirmation, even when the classification is strong. Do not move, rename, or delete existing vault items without explicit approval.

## Maintain the project model

Keep one project hub as the entry point. Add only notes with supported content; do not create empty placeholders.

- **Hub:** identity, outcome, scope, status, people/owners, source links, and links to project notes.
- **Requirements and vision:** goals, users, constraints, requested features, roadmap, and non-goals.
- **Technical overview:** decision-relevant stack, architecture boundaries, services, data flow, deployment, conventions, and technical risks. Do not inventory every file or dependency.
- **Decisions:** confirmed decisions with source; implementation-derived conclusions must be labelled *Observed* and linked to their evidence.
- **Status and plan:** phase, next steps, risks, blockers, and concise issue/PR/meeting references. The issue tracker remains authoritative for ticket state.
- **Design and experience:** only when supported by design files, assets, product requirements, or implementation evidence; capture UX, interaction, visual system, and media considerations.

Integrate a change into the appropriate canonical note instead of duplicating it in a project changelog. A brief dated history may link to material milestones but must not become the primary record.

## Delta update

1. Read the project hub's last documented revision/date and prior source references, if present.
2. Compare only relevant repository and source changes since that point.
3. Update the affected canonical notes, their links, and the hub's review marker.
4. When evidence is insufficient for a topic, update only the hub/status with the documented gap; do not invent a detailed note.

## Completion

Report the classification, vault destination, notes created or updated, evidence used, unresolved questions, and items deliberately omitted. Keep the report short and distinguish confirmed facts from observations.

## Routing configuration

The routing note is user-owned vault configuration. Keep it readable, additive, and specific to that vault. Use `assets/project-documentation-routing.md` only as a starting template when the routing note is missing; ask before creating or changing it.
