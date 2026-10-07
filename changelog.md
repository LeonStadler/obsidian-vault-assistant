# Changelog

## 0.13.0 — 2026-10-07

### Features

- `ui/vault-setup.html` and `ui/vault-setup.js`: move the dotfile visibility control out of the browser overview and into **Einstellungen**; add inline, case-insensitive filename and folder-name search with relative paths in results.
- `scripts/vault-mcp-server.mjs` and `scripts/vault-scope.mjs`: add app-only scoped name search that respects retrieval roots, exclusions, symlink checks, and the saved dotfile preference without searching note contents.
- `scripts/test-vault-mcp.py`: verify inline-search UI, filename and folder search, hidden-file preference behavior, and exclusions; integration suite passes 80 checks.

### Docs

- `README.md`: explain inline name search, search scope, and the settings location for dotfile visibility.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, `ui/vault-setup.js`, `ui/vault-setup.bundle.html`, `scripts/build-vault-ui.mjs`, and `scripts/vault-mcp-server.mjs`: synchronize version `0.13.0` and publish the refreshed UI under `vault-setup-v7.html`.

## 0.12.0 — 2026-10-07

### Features

- `ui/vault-setup.html` and `ui/vault-setup.js`: add an Obsidian-style settings panel to the browser with the active Vault path, a Vault-switch action, persistent dotfile visibility, and an editing permission toggle.
- `scripts/vault-mcp-server.mjs`: persist app preferences in the stable local Vault config, preserve them when changing Vaults or scope, apply the saved dotfile setting, and enforce disabled editing for app saves and filesystem write tools. Existing configs default to hidden dotfiles and editing enabled.
- `scripts/test-vault-mcp.py`: cover settings rendering, persisted hidden-file preferences, and denial of app and agent writes when editing is disabled; MCP integration coverage now has 76 checks.

### Docs

- `README.md`, `changelog.md`, and the Obsidian project notes `Obsidian Vault Assistant.md`, `Architektur.md`, and `Betrieb und Entwicklung.md`: document Vault settings, preference persistence, write protection, and current validation status.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, `scripts/vault-mcp-server.mjs`, and `ui/vault-setup.js`: synchronize plugin version to `0.12.0` and publish the UI under resource URI `vault-setup-v6.html`.

## 0.11.0 — 2026-10-07

### Features

- `ui/vault-setup.html`, `ui/vault-setup.js`, and new `ui/markdown-preview.js`: add Markdown editing and a rendered preview mode. The preview supports CommonMark and Markdown extensions such as tables, fenced code, and linkification; raw HTML is disabled and rendered output is sanitized. Context handoff can use a selection in either the editor or preview.
- `ui/vault-setup.bundle.html`: bundle the renderer and sanitizer locally without CDN dependencies.
- `scripts/vault-mcp-server.mjs`: publish the changed UI under `vault-setup-v5.html` so Codex can fetch the new view instead of reusing a cached resource.
- `scripts/test-vault-mcp.py`: verify the versioned resource URI and packaged Markdown editor/preview controls; the MCP integration suite now has 73 checks.

### Docs

- `README.md`: document editor/preview modes, supported Markdown rendering, and safe HTML handling.

### Chores

- `package.json` and `package-lock.json`: add exact versions of `markdown-it` and `dompurify`, and update `@modelcontextprotocol/sdk` to `1.32.1`. The SDK update resolves the high-severity issue reported for `1.30.0`; `npm audit` reports no vulnerabilities.
- `plugin.json`, `.codex-plugin/plugin.json`, and `ui/vault-setup.js`: synchronize plugin version to `0.11.0`.

## 0.10.0 — 2026-10-07

### Features

- `scripts/vault-mcp-server.mjs`: add an app-only directory-listing tool that hides dot-prefixed files and folders by default, while applying the existing Vault scope, exclusions, and symlink checks. The app can request hidden entries explicitly without bypassing saved restrictions.
- `ui/vault-setup.html`, `ui/vault-setup.js`, and `ui/vault-setup.bundle.html`: add the hidden-file toggle and refine the browser into an Obsidian-style split view with a file tree, purple selection treatment, host-aware colors and fonts, and a focused Markdown editor.
- `scripts/test-vault-mcp.py`: cover hidden entries in the default listing and their explicit display; the MCP integration suite now has 72 checks.

### Docs

