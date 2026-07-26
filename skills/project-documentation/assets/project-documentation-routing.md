# Project Documentation Routing

This note controls how the Project Documentation skill classifies repositories and routes their documentation. Keep it specific to this vault. Add areas and signals instead of hard-coding them into the plugin.

```yaml
default_language: en
areas:
  - id: personal-projects
    vault_path: Side Projects
    project_kinds: [personal-project, open-source]
    signals:
      vault_hub: Side Projects.md
  - id: employer-internal
    vault_path: Organisation
    project_kinds: [employer-internal]
    signals:
      remote_owners: []
  - id: employer-clients
    vault_path: Organisation/Fulfillment
    project_kinds: [employer-client]
    signals:
      remote_owners: []
  - id: company-products
    vault_path: Company/Products
    project_kinds: [company-product]
    signals:
      remote_owners: []
  - id: company-clients
    vault_path: Company/Fulfillment
    project_kinds: [company-client]
    signals:
      remote_owners: []
  - id: freelance-clients
    vault_path: Work
    project_kinds: [freelance-client]
    signals:
      remote_owners: []
```

## Classification rules

- Combine evidence from repository metadata, remote ownership, source paths, existing vault links, and project documentation.
- A source path alone is insufficient to classify a repository.
- Existing canonical project notes override a newly inferred destination unless their facts conflict with current evidence.
- Ask before creating a category, project folder, or project note; ask whenever more than one area is plausible.
- Do not store credentials, personal data, or confidential raw content in routing rules.

## Project note model

Create a project hub first. Add only supported notes for Requirements and Vision, Technical Overview, Decisions, Status and Plan, and Design and Experience. Use the current project language; use English when no language is established.
