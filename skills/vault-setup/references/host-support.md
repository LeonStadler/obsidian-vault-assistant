# Host support

The Vault connection, retrieval roots, exclusions, and editing preference are shared by all local hosts. Check `get_vault_status` before the first file operation.

In hosts with MCP Apps, use `configure_vault` for setup. In a tool-only host, ask for the absolute Vault path and call `choose_vault` with `vaultPath` to stage it. Show the selected path, recognition warning, and exclusions. Call `connect_vault` only after explicit user confirmation. Never expand existing retrieval roots or exclusions automatically.

A missing UI does not prevent the search, context, enrichment, and writing workflows. OpenAI hosts retain their sidebar and settings entrypoints. Context handoff requires an advertised host capability and an explicit user action. Do not invent a current-chat route for a host that does not support it.
