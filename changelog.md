# Changelog

## 0.5.0 — 2026-07-26

### Features

- 2026-07-26: new `skills/project-documentation/SKILL.md` classifies repositories from repository and vault evidence, routes them through a user-owned vault configuration, and maintains separate project notes for requirements, technology, decisions, planning, and design instead of a shared changelog
- 2026-07-26: new `skills/project-documentation/assets/project-documentation-routing.md` provides a portable routing-configuration starting point, while `skills/project-documentation/agents/openai.yaml` exposes the workflow in Codex

### Docs

- 2026-07-26: `README.md` and `INSTALL.md` document project documentation routing, the vault-root configuration note, classification safeguards, and the English fallback language
- 2026-07-26: `skills/vault-context/SKILL.md` and `skills/vault-enrichment/SKILL.md` direct repository-wide project documentation work to the dedicated orchestration skill

### Chores

- 2026-07-26: `.codex-plugin/plugin.json` and `README.md` bump the plugin to `0.5.0`

## 0.4.0 — 2026-07-09

### Features

- 2026-07-09: `.codex-plugin/plugin.json` now bundles `obsidianVaultFilesystem` via `mcpServers: "./.mcp.json"` so Codex can load the plugin MCP together with the skills
- 2026-07-09: new `.mcp.json` declares the bundled plugin MCP startup command for `scripts/start-vault-mcp.sh`

### Fixes

- 2026-07-09: `scripts/install-local.sh` now writes `.vault-path` and installs the local MCP runtime without registering a separate global `codex mcp` entry
- 2026-07-09: `scripts/start-vault-mcp.sh` now also supports `OBSIDIAN_VAULT_PATH` as a vault-path source for plugin-driven MCP startup
- 2026-07-09: `README.md` and `INSTALL.md` now document the integrated plugin-plus-MCP installation flow for GitHub marketplace and local installs

### Docs

- 2026-07-09: `README.md` explains that the plugin install brings the skills and bundled MCP definition together, while local setup only configures the user-specific vault path

### Chores

- 2026-07-09: version bumped to `0.4.0` to reflect the integrated bundled-MCP installation flow
## 0.3.2 — 2026-06-18

### Features

- vault path is now passed directly when registering the MCP server
- `mcp.example.json` replaces the old `.mcp.json` template

### Fixes

- `scripts/start-vault-mcp.sh`: starts the filesystem MCP via local `node` install instead of `npx`
- `scripts/install-local.sh`: registers `codex mcp add ... start-vault-mcp.sh "<vault path>"`
- `.codex-plugin/plugin.json`: English manifest text for marketplace-facing fields
- skills and `INSTALL.md`: document portable `$HOME` paths, MCP setup, and macOS `search_files` `EPERM` behavior
- docs and skills: replace personal example paths with `OWNER`, `YOUR_USER`, and `$HOME`

### Chores

- removed tracked `.mcp.json` template duplicate
- removed `marketplace.local.example.json`; manual marketplace entry is documented inline in `INSTALL.md`
- added `scripts/test-vault-mcp.py` smoke test for MCP tools
- documented local-only files: `.mcp-server/`

## 0.3.1 — 2026-06-18

### Fixes

- `.codex-plugin/plugin.json`: ungültiges `hooks.json`-Routing entfernt; Skills werden direkt über `skills/` geladen
- `hooks.json`: gelöscht, weil Codex `hooks` statt `routes` erwartet
- `scripts/start-vault-mcp.sh`: liest `.vault-path` aus dem stabilen Install-Pfad unter `~/.codex/plugins/obsidian-vault-assistant`
- `scripts/start-vault-mcp.sh`: eigener npm-Cache unter `/tmp/codex-obsidian-vault-npm-cache`
- MCP-Registrierung nur noch über `scripts/install-local.sh` mit absolutem Script-Pfad statt Plugin-`.mcp.json`

## 0.3.0 — 2026-06-18

### Features

- `scripts/start-vault-mcp.sh`: MCP-Wrapper liest den Vault-Pfad aus `.vault-path` statt aus einem unaufgelösten Platzhalter
- `scripts/install-local.sh`: schreibt `.vault-path`, setzt Script-Rechte und nutzt den Plugin-MCP statt `codex mcp add`
- `marketplace.local.example.json`: klares Beispiel für lokale Marketplace-Einträge
- `changelog.md`: Versionshistorie für das Plugin

### Fixes

- `.mcp.json`: nutzt jetzt `bash scripts/start-vault-mcp.sh` statt `${OBSIDIAN_VAULT_PATH}`
- `.codex-plugin/plugin.json`: toter `termsOfServiceURL` entfernt
- `INSTALL.md`: Marketplace-Pfade und MCP-Verhalten dokumentiert

### Chores

- `vault-search` entfernt und in `vault-context` zusammengeführt
- alle Skills erwähnen jetzt `obsidianVaultFilesystem`
- `.gitignore`: `.vault-path` ergänzt
- `marketplace.global.example.json` durch `marketplace.local.example.json` ersetzt

## 0.2.0 — 2026-04-26

### Features

- Plugin installierbar über GitHub- und lokale Marketplace-Einträge
- sechs Vault-Skills mit Hooks und Agent-Metadaten
- Privacy Policy und Installationsdoku

### Chores

- Legal-Docs auf MIT + Privacy Policy vereinfacht
- README-Sprache bereinigt

## 0.1.0 — 2026-04-16

### Features

- Erstes modulares Codex-Plugin für Obsidian-Vault-Arbeit
- Skills für Kontext, Anreicherung, Struktur, Vorlagen und Audit
