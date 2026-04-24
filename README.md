# Vault Companion

Formerly known as Obsidian Vault Assistant.

Codex plugin for working with Obsidian vaults locally.

## What it does

- finds relevant context inside your vault
- enriches notes with structure, links, and durable knowledge
- creates reusable templates for recurring note types
- audits stale content, broken links, and structural drift
- uses the Obsidian Vault Filesystem MCP to read the vault locally

## Privacy

This plugin is designed to run locally. Vault content stays on your machine unless you explicitly connect other external services yourself.

## Trademark

This project is independent software and is not affiliated with, endorsed by, or sponsored by Obsidian or Dynalist Inc. "Obsidian" is used here only to describe compatibility.

## Includes

- `.codex-plugin/plugin.json` for the Codex manifest
- `skills/` for the core tasks
- `hooks.json` for skill routing
- `.mcp.json` for the vault filesystem MCP
- `docs/legal/` for privacy policy and terms
- `INSTALL.md` for setup instructions

## Installation

1. Clone the repository to `~/.codex/plugins/obsidian-vault-assistant`.
2. Add the plugin to `~/.agents/plugins/marketplace.json` using `marketplace.global.example.json`.
3. Restart Codex.
4. Enable `obsidian-vault-assistant` in the Marketplace.

## Notes

- This repository is meant to be shared as a GitHub plugin repo.
- The plugin is self-contained inside this folder.
- All work stays local unless you choose to connect additional tools.
