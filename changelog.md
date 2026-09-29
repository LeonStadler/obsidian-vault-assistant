# Changelog

## 0.5.3 — 2026-09-30

### Fixes

- `scripts/vault-scope.mjs` and `scripts/vault-mcp-server.mjs`: enforce saved retrieval roots and exclusions for direct and batch reads, writes, directory creation, moves, and metadata; reject relative paths and symlink escapes; prune excluded folders before directory listing, recursive tree traversal, and glob searches. Normalize configuration paths before validation and avoid caching failed filesystem connections.
- `ui/vault-setup.html`: initialize the MCP App before tool calls, disable concurrent actions, report unanswered requests, and preserve the configured form after tool errors.
- `scripts/configure-vault.sh`: reject absolute or missing retrieval folders before persisting configuration and create local configuration files with private permissions.
- `scripts/install-local.sh`: register the actual installation path, including custom `CODEX_HOME`, and exclude dependency directories from source copies.

### Chores

- `package.json`, `package-lock.json`, `scripts/install-runtime.sh`, `scripts/start-vault-mcp.sh`, and `.gitignore`: declare and lock runtime dependencies, share installation logic with three explicit attempts, disable dependency install scripts, and mark only successful runtime installations as ready. Add syntax and smoke-test commands and ignore local dependencies.
- `scripts/test-vault-mcp.py`: run stdio integration checks against an isolated temporary Vault and fresh locked runtime, covering filesystem operations, media, forbidden paths, filtered listings, symlink escapes, scope saves, and unconfigured setup. Bound response waits and clean up test processes and files.
- `.codex-plugin/plugin.json`, `package.json`, `package-lock.json`, `scripts/vault-mcp-server.mjs`, and `ui/vault-setup.html`: synchronize version `0.5.3` after validation.

### Docs

- `README.md`, `INSTALL.md`, `docs/legal/privacy-policy.md`, and `skills/vault-context/SKILL.md`: describe enforced exclusions, locked installation, isolated validation, and the distinction between local filesystem access and model-provider processing of tool results.

## 0.5.2 — 2026-09-10

### Fixes

- `scripts/start-vault-mcp.sh`: require `npm` only when the local filesystem runtime is missing, so GUI sessions with a restricted `PATH` can still start an already-installed MCP.
- `.codex-plugin/plugin.json`, `README.md`, and `scripts/vault-mcp-server.mjs`: bump the plugin and MCP proxy version to `0.5.2`.

## 0.5.1 — 2026-09-03

### Fixes

- `.codex-plugin/plugin.json`: make the starter prompt explicitly target `obsidianVaultFilesystem` and exclude unrelated Obsidian integrations and Computer Use.
- `scripts/vault-mcp-server.mjs`: clarify the setup tool metadata and initialization instructions so the host routes setup to this MCP App.
- `skills/vault-context/SKILL.md`, `skills/vault-audit/SKILL.md`, `skills/vault-enrichment/SKILL.md`, `skills/vault-structure/SKILL.md`, and `skills/vault-templates/SKILL.md`: require the bundled MCP for setup and prohibit unrelated UI integrations.

### Docs

- `README.md` and `INSTALL.md`: explain that the plugin details gear is host-managed and that the custom Vault picker opens from `configure_vault` in a chat.

## 0.5.0 — 2026-09-02

### Features

- `scripts/vault-mcp-server.mjs`: add a configuration-aware MCP proxy with `configure_vault`, `choose_vault`, and `save_vault_scope` tools; expose the filesystem tools only after a validated local Vault scope exists.
- `ui/vault-setup.html`: add an MCP Apps setup UI with a native macOS Vault picker, retrieval-root fields, exclusion fields, and local-save feedback.
- `scripts/start-vault-mcp.sh`: bootstrap the local MCP runtime automatically and start the UI-capable proxy without requiring pre-existing `.vault-path` files.
- `.codex-plugin/plugin.json`: add an interface starter prompt for opening the Vault setup UI and bump the plugin to `0.5.0`.

### Docs

- `README.md`, `INSTALL.md`, and the five Vault skills: make the in-Codex MCP App setup the primary configuration path and retain terminal setup only for non-UI clients.

### Chores

- `scripts/test-vault-mcp.py`: verify MCP App metadata, the setup resource, and the configuration tool alongside the filesystem smoke test.

## 0.4.0 — 2026-09-02

### Features

- `.codex-plugin/plugin.json` and `.mcp.json`: bundle the `obsidianVaultFilesystem` MCP definition with the plugin.
- `scripts/configure-vault.sh`: add macOS folder selection and local configuration of one Vault, multiple retrieval roots, and excluded paths; preserve explicit CLI overrides during dialog setup.
- `scripts/start-vault-mcp.sh`: require local Vault configuration, use the stable local configuration for cached plugin copies, and pass configured retrieval roots as the MCP filesystem sandbox.
- `scripts/test-vault-mcp.py`: exercise the bundled no-argument MCP startup when local configuration exists.
- `skills/vault-context/SKILL.md`: adds a bounded MCP retrieval workflow that derives targeted queries, ranks results, reads up to three sources by default, and expands to five only for concrete gaps.
- `skills/vault-enrichment/SKILL.md`, `skills/vault-structure/SKILL.md`, and `skills/vault-templates/SKILL.md`: require focused Vault Context discovery before writing or restructuring notes.
- `skills/vault-audit/SKILL.md`: scopes audits to the requested area unless the user explicitly requests a vault-wide audit.

### Docs

- `README.md` and `INSTALL.md`: document the bundled MCP, local Vault setup, retrieval scope, no-global-memory behavior, and Luna usage guidance.

### Chores

- `.gitignore`: ignores `.vault-config.json` alongside `.vault-path`.
- `.codex-plugin/plugin.json`: bumps the plugin to version `0.4.0` and updates the context starter prompt.

### Fixes

- `scripts/install-local.sh`: stops registering a global MCP entry, installs the local MCP runtime, and detects existing global `obsidianVaultFilesystem` entries without changing them.

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