- `README.md`: document default hidden-file behavior and the refreshed browser design.
- Obsidian project notes `Obsidian Vault Assistant.md`, `Architektur.md`, and `Betrieb und Entwicklung.md`: record version `0.10.0`, the new file-list behavior, and the current test and host-acceptance status.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, and `ui/vault-setup.js`: synchronize plugin version to `0.10.0`.

## 0.9.0 — 2026-10-07

### Features

- `ui/vault-setup.html` and `ui/vault-setup.js`: add an editable Markdown note view with explicit save, reload, and add-to-chat actions. A text selection is sent by itself; otherwise the full note is sent after the user clicks the action. Show the selected note path and action results.
- `scripts/vault-mcp-server.mjs`: add app-only `save_vault_note_from_app` with Vault scope, exclusion, symlink, size, and changed-on-disk checks; add the `Vault durchsuchen` thread entrypoint alongside the `Obsidian` sidebar entrypoint and supply app icons.
- `scripts/test-vault-mcp.py`: cover the thread entrypoint, app-only save tool, save/conflict behavior, and denied excluded or symlinked destinations. The MCP integration suite now has 69 checks.

### Docs

- `README.md`: explain note editing, safe saves, the thread tab, and explicit whole-note or selection context transfer.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, and `ui/vault-setup.js`: synchronize the plugin to version `0.9.0`.

## 0.8.0 — 2026-10-06

### Features

- `ui/vault-setup.html` and `ui/vault-setup.js`: turn the global Obsidian sidebar app into a Vault browser with accessible-root selection, folder navigation, breadcrumbs, a scoped Markdown reader, and visible errors for inaccessible folders. The separate setup flow remains available through Vault settings.
- `scripts/vault-mcp-server.mjs`: distinguish browser launches from setup launches in the initial result and describe the global app as a browser and note reader.
- `scripts/test-vault-mcp.py`: verify the browser controls and browser launch mode; existing MCP smoke cases continue to validate file listing, Markdown reading, exclusions, and symlink protection.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, `README.md`, and `ui/vault-setup.js`: bump to `0.8.0` for the Vault browser feature.

## 0.7.4 — 2026-10-06

### Fixes

- `scripts/vault-mcp-server.mjs` and `scripts/test-vault-mcp.py`: publish the repaired UI under a new `vault-setup-v3.html` resource URI so Codex cannot reuse the previous blank-screen app resource.
- `ui/vault-setup.js`, `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, and `README.md`: bump the patch version to `0.7.4` and synchronize plugin metadata.

## 0.7.3 — 2026-10-06

### Fixes

- `scripts/build-vault-ui.mjs`: insert the bundled UI with a replacement callback so `$&` inside the bundle cannot be interpreted by `String.replace` and corrupt the inline script. This fixes the Codex sidebar app's blank screen.
- `ui/vault-setup.js`, `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, and `README.md`: bump the patch version to `0.7.3` and synchronize plugin metadata.

## 0.7.2 — 2026-10-06

### Fixes

- `scripts/vault-mcp-server.mjs`: rename the global MCP App entrypoint from “Vault-Kontext übernehmen” to **“Obsidian”**, so Codex labels its sidebar entry with the product name.
- `scripts/test-vault-mcp.py`: verify that the global sidebar entrypoint keeps its registration and publishes the expected title.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, `README.md`, and `ui/vault-setup.js`: bump the patch version to `0.7.2` and synchronize plugin metadata.

## 0.7.1 — 2026-10-06

### Chores

- `scripts/vault-mcp-server.mjs` and `scripts/test-vault-mcp.py`: publish the current MCP App under the versioned resource URI `vault-setup-v2.html`.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, `README.md`, and `ui/vault-setup.js`: bump the patch version to `0.7.1` and synchronize plugin metadata.

## 0.7.0 — 2026-10-01

### Features

- `obsidian-plugin/manifest.json`, `obsidian-plugin/src/main.js`, `obsidian-plugin/main.js`, and `scripts/build-obsidian-plugin.mjs`: add a desktop Obsidian companion with commands to hand off the active Markdown note or current editor selection to the Codex Vault app. Selected text is bounded to 6,000 characters.
- `scripts/vault-mcp-server.mjs`: add the global `open_vault_context` MCP App entrypoint and `read_note_for_handoff`, which reads one relative Markdown path within the saved Vault scope and caps the handoff at 24,000 characters.
- `ui/vault-setup.html`, `ui/vault-setup.js`, and `ui/vault-setup.bundle.html`: add a reviewable handoff preview that sends note context to the active Codex conversation only after the user clicks the send action; retain the Vault setup and management flows.

