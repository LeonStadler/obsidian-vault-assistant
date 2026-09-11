# Obsidian Vault Assistant

Codex plugin for working with Obsidian vaults locally.

Current version: `0.5.2`

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

This plugin is designed to run locally. Vault content stays on your machine unless you explicitly connect other external services.

## Trademark

This project is independent software and is not affiliated with, endorsed by, or sponsored by Obsidian or Dynalist Inc. "Obsidian" is used only to describe compatibility.

## Includes

- `.codex-plugin/plugin.json` for the Codex manifest
- `skills/` for the core tasks
- `mcp.example.json` for Cursor and other MCP clients
- `scripts/install-local.sh` for local plugin and MCP setup
- `scripts/configure-vault.sh` as an optional terminal fallback for changing the local Vault and retrieval scope
- `scripts/vault-mcp-server.mjs` and `ui/vault-setup.html` for the in-Codex Vault setup UI
- `scripts/start-vault-mcp.sh` for MCP startup and local runtime bootstrapping
- `.agents/plugins/marketplace.json` for GitHub marketplace distribution
- `docs/legal/` for the privacy policy
- `INSTALL.md` for setup instructions

## Installation

GitHub marketplace:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

Install the plugin from the marketplace in Codex. The marketplace provides the five skills and the bundled MCP definition. Click the first starter prompt in a new task. It explicitly calls `configure_vault` on this plugin's `obsidianVaultFilesystem` MCP, which opens the native macOS folder picker and then lets you choose retrieval folders and exclusions in the conversation UI.

The gear on the plugin details page opens Codex's generic MCP connection settings. A local plugin manifest cannot insert its own folder picker into that host page. The Vault form is therefore opened by the MCP App after `configure_vault` is called in a chat. If a task shows `Md.obsidian Integration` or Computer Use, it used a different integration; stop that task and start the plugin's setup prompt again.

The selected path and retrieval scope are stored locally on the Mac. No Vault content is uploaded, indexed into a global database, or copied into persistent memory.

The plugin installs the filesystem MCP runtime on first use when needed. A terminal setup is only needed for Cursor, automation, or a host that cannot render MCP App UI.

Local install:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh --select
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
- All work stays local unless you choose to connect other tools.
