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

Configure the vault path for the plugin MCP:

```bash
scripts/install-local.sh "/absolute/path/to/your/Obsidian Vault"
```

Restart Codex after installation, then enable `obsidian-vault-assistant`.

## Local install from a clone

Clone the plugin and run the local installer with your vault path:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git ~/.codex/plugins/obsidian-vault-assistant
cd ~/.codex/plugins/obsidian-vault-assistant
scripts/install-local.sh "/absolute/path/to/your/Obsidian Vault"
```

The installer:

- copies the plugin to `~/.codex/plugins/obsidian-vault-assistant` when needed
- writes the vault path to `~/.codex/plugins/obsidian-vault-assistant/.vault-path`
- registers the plugin in `~/.agents/plugins/marketplace.json`
- starts MCP access through `scripts/start-vault-mcp.sh`
- keeps the filesystem MCP limited to the vault path you provide

Restart Codex after installation, then enable `obsidian-vault-assistant` under `Local Plugins`.

## Manual install

1. Clone this repository to `~/.codex/plugins/obsidian-vault-assistant`.
2. Write your vault path:

```bash
printf '%s\n' "/absolute/path/to/your/Obsidian Vault" > ~/.codex/plugins/obsidian-vault-assistant/.vault-path
chmod +x ~/.codex/plugins/obsidian-vault-assistant/scripts/start-vault-mcp.sh
```

3. Add the entry from `marketplace.local.example.json` to `~/.agents/plugins/marketplace.json`.
4. Restart Codex.
5. Enable `obsidian-vault-assistant` in the Marketplace.

## Marketplace paths

Use the right marketplace path for your install type:

| Install type                          | Marketplace file                                | `source.path`                               |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| GitHub marketplace repo root          | `.agents/plugins/marketplace.json` in this repo | `./`                                        |
| Local clone under `~/.codex/plugins/` | `~/.agents/plugins/marketplace.json`            | `./.codex/plugins/obsidian-vault-assistant` |

`marketplace.local.example.json` shows the local-clone entry.

## MCP behavior

The plugin registers `obsidianVaultFilesystem` through `scripts/install-local.sh`.

- `codex mcp add` points to `scripts/start-vault-mcp.sh` with an absolute path
- the script reads `.vault-path` from `~/.codex/plugins/obsidian-vault-assistant`
- the filesystem MCP is scoped to that directory only
- the plugin manifest does not ship a relative MCP entry, because Codex cannot resolve it reliably from the plugin cache

If MCP calls fail, rerun:

```bash
scripts/install-local.sh "/absolute/path/to/your/Obsidian Vault"
```

Then restart Codex.

## What stays local

- Vault content is read from your local machine.
- The MCP server reads only the directory you register.
- Nothing is sent outside your machine unless you connect other services yourself.
