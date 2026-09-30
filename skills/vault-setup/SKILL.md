---
name: vault-setup
description: Connect or repair the local Obsidian Vault Assistant connection in Codex.
---

# Connect the Obsidian Vault

Use only the `obsidianVaultFilesystem` MCP from this plugin for Vault setup.

1. Call `get_vault_status`.
2. If it returns `ready`, do not reopen setup unless the user asks to manage the Vault.
3. For `unconfigured`, `unavailable`, or `invalid`, call `configure_vault` to show the in-chat setup app.
4. Let the user choose the local Vault folder and confirm the displayed path. The picker selection is a draft until the user presses **Verbinden**.
5. The user may change relative excluded file or folder paths, one per line. The default exclusions for a new Vault are `.obsidian`, `.git`, and `.trash`. Preserve exclusions already saved for existing Vaults when updating access.
6. Report the connection result from the tool. If access or validation fails, keep the previous connection and show the actionable error.

Do not use another Obsidian integration, Computer Use, or open Obsidian to configure the plugin. Do not claim the Vault is ready unless `get_vault_status` reports `ready`.
