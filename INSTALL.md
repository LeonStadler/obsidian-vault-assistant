# Installation

## Requirements

- Codex CLI and Codex App
- Node.js with `npx`
- an existing Obsidian vault folder

## GitHub marketplace install

Add the GitHub marketplace to Codex:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

Register the local filesystem MCP with your vault path:

```bash
codex mcp add obsidianVaultFilesystem -- npx --cache /tmp/codex-npm-cache -y @modelcontextprotocol/server-filesystem "/absolute/path/to/your/Obsidian Vault"
```

Restart Codex after installation, then enable `obsidian-vault-assistant`.

## Local install from a clone

Clone the plugin and run the local installer with your vault path:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git
cd obsidian-vault-assistant
scripts/install-local.sh "/absolute/path/to/your/Obsidian Vault"
```

The installer:

- copies the plugin to `~/.codex/plugins/obsidian-vault-assistant`
- creates `~/.agents/plugins/marketplace.json`
- registers `obsidianVaultFilesystem` with `codex mcp add`
- keeps the filesystem MCP limited to the vault path you provide

Restart Codex after installation, then enable `obsidian-vault-assistant` under `Local Plugins`.

## Manual install

1. Clone this repository to `~/.codex/plugins/obsidian-vault-assistant`.
2. Add the entry from `marketplace.global.example.json` to `~/.agents/plugins/marketplace.json`.
3. Register the MCP server:

```bash
codex mcp add obsidianVaultFilesystem -- npx --cache /tmp/codex-npm-cache -y @modelcontextprotocol/server-filesystem "/absolute/path/to/your/Obsidian Vault"
```

4. Restart Codex.
5. Enable `obsidian-vault-assistant` in the Marketplace.

## What stays local

- Vault content is read from your local machine.
- The MCP server reads only the directory you register.
- Nothing is sent outside your machine unless you connect other services yourself.
