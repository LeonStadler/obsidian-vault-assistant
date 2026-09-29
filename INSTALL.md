# Installation

## Requirements

- Codex App, or another MCP-capable client such as Cursor
- Node.js with `npm`
- an existing Obsidian vault folder

## GitHub marketplace install

Add the GitHub marketplace to Codex:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

Install `obsidian-vault-assistant` from the marketplace. The marketplace provides the five skills, the bundled MCP definition, and the in-Codex Vault setup UI.

After installation, start a new task and select the first starter prompt. It calls `configure_vault` on this plugin's `obsidianVaultFilesystem` MCP. The MCP App opens the native macOS folder picker. After selecting the Vault, set the allowed retrieval folders and excluded folders in the same UI and click `Konfiguration speichern`.

The gear labelled `In MCP-Einstellungen einrichten` belongs to Codex's generic host settings and cannot be extended by a local plugin with a custom folder picker. Use the setup prompt in a chat for the plugin UI. The task must show `Obsidian Vault Assistant` and `obsidianVaultFilesystem`; do not continue if it instead invokes `Md.obsidian Integration` or Computer Use.

The UI flow stores `.vault-path` and `.vault-config.json` locally and does not create a global memory database or vector index. The filesystem runtime is installed automatically on first MCP startup when `npm` is available.

Terminal/automation fallback:

```bash
scripts/install-local.sh --select
```

Terminal/automation path:

```bash
scripts/install-local.sh "$HOME/Documents/Obsidian Vault"
```

The local setup also asks for retrieval folders and exclusions when using `--select`. This fallback is not required for the normal Codex UI flow.

## Local install from a clone

Clone the plugin and run the local installer with your vault path:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh --select
```

The installer:

- copies the plugin to `$HOME/.codex/plugins/obsidian-vault-assistant` when needed
- installs the filesystem MCP server into `.mcp-server/` when using the fallback installer
- writes the selected Vault path to `.vault-path`
- writes retrieval roots and exclusions to `.vault-config.json`
- configures the bundled `obsidianVaultFilesystem` MCP without a global `codex mcp add` entry
- registers the plugin in `$HOME/.agents/plugins/marketplace.json`

Restart Codex after installation, then enable `obsidian-vault-assistant` under `Local Plugins` and start a new task.

## Manual install

1. Clone this repository to `$HOME/.codex/plugins/obsidian-vault-assistant`.
2. Install the MCP server package:

```bash
mkdir -p .mcp-server
cp package.json package-lock.json .mcp-server/
npm ci --prefix .mcp-server --ignore-scripts
chmod +x "$HOME/.codex/plugins/obsidian-vault-assistant/scripts/start-vault-mcp.sh"
```

3. Configure the local Vault and retrieval scope:

```bash
"$HOME/.codex/plugins/obsidian-vault-assistant/scripts/configure-vault.sh" \
  "$HOME/Documents/Obsidian Vault"
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
6. Enable `obsidian-vault-assistant` in the Marketplace and start a new task.

## Cursor and other MCP clients

Use `mcp.example.json` as a template. Replace `YOUR_USER` with your account name or build the paths from `echo $HOME`. For Cursor, run the local setup first so `.vault-path` and `.vault-config.json` exist; Cursor does not use the Codex MCP App setup UI.

```json
{
  "mcpServers": {
    "obsidianVaultFilesystem": {
      "command": "bash",
      "args": [
        "/Users/YOUR_USER/.codex/plugins/obsidian-vault-assistant/scripts/start-vault-mcp.sh"
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

The Vault path is stored locally and the bundled MCP reads it when it starts. In Codex, `configure_vault` renders the setup UI and `choose_vault` opens the native macOS folder picker. `save_vault_scope` validates and persists the selected retrieval scope before the filesystem tools become available.

- `scripts/install-local.sh` installs the local runtime and writes `.vault-path` and `.vault-config.json`
- `scripts/configure-vault.sh --select` opens the macOS Vault and retrieval-scope setup again
- `scripts/start-vault-mcp.sh` bootstraps the local runtime and starts the configuration-aware MCP proxy; cached plugin copies use the stable local configuration
- `scripts/vault-mcp-server.mjs` exposes the setup tools, MCP Apps resource, and validated proxy to the filesystem MCP
- `ui/vault-setup.html` provides the in-Codex Vault and retrieval-scope form
- the filesystem MCP server is installed locally under `.mcp-server/`
- startup uses `node` directly instead of `npx`
- `retrievalRoots` and `excludePaths` are enforced by the MCP proxy for reads, writes, moves, and listings; recursive searches prune excluded folders before reading them. Symlink targets are checked against the same scope

The MCP is a retrieval transport, not a global memory database. Search results are loaded only for the current task. The agent does not create an automatic Memory note or a vector index.

The retrieval skills use targeted search terms, start with up to three sources, expand to five only for a concrete gap, reduce large notes to relevant sections, and keep the assembled context below roughly 24,000 characters. Luna is recommended for ordinary Vault retrieval and small edits; switch to a stronger model for broad synthesis or unresolved conflicts.

MCP path rules:

- use absolute vault paths such as `$HOME/Documents/Obsidian Vault/...`
- relative paths resolve against the MCP process working directory, not the vault root
- on macOS, full-vault `search_files` scans may return `EPERM`; search a subdirectory instead

If MCP calls fail, use the setup starter prompt again. For clients without MCP App UI, rerun:

```bash
scripts/configure-vault.sh --select
```

Then restart the client.

## Local-only files

These files are created on your machine and must not be committed:

- `.mcp-server/`
- `.vault-path`
- `.vault-config.json`

## What stays local

- Vault content is read from your local machine.
- The MCP server reads only the configured retrieval roots.
- The MCP proxy denies access to configured exclusions, including direct requests and symlink aliases.
- Tool results sent to Codex become part of the model context and may be processed by the configured model provider. The plugin does not independently upload or index Vault contents.

## Validation

Run `npm run check` for JavaScript and shell syntax checks and `npm test` for the real stdio MCP smoke test. Tests create an isolated temporary Vault and configuration, install the locked runtime there, and remove it afterward. They exercise setup, reads, writes, moves, media, exclusions, scope changes, and symlink boundaries. They do not alter your selected Vault. The native folder picker and the rendered MCP App require verification in Codex.

Runtime versions are declared in `package.json` and resolved in `package-lock.json`. Startup uses `npm ci --ignore-scripts` when the runtime is absent or the lockfile changes. `VAULT_MCP_CONFIG_DIR` can explicitly select a separate configuration and runtime directory for tests or automation; normal startup uses the stable local plugin directory.
