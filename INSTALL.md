# Installation

## Requirements

- Codex installed and running
- the plugin cloned to `~/.codex/plugins/obsidian-vault-assistant`
- a personal marketplace file at `~/.agents/plugins/marketplace.json`

## Steps

1. Clone this repository to `~/.codex/plugins/obsidian-vault-assistant`.
2. Add the entry from `marketplace.global.example.json` to `~/.agents/plugins/marketplace.json`.
3. Restart Codex.
4. Enable `obsidian-vault-assistant` in the Marketplace.

Example source path:

```json
"/Users/DEIN_USER/.codex/plugins/obsidian-vault-assistant"
```

## What stays local

- Vault content is read from your local machine.
- The MCP server reads only the directories you allow.
- Nothing is sent outside your machine unless you connect other services yourself.
