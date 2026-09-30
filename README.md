# Obsidian Vault Assistant

Codex plugin for working with Obsidian vaults locally.

Current version: `0.6.0`

## What it does

- finds relevant context inside your vault
- enriches notes with structure, links, and durable knowledge
- creates reusable templates for recurring note types
- audits stale content, broken links, and structural drift
- uses the `obsidianVaultFilesystem` MCP to read and write only the vault directory you configure

## Focused vault context

The plugin uses the configured Obsidian MCP as task-scoped context, not as a permanent copy of your vault.

For each request, it derives a small set of search terms, searches likely folders first, and reads the best matching project, hub, or reference notes. It starts with up to three sources and only expands to five when necessary. Unrelated notes are excluded from the context pack, and the agent names the source paths and any remaining gaps.

The assembled context stays below roughly 24,000 characters per request. Large notes are reduced to relevant sections. The plugin recommends Luna for ordinary retrieval and small edits; a stronger model is appropriate when a task requires broad synthesis or resolving substantial conflicts.

For project work, this means the agent follows the existing project folders, links, hubs, and templates in your vault instead of imposing a separate fixed structure.

## Privacy

The filesystem MCP runs locally and enforces the configured retrieval roots and exclusions. Note content returned to Codex enters the model context and may be processed by the configured model provider. The plugin does not independently upload or index your Vault.

## Trademark

This project is independent software and is not affiliated with, endorsed by, or sponsored by Obsidian or Dynalist Inc. "Obsidian" is used only to describe compatibility.

## Includes

- `plugin.json` for plugin onboarding and MCP registration, plus `.codex-plugin/plugin.json` for Codex local-plugin compatibility
- `skills/` for the core tasks
- `skills/project-documentation/` for repository-to-Vault project documentation routing
- `mcp.example.json` for Cursor and other MCP clients
- `scripts/install-local.sh` for local plugin and MCP setup
- `scripts/configure-vault.sh` as an optional terminal fallback for changing the local Vault and retrieval scope
- `scripts/vault-mcp-server.mjs`, `ui/vault-setup.html`, and `ui/vault-setup.js` for the in-Codex Vault setup app
- `scripts/start-vault-mcp.sh` for MCP startup and local runtime bootstrapping
- `.agents/plugins/marketplace.json` for GitHub marketplace distribution
- `docs/legal/` for the privacy policy
- `INSTALL.md` for setup instructions

## Installation

GitHub marketplace:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

Install the plugin from the marketplace in Codex. The packaged onboarding skill checks the connection after install and opens the setup app only if the Vault is not ready. Choose the Vault folder, optionally edit exclusions, and click **Verbinden**. Starter prompts are **Vault verbinden**, **Wissen im Vault suchen**, and **Notiz ergänzen**.

Use **Vault verwalten** in the plugin settings to reopen the same app and change folders or exclusions. On a new connection, the whole Vault is accessible except `.obsidian`, `.git`, and `.trash`; `Archive`, `Archiv`, and `Attachments` are not excluded by default. Existing exclusions remain unchanged until edited.

The selected path and retrieval scope are stored locally on the Mac. The plugin does not independently upload Vault content, create a global index, or copy retrieved context into persistent memory. Tool results enter the active Codex conversation.

The plugin installs the filesystem MCP runtime on first use when needed. A terminal setup is only needed for Cursor, automation, or a host that cannot render MCP App UI.

Local install:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh
```

Restart Codex after installation and start a new task so the skills and bundled MCP are loaded.

To change the local Vault later, open the same setup prompt again. The terminal command remains available as a fallback:

```bash
scripts/configure-vault.sh --select
```

The configuration is stored locally in `.vault-path` and `.vault-config.json`; both files are ignored by Git.

For Cursor and manual setup, see `INSTALL.md`.

## Legal

- [Privacy Policy](docs/legal/privacy-policy.md)
- The code is licensed under [MIT](LICENSE)

## Notes

- This repository is meant to be shared as a GitHub Codex plugin repo.
- The plugin is self-contained inside this folder.
- Filesystem access is local; model processing follows your host and provider settings.
