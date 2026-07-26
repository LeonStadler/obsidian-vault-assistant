# Obsidian Vault Assistant

Codex plugin for working with Obsidian vaults locally.

Current version: `0.5.0`

## What it does

- finds relevant context inside your vault
- enriches notes with structure, links, and durable knowledge
- creates reusable templates for recurring note types
- audits stale content, broken links, and structural drift
- classifies repositories and maintains structured project documentation across requirements, technology, planning, decisions, and design
- uses the `obsidianVaultFilesystem` MCP to read and write only the vault directory you configure

## Privacy

This plugin is designed to run locally. Vault content stays on your machine unless you explicitly connect other external services.

## Trademark

This project is independent software and is not affiliated with, endorsed by, or sponsored by Obsidian or Dynalist Inc. "Obsidian" is used only to describe compatibility.

## Includes

- `.codex-plugin/plugin.json` for the Codex manifest
- `.mcp.json` for the bundled Codex MCP definition
- `skills/` for the core tasks
- `mcp.example.json` for Cursor and other MCP clients
- `scripts/install-local.sh` for local plugin and MCP setup
- `scripts/start-vault-mcp.sh` for MCP startup with a local vault path
- `.agents/plugins/marketplace.json` for GitHub marketplace distribution
- `docs/legal/` for the privacy policy
- `INSTALL.md` for setup instructions

## Project documentation

Use the **Project Documentation** skill when a repository needs a durable project record rather than a shared changelog. It inspects the repository and existing vault knowledge, classifies the project from configurable evidence, and routes the result to the matching canonical vault area.

The skill reads `00_Project Documentation Routing.md` from the vault root. That user-owned note defines local organisations, project kinds, recognition signals, and destination paths. A starter template is bundled at `skills/project-documentation/assets/project-documentation-routing.md`; copy and adapt it only after reviewing your vault's structure.

The skill keeps a project hub and adds separate notes only where supported by evidence: requirements and vision, technical overview, decisions, status and plan, and design and experience. It preserves existing canonical notes, asks before creating new project structure, and defaults to English only when a project has no established language.

## Installation

### Install from the GitHub marketplace

In the Codex app, open **Plugins**, choose **Add plugin marketplace**, and enter:

| Field | Value |
| --- | --- |
| Source | `LeonStadler/obsidian-vault-assistant` |
| Git ref | `main` |
| Sparse paths | leave empty |

Then add the marketplace, install `obsidian-vault-assistant`, and restart Codex if the app asks you to reload plugins.

You can add the same marketplace from the Codex CLI:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

After installing the plugin, configure the local vault MCP once with your own vault path:

```bash
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh "$HOME/Documents/Obsidian Vault"
```

Replace `$HOME/Documents/Obsidian Vault` with the absolute path to your Obsidian vault.

The marketplace installs the Codex plugin, its skills, and the bundled MCP definition from `.mcp.json`. The local setup step remains necessary because each user keeps their Obsidian vault in a different directory, so `scripts/install-local.sh` writes that machine-specific path into `.vault-path` and installs the local filesystem MCP runtime under `.mcp-server/`.

### Install from a local clone

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh "$HOME/Documents/Obsidian Vault"
```

Restart Codex and enable `obsidian-vault-assistant`. After that, Codex will load the skills and the bundled `obsidianVaultFilesystem` MCP together from the plugin.

For Cursor and manual setup, see `INSTALL.md`.

## Legal

- [Privacy Policy](docs/legal/privacy-policy.md)
- The code is licensed under [MIT](LICENSE)

## Notes

- This repository is meant to be shared as a GitHub Codex plugin repo.
- The plugin is self-contained inside this folder.
- All work stays local unless you choose to connect other tools.
