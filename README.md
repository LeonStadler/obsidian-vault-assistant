# Obsidian Vault Assistant

Codex plugin for working with Obsidian vaults locally.

Current version: `0.13.0`

## What it does

- finds relevant context inside your vault
- enriches notes with structure, links, and durable knowledge
- creates reusable templates for recurring note types
- audits stale content, broken links, and structural drift
- browses allowed Vault folders, reads and edits Markdown notes in Codex, and adds a note or selection to the current chat on request
- uses the `obsidianVaultFilesystem` MCP to read and write only the vault directory you configure

## Focused vault context

The plugin uses the configured Obsidian MCP as task-scoped context, not as a permanent copy of your vault.

For each request, it derives a small set of search terms, searches likely folders first, and reads the best matching project, hub, or reference notes. It starts with up to three sources and only expands to five when necessary. Unrelated notes are excluded from the context pack, and the agent names the source paths and any remaining gaps.

The assembled context stays below roughly 24,000 characters per request. Large notes are reduced to relevant sections. The plugin recommends Luna for ordinary retrieval and small edits; a stronger model is appropriate when a task requires broad synthesis or resolving substantial conflicts.

For project work, this means the agent follows the existing project folders, links, hubs, and templates in your vault instead of imposing a separate fixed structure.

## Privacy

The filesystem MCP runs locally and enforces the configured retrieval roots and exclusions. Note content returned to Codex enters the model context and may be processed by the configured model provider. The plugin does not independently upload or index your Vault.

## Trademark

This project is independent software and is not affiliated with, endorsed by, or sponsored by Obsidian or Dynalist Inc. "Obsidian" is used only to describe compatibility.

## Includes

- `plugin.json` for plugin onboarding and MCP registration, plus `.codex-plugin/plugin.json` for Codex local-plugin compatibility
- `skills/` for the core tasks
- `skills/project-documentation/` for repository-to-Vault project documentation routing
- `mcp.example.json` for Cursor and other MCP clients
- `scripts/install-local.sh` for local plugin and MCP setup
- `scripts/configure-vault.sh` as an optional terminal fallback for changing the local Vault and retrieval scope
- `scripts/vault-mcp-server.mjs`, `ui/vault-setup.html`, and `ui/vault-setup.js` for the in-Codex Vault browser and setup app
- `scripts/start-vault-mcp.sh` for MCP startup and local runtime bootstrapping
- `.agents/plugins/marketplace.json` for GitHub marketplace distribution
- `docs/legal/` for the privacy policy
- `INSTALL.md` for setup instructions

## Installation

GitHub marketplace:

```bash
codex plugin marketplace add LeonStadler/obsidian-vault-assistant
```

Install the plugin from the marketplace in Codex. The packaged onboarding skill checks the connection after install and opens the setup app only if the Vault is not ready. Choose the Vault folder, optionally edit exclusions, and click **Verbinden**. Starter prompts are **Vault verbinden**, **Wissen im Vault suchen**, and **Notiz ergänzen**.

Das optionale Obsidian-Plugin in `obsidian-plugin/` ergänzt die Befehle **Obsidian-Notiz an aktuellen Codex-Chat senden** und **Textauswahl an aktuellen Codex-Chat senden**. Baue es mit `npm run build:obsidian`. Kopiere danach `obsidian-plugin/manifest.json` und `obsidian-plugin/main.js` nach `<Vault>/.obsidian/plugins/obsidian-codex-bridge/` und aktiviere es in Obsidian. Die Befehle öffnen die Codex-Übergabeansicht. Prüfe dort Notiz oder Auswahl und klicke **In aktuellen Chat senden**, bevor der Inhalt übermittelt wird. Notizpfade werden über den vorhandenen Vault-MCP-Zugriff, die Ausschlüsse und Symlink-Prüfungen gelesen. Die Übergabe ist auf 6.000 Zeichen für Auswahlen und 24.000 Zeichen für Notizen begrenzt. Die bestehenden Vault-Skills führen weiterhin die gezielte Suche, Anreicherung und Schreibvorgänge aus.

Click **Obsidian** in Codex's sidebar to browse the configured retrieval folders and read or edit Markdown notes. The same browser is also available as the **Vault durchsuchen** thread tab through **Weitere Tools**. Use the inline search above the file list to find files and folders by name, case-insensitively; results show their relative path, and searching never reads note contents. Entries whose names start with a dot stay hidden by default. Change **Punktdateien anzeigen** in the browser's **Einstellungen** to show them. Vault exclusions remain enforced either way. The split-pane layout uses Codex's host colors and fonts with an Obsidian-style file tree, purple selection accent, and focused note editor. In the note pane, switch between **Markdown bearbeiten** and **Vorschau**. The preview renders CommonMark and Markdown extensions such as tables, fenced code blocks, and automatic links; raw HTML stays disabled and sanitized before display. Click **Änderungen speichern** to write an edit; a conflict check preserves the draft if the note changed since it was opened. Click **Als Kontext in aktuellen Chat übernehmen** to send the whole note, or select a passage in the editor or preview first to send only that passage. The browser uses the existing MCP path checks, so exclusions, retrieval roots, and symlink protections apply to reads and writes. Use **Vault verwalten** in the plugin settings to change folders or exclusions. On a new connection, the whole Vault is accessible except `.obsidian`, `.git`, and `.trash`; `Archive`, `Archiv`, and `Attachments` are not excluded by default. Existing exclusions remain unchanged until edited.

Open **Einstellungen** in the Obsidian browser to see the active Vault path, choose another Vault, show or hide dotfiles by default, and allow or block note editing. The inline search follows the same visibility preference and still respects allowed roots and exclusions. The editing switch is enforced by the MCP proxy for both the app editor and filesystem write tools. Existing installations default to dotfiles hidden and editing allowed, preserving their previous behavior. Changing the Vault preserves these app preferences and the current connection until the new folder passes validation.

The selected path and retrieval scope are stored locally on the Mac. The plugin does not independently upload Vault content, create a global index, or copy retrieved context into persistent memory. Tool results enter the active Codex conversation.

The plugin installs the filesystem MCP runtime on first use when needed. A terminal setup is only needed for Cursor, automation, or a host that cannot render MCP App UI.

Local install:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
scripts/install-local.sh
```

Restart Codex after installation and start a new task so the skills and bundled MCP are loaded.

To change the local Vault later, open the same setup prompt again. The terminal command remains available as a fallback:

```bash
scripts/configure-vault.sh --select
```

The configuration is stored locally in `.vault-path` and `.vault-config.json`; both files are ignored by Git.

For Cursor and manual setup, see `INSTALL.md`.

## Legal

- [Privacy Policy](docs/legal/privacy-policy.md)
- The code is licensed under [MIT](LICENSE)

## Notes

- This repository is meant to be shared as a GitHub Codex plugin repo.
- The plugin is self-contained inside this folder.
- Filesystem access is local; model processing follows your host and provider settings.
