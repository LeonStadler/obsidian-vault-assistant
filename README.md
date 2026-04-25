# Obsidian Vault Assistant

Codex plugin for working with Obsidian vaults locally.

Current version: `0.2.0`

## What it does

- finds relevant context inside your vault
- enriches notes with structure, links, and durable knowledge
- creates reusable templates for recurring note types
- audits stale content, broken links, and structural drift
- uses a local filesystem MCP to read only the vault directory you configure

## Privacy

This plugin is designed to run locally. Vault content stays on your machine unless you explicitly connect other external services yourself.

## Trademark

This project is independent software and is not affiliated with, endorsed by, or sponsored by Obsidian or Dynalist Inc. "Obsidian" is used here only to describe compatibility.

## Includes

- `.codex-plugin/plugin.json` for the Codex manifest
- `skills/` for the core tasks
- `hooks.json` for skill routing
- `.mcp.json` for the vault filesystem MCP template
- `scripts/install-local.sh` for local plugin and MCP setup
- `.agents/plugins/marketplace.json` for GitHub marketplace distribution
- `docs/legal/` for privacy policy and terms
- `INSTALL.md` for setup instructions

## Installation

GitHub marketplace:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
codex mcp add obsidianVaultFilesystem -- npx --cache /tmp/codex-npm-cache -y @modelcontextprotocol/server-filesystem "/absolute/path/to/your/Obsidian Vault"
```

Local install:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git
cd obsidian-vault-assistant
scripts/install-local.sh "/absolute/path/to/your/Obsidian Vault"
```

Restart Codex and enable `obsidian-vault-assistant`.

For manual setup, see `INSTALL.md`.

## Legal

- [Privacy Policy](docs/legal/privacy-policy.md)
- The code is licensed under [MIT](LICENSE)

## Notes

- This repository is meant to be shared as a GitHub Codex plugin repo.
- The plugin is self-contained inside this folder.
- All work stays local unless you choose to connect additional tools.
