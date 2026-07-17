# Installation

## Requirements

- Codex App or another MCP-capable client such as Cursor
- Node.js with `npm`
- an existing Obsidian vault folder

## GitHub marketplace install

Add the GitHub marketplace to Codex:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

Install `obsidian-vault-assistant` from that marketplace in the Codex app or with `codex plugin add` if you already know the marketplace name.

Then configure the local vault path for the bundled plugin MCP:

```bash
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh "$HOME/Documents/Obsidian Vault"
```

Restart Codex after setup, then enable or reinstall `obsidian-vault-assistant` so Codex reloads the bundled MCP.

## Local install from a clone

Clone the plugin and run the local installer with your vault path:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh "$HOME/Documents/Obsidian Vault"
```

The installer:

- copies the plugin to `$HOME/.codex/plugins/obsidian-vault-assistant` when needed
- writes the chosen vault path into `.vault-path`
- installs the filesystem MCP server into `.mcp-server/`
- registers the plugin in `$HOME/.agents/plugins/marketplace.json`

Restart Codex after installation, then enable `obsidian-vault-assistant` under `Local Plugins`. Codex reads the bundled MCP definition from `.mcp.json`.

## Manual install

1. Clone this repository to `$HOME/.codex/plugins/obsidian-vault-assistant`.
2. Install the MCP server package:

```bash
npm install --prefix "$HOME/.codex/plugins/obsidian-vault-assistant/.mcp-server" --no-save @modelcontextprotocol/server-filesystem
chmod +x "$HOME/.codex/plugins/obsidian-vault-assistant/scripts/start-vault-mcp.sh"
```

3. Write the vault path for the bundled plugin MCP:

```bash
printf '%s\n' "$HOME/Documents/Obsidian Vault" > \
  "$HOME/.codex/plugins/obsidian-vault-assistant/.vault-path"
```

4. Add this plugin entry to `$HOME/.agents/plugins/marketplace.json`:

```json
{
  "name": "local-plugins",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "obsidian-vault-assistant",
      "source": {
        "source": "local",
        "path": "./.codex/plugins/obsidian-vault-assistant"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

5. Restart Codex.
6. Enable `obsidian-vault-assistant` in the Marketplace.

## Cursor and other MCP clients

Use `mcp.example.json` as a template. Replace `YOUR_USER` with your account name or build the paths from `echo $HOME`.

```json
{
  "mcpServers": {
    "obsidianVaultFilesystem": {
      "command": "bash",
      "args": [
        "/Users/YOUR_USER/.codex/plugins/obsidian-vault-assistant/scripts/start-vault-mcp.sh",
        "/Users/YOUR_USER/Documents/Obsidian Vault"
      ]
    }
  }
}
```

For Cursor, merge that entry into `$HOME/.cursor/mcp.json`, then restart Cursor.

## Marketplace paths

Use the right marketplace path for your install type:

| Install type                              | Marketplace file                                | `source.path`                               |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| GitHub marketplace repo root              | `.agents/plugins/marketplace.json` in this repo | `./`                                        |
| Local clone under `$HOME/.codex/plugins/` | `$HOME/.agents/plugins/marketplace.json`        | `./.codex/plugins/obsidian-vault-assistant` |

The manual install section above shows the local-clone marketplace entry inline.

## MCP behavior

The plugin bundles the MCP definition in `.mcp.json`, and the vault path is configured locally via `.vault-path` or `OBSIDIAN_VAULT_PATH`.

- `.codex-plugin/plugin.json` points `mcpServers` at `.mcp.json`
- `.mcp.json` starts `./scripts/start-vault-mcp.sh`
- `scripts/install-local.sh` writes the selected vault path into `.vault-path`
- `scripts/start-vault-mcp.sh` reads the vault path from its first argument, `OBSIDIAN_VAULT_PATH`, or `.vault-path`
- the filesystem MCP server is installed locally under `.mcp-server/`
- startup uses `node` directly instead of `npx`

MCP path rules:

- use absolute vault paths such as `$HOME/Documents/Obsidian Vault/...`
- relative paths resolve against the MCP process working directory, not the vault root
- on macOS, full-vault `search_files` scans may return `EPERM`; search a subdirectory instead

If MCP calls fail, rerun:

```bash
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh "$HOME/Documents/Obsidian Vault"
```

Then restart the client.

## Local-only files

These files are created on your machine and must not be committed:

- `.vault-path`
- `.mcp-server/`

## What stays local

- Vault content is read from your local machine.
- The MCP server reads only the directory you register.
- Nothing is sent outside your machine unless you connect other services yourself.
