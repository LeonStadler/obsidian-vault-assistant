# Changelog

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
