# Obsidian Vault Assistant

Local Obsidian plugin with Vault tools, agent workflows, and an integrated viewer and Markdown editor.

Manifest version: `0.16.0`. The multi-host refactor on this branch is unreleased; version `0.18.0` is reserved until host acceptance.

The existing ChatGPT/Codex desktop integration remains the reference. Cursor, Claude Desktop and Claude Code packages share the same local Vault connection. Their actual acceptance status is documented in [Host compatibility](docs/host-compatibility.md).

## What it does

- finds relevant context inside your vault
- enriches notes with structure, links, and durable knowledge
- creates reusable templates for recurring note types
- audits stale content, broken links, and structural drift
- includes an Obsidian-style Vault viewer and Markdown editor directly in Codex, with folder navigation, rendered preview, and explicit note editing
- browses allowed Vault folders and adds a note or selection to the current chat on request
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
- `scripts/install-local.sh` for local development installs
- `scripts/build-vault-runtime.mjs` for building the self-contained MCP runtime shipped with the plugin
- `scripts/configure-vault.sh` as an optional terminal fallback for changing the local Vault and retrieval scope
- `scripts/vault-mcp-server.mjs`, `ui/vault-setup.html`, and `ui/vault-setup.js` for the in-Codex Vault browser and setup app
- `scripts/start-vault-mcp.sh` for starting the bundled MCP runtime without downloading packages
- `.agents/plugins/marketplace.json` for GitHub marketplace distribution
- `docs/legal/` for the privacy policy
- `INSTALL.md` for setup instructions

## Installation

See [INSTALL.md](INSTALL.md) for host-specific packages and local development. The generated macOS packages include their Node runtime; a source checkout still requires a development runtime. The existing Marketplace baseline is separate from these unpublished test packages.

Setup stages the selected folder and connects only after explicit confirmation. Cancellation and errors preserve the current connection. Updates preserve the shared configuration.

Das optionale Obsidian-Plugin in `obsidian-plugin/` ergänzt die Befehle **Obsidian-Notiz an aktuellen Codex-Chat senden** und **Textauswahl an aktuellen Codex-Chat senden**. Baue es mit `npm run build:obsidian`. Kopiere danach `obsidian-plugin/manifest.json` und `obsidian-plugin/main.js` nach `<Vault>/.obsidian/plugins/obsidian-codex-bridge/` und aktiviere es in Obsidian. Die Befehle öffnen die Codex-Übergabeansicht. Prüfe dort Notiz oder Auswahl und klicke **In aktuellen Chat senden**, bevor der Inhalt übermittelt wird. Notizpfade werden über den vorhandenen Vault-MCP-Zugriff, die Ausschlüsse und Symlink-Prüfungen gelesen. Die Übergabe ist auf 6.000 Zeichen für Auswahlen und 24.000 Zeichen für Notizen begrenzt. Die bestehenden Vault-Skills führen weiterhin die gezielte Suche, Anreicherung und Schreibvorgänge aus.

## Obsidian viewer and Markdown editor in Codex

The plugin includes an Obsidian-style Vault viewer and Markdown editor directly inside Codex. Click **Obsidian** in the sidebar to browse the configured Vault folders, open notes, and edit them without leaving Codex. You can also open the same viewer as a **Vault durchsuchen** tab through **Weitere Tools**.

The viewer has a file and folder pane beside the note. Its fonts, colors, spacing, and light/dark theme follow Codex host styles while keeping a focused Obsidian-like file tree and Markdown reading experience. Use the inline search to find names case-insensitively; results show their Vault-relative path, and the search does not scan note contents. Dotfiles are hidden by default; change **Punktdateien anzeigen** under **Einstellungen** to show them. Retrieval roots, exclusions, and symlink protections apply to browsing, searching, reading, and writing.

In the note pane, switch between **Markdown bearbeiten** and **Vorschau**. The preview renders CommonMark and Markdown extensions such as tables, fenced code blocks, and automatic links; raw HTML stays disabled and sanitized before display. Click **Änderungen speichern** to save an edit. If the note changed since it was opened, a conflict check preserves the draft. **Als Kontext in aktuellen Chat übernehmen** sends the whole note, or only a selected passage if you select text in the editor or preview first.

Use **Vault verwalten** in the plugin settings to change folders or exclusions. On a new connection, the whole Vault is accessible except `.obsidian`, `.git`, and `.trash`; `Archive`, `Archiv`, and `Attachments` are not excluded by default. Existing exclusions remain unchanged until edited.

Open **Einstellungen** in the Obsidian browser to see the active Vault path, choose another Vault, show or hide dotfiles by default, and allow or block note editing. The inline search follows the same visibility preference and still respects allowed roots and exclusions. The editing switch is enforced by the MCP proxy for both the app editor and filesystem write tools. Existing installations default to dotfiles hidden and editing allowed, preserving their previous behavior. Changing the Vault preserves these app preferences and the current connection until the new folder passes validation.

The selected path and retrieval scope are stored locally on the Mac. The plugin does not independently upload Vault content, create a global index, or copy retrieved context into persistent memory. Tool results enter the active Codex conversation.

For Cursor, automation, or another MCP host, see [INSTALL.md](INSTALL.md). Those advanced setup paths are separate from the Codex Marketplace installation.

Local developer install:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/.codex/plugins/obsidian-vault-assistant"
cd "$HOME/.codex/plugins/obsidian-vault-assistant"
npm ci
npm run check
scripts/install-local.sh
```

The local developer installer registers a source checkout in Codex. Restart the host and open a new task. Building from source requires Node/npm; regular generated packages do not require a separate runtime.

To change the local Vault later, open the same setup prompt again. The terminal command remains available as a fallback:

```bash
scripts/configure-vault.sh --select
```

The shared configuration is stored in `~/Library/Application Support/Obsidian Vault Assistant/.vault-config.json`. Existing Codex configuration is migrated without removing the original files. All hosts use the same access rules and preferences.

For Cursor and manual setup, see `INSTALL.md`.

## Legal

- [Privacy Policy](docs/legal/privacy-policy.md)
- The code is licensed under [MIT](LICENSE)

## Notes

- This repository builds OpenAI, Cursor, Claude Desktop, Claude Code and generic MCP packages from one source.
- Regular macOS packages contain the runtime; persistent configuration lives outside the package.
- Filesystem access is local; model processing follows your host and provider settings.

## Architecture and verification

See [Architecture](docs/architecture.md) for the shared typed core, config migration, write locks, and host adapters. [Host compatibility](docs/host-compatibility.md) separates protocol tests, package startup and actual host acceptance.
