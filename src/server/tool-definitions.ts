import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MAX_EDITABLE_NOTE_CHARS } from "../core/notes.js";
export const UI_RESOURCE_URI = "ui://obsidian-vault-assistant/vault-setup-v10.html";
const APP_ICON = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"><path d="M5 3.5h10a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V5A1.5 1.5 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.33"/><path d="M6.5 7h7m-7 3h7m-7 3h4" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/></svg>').toString("base64")}`;
const MAX_HANDOFF_NOTE_CHARS = 24000;

export const setupTools: Tool[] = [
  {
    name: "settings.read", title: "Vault-Einstellungen lesen",
    description: "Read the saved Vault exclusion paths for Codex settings.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: { type: "object", properties: { schema: { type: "object" }, values: { type: "object" }, layout: { type: "array", items: { type: "object" } } }, required: ["schema", "values"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "settings.update", title: "Vault-Einstellungen aktualisieren",
    description: "Update Vault exclusions and app preferences for hidden files and note editing.",
    inputSchema: { type: "object", properties: { configRevision: { type: "integer", minimum: 0 }, set: { type: "object", properties: { excludePaths: { type: "string" }, showHiddenFiles: { type: "boolean" }, allowNoteEditing: { type: "boolean" } }, additionalProperties: false, minProperties: 1 } }, required: ["set"], additionalProperties: false },
    outputSchema: { type: "object", properties: { values: { type: "object" } }, required: ["values"], additionalProperties: false },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "get_vault_status", title: "Vault-Verbindung prüfen",
    description: "Check the saved Vault connection without opening a UI or changing files. If status is ready, continue with Vault tools; otherwise open configure_vault.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "connect_vault", title: "Vault verbinden",
    description: "Confirm a selection returned by choose_vault and test local read/write access before saving. Omit selectionId only to update exclusions of the existing Vault, preserving its retrieval roots.",
    inputSchema: { type: "object", properties: { configRevision: { type: "integer", minimum: 0 }, selectionId: { type: "string", minLength: 1 }, excludePaths: { type: "array", items: { type: "string" } } }, required: ["excludePaths"], additionalProperties: false },
    annotations: { readOnlyHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ["app", "model"] } },
  },
  {
    name: "configure_vault",
    title: "Vault verwalten",
    description: "Open the Obsidian Vault Assistant setup UI inside this chat. This is the configure_vault tool for the obsidianVaultFilesystem MCP; do not use another Obsidian integration.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: {
      ui: { resourceUri: UI_RESOURCE_URI, prefersBorder: true },
      "openai/outputTemplate": UI_RESOURCE_URI,
    },
  },
  {
    name: "open_vault_context",
    title: "Obsidian",
    description: "Browse, edit, and read Markdown notes in the connected Obsidian Vault, or explicitly add a note to the active chat.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: {
      ui: { resourceUri: UI_RESOURCE_URI, prefersBorder: true },
      "openai/ui": { entrypoints: [{ type: "global" }] },
      "openai/outputTemplate": UI_RESOURCE_URI,
    },
    icons: [{ src: APP_ICON, mimeType: "image/svg+xml", sizes: ["20x20"] }],
  },
  {
    name: "open_vault_browser_tab",
    title: "Vault durchsuchen",
    description: "Open the Obsidian Vault browser as a tab in this Codex chat.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: {
      ui: { resourceUri: UI_RESOURCE_URI, prefersBorder: true },
      "openai/ui": { entrypoints: [{ type: "thread" }] },
      "openai/outputTemplate": UI_RESOURCE_URI,
    },
    icons: [{ src: APP_ICON, mimeType: "image/svg+xml", sizes: ["20x20"] }],
  },
  {
    name: "save_vault_note_from_app",
    title: "Vault-Notiz speichern",
    description: "Save an edited Markdown note from the Obsidian browser only if its current content still matches the version that was opened.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", minLength: 1, maxLength: 2048 },
        configRevision: { type: "integer", minimum: 0 },
        expectedContent: { type: "string", maxLength: MAX_EDITABLE_NOTE_CHARS },
        content: { type: "string", maxLength: MAX_EDITABLE_NOTE_CHARS },
      },
      required: ["path", "expectedContent", "content"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
  },
  {
    name: "list_vault_directory_for_app",
    title: "Vault-Ordner anzeigen",
    description: "List a connected Vault folder for the browser, hiding dotfiles by default while preserving all saved Vault scope restrictions.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", minLength: 1, maxLength: 4096 },
        showHidden: { type: "boolean" },
      },
      required: ["path"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
  },
  {
    name: "search_vault_entries_for_app",
    title: "Vault-Dateien und Ordner suchen",
    description: "Search file and folder names within the configured retrieval roots while enforcing exclusions, hidden-file preference, and symlink protections.",
    inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 256 } }, required: ["query"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
  },
  {
    name: "read_note_for_handoff",
    title: "Vault-Notiz für Chat öffnen",
    description: "Read one Markdown note within the configured Vault scope for an explicit user handoff. Enforced Vault exclusions and symlink protections apply.",
    inputSchema: { type: "object", properties: { path: { type: "string", minLength: 1, maxLength: 2048 } }, required: ["path"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
  },
  {
    name: "choose_vault",
    title: "Choose Obsidian Vault",
    description: "Wähle einen Vault im nativen macOS-Ordnerdialog. Die Auswahl wird erst mit connect_vault gespeichert.",
    _meta: { ui: { visibility: ["app", "model"] } },
    inputSchema: { type: "object", properties: { vaultPath: { type: "string" } }, additionalProperties: false },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "save_vault_scope",
    title: "Save Vault Retrieval Scope",
    description: "Save the selected Vault and its allowed retrieval folders locally. Does not create a global memory database or index.",
    inputSchema: {
      type: "object",
      properties: {
        configRevision: { type: "integer", minimum: 0 },
        retrievalRoots: { type: "array", items: { type: "string" }, minItems: 1 },
        excludePaths: { type: "array", items: { type: "string" } },
      },
      required: ["retrievalRoots", "excludePaths"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
];