### Fixes

- `ui/vault-setup.js`: keep non-status note-read results from resetting the setup view, avoid reprocessing the same deep link, and show the Vault repair action only when it can help.
- `scripts/test-vault-mcp.py`: verify the global handoff entrypoint, preview UI, in-scope Markdown reading, exclusion and symlink denial, and the unconfigured handoff state; the MCP integration suite now contains 59 checks.

### Docs

- `README.md` and `INSTALL.md`: document building and enabling the optional Obsidian companion, its commands, size limits, review step, and preserved agent-driven Vault search and writing behavior.

### Chores

- `package.json`, `package-lock.json`, `plugin.json`, `.codex-plugin/plugin.json`, and `ui/vault-setup.js`: synchronize the Codex plugin release to `0.7.0` and describe note handoff in the plugin metadata.

## 0.6.0 — 2026-09-30

### Features

- `plugin.json` and `mcp.json`: add the portable Agent Plugins manifest and bundled MCP configuration; register the Codex onboarding skill and three German starter prompts. Keep `.codex-plugin/plugin.json` and `.mcp.json` aligned as the Codex compatibility path.
- `skills/vault-setup/SKILL.md` and `skills/vault-setup/agents/openai.yaml`: add the post-install status check and guided setup workflow. Setup opens only for a missing or broken connection.
- `scripts/vault-mcp-server.mjs`: add non-mutating `get_vault_status`, staged `choose_vault`, confirmed `connect_vault`, atomic config persistence, temporary read/write probes, and the Codex settings read/update tools with a “Vault verwalten” action. Preserve prior roots and exclusions when reconnecting the same Vault.
- `ui/vault-setup.html`, `ui/vault-setup.js`, `ui/vault-setup.bundle.html`, and `scripts/build-vault-ui.mjs`: add the accessible German MCP App, native macOS folder selection, path review, optional relative exclusions, connection feedback, keyboard focus, host theme/font styling, and an offline local bundle.
- `scripts/configure-vault.sh`: use `.obsidian`, `.git`, and `.trash` as default exclusions for new Vaults; keep `Archive`, `Archiv`, and `Attachments` accessible by default.
- `skills/project-documentation/SKILL.md`, `skills/project-documentation/agents/openai.yaml`, and `skills/project-documentation/assets/project-documentation-routing.md`: retain the project documentation routing workflow from `main` on the feature branch.

### Fixes

- `scripts/install-local.sh`: stop opening a folder dialog during a no-argument install so Codex onboarding owns first-use setup; retain `--select` as an explicit terminal option.
- `scripts/vault-mcp-server.mjs` and `ui/vault-setup.js`: leave the active connection intact on picker cancellation or failed validation, retain existing scope on same-Vault reconnection, and re-enable controls after successful connection.
- `skills/vault-context/SKILL.md`, `skills/vault-enrichment/SKILL.md`, `skills/vault-audit/SKILL.md`, `skills/vault-structure/SKILL.md`, and `skills/vault-templates/SKILL.md`: check connection status before Vault file operations and describe the actual new default exclusions.

### Chores

- `package.json` and `package-lock.json`: pin `@modelcontextprotocol/ext-apps@1.7.5`, `@openai/mcp-extensions@0.1.0`, and compatible runtime/build dependencies; install production runtime dependencies with `npm ci --omit=dev --ignore-scripts`.
- `scripts/test-vault-mcp.py`: extend the real stdio integration run to cover settings registration, initial setup UI, status states, picker cancellation, staged connection, failed-connection preservation, default exclusions, read/write after connection, and config persistence across restart.

### Docs

- `README.md`, `INSTALL.md`, and `mcp.example.json`: document onboarding, Settings access, the new Vault defaults, local-only configuration, and terminal fallback.
- `Vault: Side Projects/Obsidian Vault Assistant/Obsidian Vault Assistant.md`, `Vault: Side Projects/Obsidian Vault Assistant/Architektur.md`, and `Vault: Side Projects/Obsidian Vault Assistant/Betrieb und Entwicklung.md`: update existing project notes with the 0.6.0 design, verified integration results, and outstanding Codex-host acceptance.
- `.codex-plugin/plugin.json`, `plugin.json`, `package.json`, `package-lock.json`, `README.md`, and `ui/vault-setup.js`: synchronize the version to `0.6.0` after validation.

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
