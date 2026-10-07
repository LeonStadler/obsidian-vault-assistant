#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { readFile, writeFile, mkdir, stat, realpath, access, open, unlink, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scopedListing, validateScopedPath, resolveDestination } from "./vault-scope.mjs";

const nodeModulesDir = process.env.VAULT_MCP_NODE_MODULES;
const filesystemEntry = process.env.VAULT_MCP_FILESYSTEM_ENTRY;
const configDir = path.resolve(
  process.env.VAULT_MCP_CONFIG_DIR ||
    path.join(os.homedir(), ".codex", "plugins", "obsidian-vault-assistant"),
);

if (!nodeModulesDir || !filesystemEntry) {
  console.error("Vault MCP runtime paths are missing.");
  process.exit(69);
}

const sdkBase = path.join(nodeModulesDir, "@modelcontextprotocol", "sdk", "dist", "esm");
const { Server } = await import(pathToFileURL(path.join(sdkBase, "server", "index.js")).href);
const { Client } = await import(pathToFileURL(path.join(sdkBase, "client", "index.js")).href);
const { StdioClientTransport } = await import(
  pathToFileURL(path.join(sdkBase, "client", "stdio.js")).href,
);
const { StdioServerTransport } = await import(
  pathToFileURL(path.join(sdkBase, "server", "stdio.js")).href,
);
const {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} = await import(pathToFileURL(path.join(sdkBase, "types.js")).href);

const UI_RESOURCE_URI = "ui://obsidian-vault-assistant/vault-setup-v7.html";
const APP_ICON = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"><path d="M5 3.5h10a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V5A1.5 1.5 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.33"/><path d="M6.5 7h7m-7 3h7m-7 3h4" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/></svg>').toString("base64")}`;
const MAX_HANDOFF_NOTE_CHARS = 24000;
const MAX_EDITABLE_NOTE_CHARS = 200000;
const { minimatch } = await import(pathToFileURL(path.join(nodeModulesDir, "minimatch", "dist", "esm", "index.js")).href);
const DEFAULT_EXCLUDES = [".obsidian", ".git", ".trash"];
const DEFAULT_APP_PREFERENCES = { showHiddenFiles: false, allowNoteEditing: true };
const WRITE_TOOLS = new Set(["write_file", "edit_file", "create_directory", "move_file", "delete_file"]);
const executeFile = promisify(execFile);
const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const selections = new Map();
const setupUiPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui/vault-setup.bundle.html");
const setupUi = await readFile(setupUiPath, "utf8");

let filesystemClient = null;

function configPath(name) {
  return path.join(configDir, name);
}

function isInside(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

async function loadConfig() {
  let config;
  try {
    config = JSON.parse(await readFile(configPath(".vault-config.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await stat(configPath(".vault-path"));
      } catch (pathError) {
        if (pathError.code === "ENOENT") return null;
        throw pathError;
      }
      throw new Error("Die Vault-Konfiguration ist unvollständig. Bitte den Vault erneut verbinden.");
    }
    throw error;
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Ungültige Vault-Konfiguration.");
  // Existing installations keep their saved roots and exclusions unchanged.
  let vaultPath = config.vaultPath;
  if (vaultPath === undefined) {
    try {
      vaultPath = (await readFile(configPath(".vault-path"), "utf8")).trim();
    } catch (error) {
      if (error.code === "ENOENT") throw new Error("Die Vault-Konfiguration enthält keinen Vault-Pfad. Bitte den Vault erneut verbinden.");
      throw error;
    }
  }
  if (typeof vaultPath !== "string" || !path.isAbsolute(vaultPath)) throw new Error("Die Vault-Konfiguration enthält keinen absoluten Ordnerpfad.");
  return { vaultPath, config };
}

async function validateConfiguration(candidateVaultPath, candidateConfig) {
  const vaultPath = path.resolve(candidateVaultPath);
  const vaultStats = await stat(vaultPath);
  if (!vaultStats.isDirectory()) throw new Error(`Selected Vault is not a directory: ${vaultPath}`);

  const resolvedVaultPath = await realpath(vaultPath);
  const roots = Array.isArray(candidateConfig.retrievalRoots) ? candidateConfig.retrievalRoots.map((value) => typeof value === "string" ? value.trim() : value) : null;
  const excludes = Array.isArray(candidateConfig.excludePaths) ? candidateConfig.excludePaths.map((value) => typeof value === "string" ? value.trim() : value) : null;
  if (!Array.isArray(roots) || roots.length === 0 || !roots.every((value) => typeof value === "string" && value.trim())) {
    throw new Error("At least one retrieval folder is required.");
  }
  if (!Array.isArray(excludes) || !excludes.every((value) => typeof value === "string" && value.trim())) {
    throw new Error("Excluded folders must be a list of non-empty relative paths.");
  }

  for (const relativePath of [...roots, ...excludes]) {
    if (path.isAbsolute(relativePath)) throw new Error(`Path must be relative to the selected Vault: ${relativePath}`);
    if (/[*?\[\]{}]/u.test(relativePath)) throw new Error(`Bitte einen relativen Pfad ohne Glob-Muster eingeben: ${relativePath}`);
    const candidate = path.resolve(resolvedVaultPath, relativePath);
    if (!isInside(resolvedVaultPath, candidate)) throw new Error(`Path must stay inside the selected Vault: ${relativePath}`);
  }

  const resolvedRoots = [];
  for (const relativePath of roots) {
    const candidate = path.resolve(resolvedVaultPath, relativePath);
    const rootStats = await stat(candidate);
    if (!rootStats.isDirectory()) throw new Error(`Retrieval folder does not exist or is not a directory: ${relativePath}`);
    const resolvedRoot = await realpath(candidate);
    if (!isInside(resolvedVaultPath, resolvedRoot)) throw new Error(`Retrieval folder resolves outside the selected Vault: ${relativePath}`);
    resolvedRoots.push(resolvedRoot);
  }

  return {
    vaultPath: resolvedVaultPath,
    config: {
      retrievalRoots: roots.map((value) => value.trim()),
      excludePaths: excludes.map((value) => value.trim()),
    },
    resolvedRoots,
    resolvedExcludes: await Promise.all(excludes.map((excluded) => resolveDestination(path.resolve(resolvedVaultPath, excluded)))),
  };
}

async function saveConfiguration(validated) {
  let savedPreferences = DEFAULT_APP_PREFERENCES;
  try {
    const savedConfig = JSON.parse(await readFile(configPath(".vault-config.json"), "utf8"));
    savedPreferences = normalizeAppPreferences(savedConfig?.appPreferences);
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    // Reconnecting is also the repair path for a missing or malformed saved config.
  }
  const appPreferences = savedPreferences;
  await mkdir(configDir, { recursive: true });
  const temporary = configPath(`.vault-config-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify({ vaultPath: validated.vaultPath, ...validated.config, appPreferences }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, configPath(".vault-config.json"));
  } finally {
    try { await unlink(temporary); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function normalizeAppPreferences(candidate) {
  return {
    showHiddenFiles: typeof candidate?.showHiddenFiles === "boolean" ? candidate.showHiddenFiles : DEFAULT_APP_PREFERENCES.showHiddenFiles,
    allowNoteEditing: typeof candidate?.allowNoteEditing === "boolean" ? candidate.allowNoteEditing : DEFAULT_APP_PREFERENCES.allowNoteEditing,
  };
}

async function saveAppPreferences(preferences) {
  const current = await loadConfig();
  if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
  const appPreferences = normalizeAppPreferences({ ...current.config.appPreferences, ...preferences });
  const temporary = configPath(`.vault-config-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify({ ...current.config, vaultPath: current.vaultPath, appPreferences }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, configPath(".vault-config.json"));
  } finally {
    try { await unlink(temporary); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return appPreferences;
}

async function getState() {
  const empty = { configured: false, vaultPath: "", retrievalRoots: ["."], excludePaths: DEFAULT_EXCLUDES };
  let localConfig;
  try {
    localConfig = await loadConfig();
    if (!localConfig) return { ...empty, status: "unconfigured", message: "Wähle einen Ordner, um deinen Obsidian-Vault zu verbinden." };
    const validated = await validateConfiguration(localConfig.vaultPath, localConfig.config);
    for (const root of validated.resolvedRoots) await access(root, constants.R_OK | constants.W_OK | constants.X_OK);
    const client = await ensureFilesystemClient();
    if (!client) return { ...empty, status: "unavailable", message: "Der lokale Dateiserver ist nicht verfügbar. Bitte die Verbindung erneut prüfen." };
    await client.listTools();
    const appPreferences = normalizeAppPreferences(localConfig.config.appPreferences);
    return { configured: true, status: "ready", message: appPreferences.allowNoteEditing ? "Vault verbunden – bereit zum Lesen und Schreiben" : "Vault verbunden – Schreibzugriff ist in den Einstellungen gesperrt", vaultPath: validated.vaultPath, ...validated.config, appPreferences };
  } catch (error) {
    const unavailable = ["ENOENT", "EACCES", "EPERM", "ENOTDIR", "ECONNRESET", "ETIMEDOUT", "ERR_MODULE_NOT_FOUND"].includes(error.code);
    const retrievalRoots = Array.isArray(localConfig?.config?.retrievalRoots) && localConfig.config.retrievalRoots.every((value) => typeof value === "string")
      ? localConfig.config.retrievalRoots
      : ["."];
    const excludePaths = Array.isArray(localConfig?.config?.excludePaths) && localConfig.config.excludePaths.every((value) => typeof value === "string")
      ? localConfig.config.excludePaths
      : DEFAULT_EXCLUDES;
    return { ...empty, ...(localConfig ? { vaultPath: localConfig.vaultPath, retrievalRoots, excludePaths } : {}),
      status: unavailable ? "unavailable" : "invalid", message: `${unavailable ? "Der Vault ist nicht zugänglich." : "Die Vault-Konfiguration ist ungültig."} ${error.message} Bitte den Ordner und seine Zugriffsrechte prüfen oder erneut verbinden.` };
  }
}

function resultFor(currentState) {
  return { content: [{ type: "text", text: currentState.message }], structuredContent: currentState };
}

async function verifyReadWrite(scope) {
  for (const root of scope.resolvedRoots) {
    const probe = path.join(root, `.vault-assistant-access-check-${randomUUID()}`);
    await validateScopedPath(scope, probe);
    const handle = await open(probe, "wx+", 0o600);
    try {
      await handle.writeFile("vault-connection-check", "utf8");
      if (await readFile(probe, "utf8") !== "vault-connection-check") throw new Error(`Der Lese-/Schreibtest ist fehlgeschlagen: ${root}`);
    } finally {
      await handle.close();
      await unlink(probe);
    }
  }
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: message }], structuredContent: { error: message } };
}

async function chooseVaultPath() {
  if (process.platform !== "darwin") throw new Error("Die native Ordnerauswahl ist nur auf macOS verfügbar.");
  try {
    const picker = await executeFile("osascript", ["-e", 'POSIX path of (choose folder with prompt "Wähle deinen Obsidian-Vault")']);
    const selectedPath = picker.stdout.trim();
    if (!selectedPath) throw new Error("Es wurde kein Vault-Ordner ausgewählt.");
    return await realpath(selectedPath);
  } catch (error) {
    if (error.stderr?.includes("(-128)")) return null;
    throw error;
  }
}

async function createFilesystemClient(validated) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [filesystemEntry, ...validated.resolvedRoots], stderr: "inherit" });
  const client = new Client({ name: "obsidian-vault-assistant-proxy", version });
  try {
    await client.connect(transport);
    await client.listTools();
  } catch (error) {
    await client.close();
    throw error;
  }
  return client;
}

async function ensureFilesystemClient() {
  if (filesystemClient) return filesystemClient;
  const localConfig = await loadConfig();
  if (!localConfig) return null;
  filesystemClient = await createFilesystemClient(await validateConfiguration(localConfig.vaultPath, localConfig.config));
  return filesystemClient;
}

async function commitConnection(vaultPath, config) {
  const validated = await validateConfiguration(vaultPath, config);
  await verifyReadWrite(validated);
  const nextClient = await createFilesystemClient(validated);
  try {
    await saveConfiguration(validated);
  } catch (error) {
    await nextClient.close();
    throw error;
  }
  const previousClient = filesystemClient;
  filesystemClient = nextClient;
  if (previousClient) {
    try { await previousClient.close(); }
    catch (error) { console.error(JSON.stringify({ event: "previous_connection_close_failed", error: error.message })); }
  }
  await server.sendToolListChanged();
  return resultFor(await getState());
}

const setupTools = [
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
    inputSchema: { type: "object", properties: { set: { type: "object", properties: { excludePaths: { type: "string" }, showHiddenFiles: { type: "boolean" }, allowNoteEditing: { type: "boolean" } }, additionalProperties: false, minProperties: 1 } }, required: ["set"], additionalProperties: false },
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
    inputSchema: { type: "object", properties: { selectionId: { type: "string", minLength: 1 }, excludePaths: { type: "array", items: { type: "string" } } }, required: ["excludePaths"], additionalProperties: false },
    annotations: { readOnlyHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
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
    _meta: { ui: { visibility: ["app"] } },
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
  {
    name: "save_vault_scope",
    title: "Save Vault Retrieval Scope",
    description: "Save the selected Vault and its allowed retrieval folders locally. Does not create a global memory database or index.",
    inputSchema: {
      type: "object",
      properties: {
        retrievalRoots: { type: "array", items: { type: "string" }, minItems: 1 },
        excludePaths: { type: "array", items: { type: "string" } },
      },
      required: ["retrievalRoots", "excludePaths"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
  },
];

const server = new Server(
  { name: "obsidian-vault-assistant", version },
  {
    capabilities: { tools: { listChanged: true }, resources: {},
      extensions: { "openai/settings": { readTool: "settings.read", updateTool: "settings.update" } },
      experimental: { "openai/settings": { readTool: "settings.read", updateTool: "settings.update" } },
    },
    instructions:
      "This is the obsidianVaultFilesystem MCP for Obsidian Vault Assistant. First call get_vault_status. If ready, use Vault tools directly; otherwise call configure_vault to render the setup UI; do not use Md.obsidian Integration, Computer Use, or open Obsidian. The global open_vault_context app browses allowed Vault folders, edits Markdown notes with conflict checks, and lets the user explicitly add note content to the active chat. open_vault_browser_tab opens the same browser as a thread tab; configure_vault opens connection settings. The UI calls choose_vault for a draft, then connect_vault to confirm it. Never reselect a valid Vault unless requested. For an explicit Obsidian handoff, open_vault_context also accepts a deep-linked note path or selected text; read_note_for_handoff enforces the saved Vault scope and exclusions. Do not send handoff content until the user clicks the send action. Retrieval stays local and temporary: use only saved retrieval roots, never create a global memory database or vector index.",
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [...setupTools];
  try {
    const client = await ensureFilesystemClient();
    if (client) tools.push(...(await client.listTools()).tools);
  } catch (error) {
    console.error(JSON.stringify({ event: "filesystem_not_ready", error: error.message }));
  }
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments || {};
  try {
    if (name === "settings.read") {
      const state = await getState();
      const preferences = normalizeAppPreferences(state.appPreferences);
      return { content: [], structuredContent: {
        schema: { type: "object", properties: { excludePaths: { type: "string", title: "Ausgeschlossene Vault-Pfade", description: "Relative Datei- oder Ordnerpfade, ein Eintrag pro Zeile." }, showHiddenFiles: { type: "boolean", title: "Punktdateien anzeigen" }, allowNoteEditing: { type: "boolean", title: "Notizen bearbeiten erlauben" } }, required: ["excludePaths", "showHiddenFiles", "allowNoteEditing"] },
        layout: [{ kind: "group", title: "Obsidian Vault", items: [{ kind: "property", property: "excludePaths" }, { kind: "property", property: "showHiddenFiles" }, { kind: "property", property: "allowNoteEditing" }, { kind: "tool", tool: "configure_vault", title: "Vault verwalten", description: "Vault-Ordner wechseln und Verbindung prüfen." }] }],
        values: { excludePaths: (state.excludePaths || DEFAULT_EXCLUDES).join("\n"), ...preferences },
      } };
    }

    if (name === "settings.update") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      const settings = args.set || {};
      const preferences = {};
      for (const preferenceName of ["showHiddenFiles", "allowNoteEditing"]) {
        if (settings[preferenceName] !== undefined) {
          if (typeof settings[preferenceName] !== "boolean") throw new Error(`${preferenceName} muss ein boolescher Wert sein.`);
          preferences[preferenceName] = settings[preferenceName];
        }
      }
      if (settings.excludePaths !== undefined) {
        if (typeof settings.excludePaths !== "string") throw new Error("Die Ausschlüsse müssen als relative Pfade, je einer pro Zeile, eingegeben werden.");
        await commitConnection(current.vaultPath, {
          retrievalRoots: current.config.retrievalRoots,
          excludePaths: settings.excludePaths.split("\n").map((value) => value.trim()).filter(Boolean),
        });
      }
      const appPreferences = Object.keys(preferences).length ? await saveAppPreferences(preferences) : normalizeAppPreferences(current.config.appPreferences);
      const state = await getState();
      return { content: [], structuredContent: { values: { excludePaths: state.excludePaths.join("\n"), ...appPreferences } } };
    }

    if (name === "configure_vault" || name === "open_vault_context" || name === "open_vault_browser_tab" || name === "get_vault_status") {
      const state = await getState();
      if ((name === "open_vault_context" || name === "open_vault_browser_tab") && state.status !== "ready") {
        return resultFor({ ...state, appMode: "browser", handoffUnavailable: true, message: `${state.message} Verbinde zuerst einen Vault, bevor du den Vault durchsuchen kannst.` });
      }
      return name === "open_vault_context" || name === "open_vault_browser_tab" ? resultFor({ ...state, appMode: "browser" }) : resultFor(state);
    }

    if (name === "save_vault_note_from_app") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      if (!normalizeAppPreferences(current.config.appPreferences).allowNoteEditing) throw new Error("Das Bearbeiten von Vault-Notizen ist in den Obsidian-Einstellungen gesperrt.");
      const { path: relativePath, expectedContent, content } = args;
      if (typeof relativePath !== "string" || !relativePath.trim() || path.isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.split("/").some((part) => part === ".." || part === "")) {
        throw new Error("Bitte einen gültigen relativen Notizpfad innerhalb des verbundenen Vaults angeben.");
      }
      if (path.extname(relativePath).toLowerCase() !== ".md") throw new Error("In dieser Ansicht können nur Markdown-Notizen mit der Endung .md bearbeitet werden.");
      if (typeof expectedContent !== "string" || typeof content !== "string") throw new Error("Der Notizinhalt konnte nicht verarbeitet werden.");
      if (expectedContent.length > MAX_EDITABLE_NOTE_CHARS || content.length > MAX_EDITABLE_NOTE_CHARS) throw new Error(`Notizen können hier bis maximal ${MAX_EDITABLE_NOTE_CHARS.toLocaleString("de-AT")} Zeichen bearbeitet werden.`);
      const scope = await validateConfiguration(current.vaultPath, current.config);
      const absolutePath = await validateScopedPath(scope, path.resolve(scope.vaultPath, relativePath));
      const fileStats = await stat(absolutePath);
      if (!fileStats.isFile()) throw new Error("Der ausgewählte Pfad ist keine Notizdatei.");
      const actualContent = await readFile(absolutePath, "utf8");
      if (actualContent !== expectedContent) throw new Error("Diese Notiz wurde seit dem Öffnen geändert. Dein Entwurf ist noch vorhanden; lade die aktuelle Version neu, bevor du weiter speicherst.");
      const temporary = path.join(path.dirname(absolutePath), `.codex-note-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, content, { mode: fileStats.mode, flag: "wx" });
        await rename(temporary, absolutePath);
      } finally {
        try { await unlink(temporary); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
      return { content: [{ type: "text", text: `Notiz gespeichert: ${relativePath}` }], structuredContent: { path: relativePath, content } };
    }

    if (name === "list_vault_directory_for_app") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      if (typeof args.path !== "string" || !path.isAbsolute(args.path)) throw new Error("Bitte einen absoluten Ordnerpfad innerhalb des verbundenen Vaults angeben.");
      if (args.showHidden !== undefined && typeof args.showHidden !== "boolean") throw new Error("showHidden muss ein boolescher Wert sein.");
      const scope = await validateConfiguration(current.vaultPath, current.config);
      const directory = await validateScopedPath(scope, args.path);
      const fileStats = await stat(directory);
      if (!fileStats.isDirectory()) throw new Error("Der ausgewählte Pfad ist kein Ordner.");
      const result = await scopedListing(scope, "list_directory", { path: directory }, minimatch);
      if (!result) throw new Error("Der Ordner konnte nicht geladen werden.");
      const showHiddenFiles = typeof args.showHidden === "boolean" ? args.showHidden : normalizeAppPreferences(current.config.appPreferences).showHiddenFiles;
      if (showHiddenFiles) return result;
      const lines = result.content?.filter((item) => item.type === "text").map((item) => item.text || "").join("\n").split("\n") || [];
      const visibleLines = lines.filter((line) => {
        const match = line.match(/^\[(?:DIR|FILE)\] (.*)$/u);
        return !match || !match[1].startsWith(".");
      });
      const content = visibleLines.join("\n");
      return { content: [{ type: "text", text: content }], structuredContent: { content } };
    }

    if (name === "search_vault_entries_for_app") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      if (typeof args.query !== "string" || !args.query.trim() || args.query.length > 256) throw new Error("Bitte einen Suchbegriff mit 1 bis 256 Zeichen eingeben.");
      const query = args.query.trim();
      const scope = await validateConfiguration(current.vaultPath, current.config);
      const preferences = normalizeAppPreferences(current.config.appPreferences);
      const escapedQuery = minimatch.escape(query);
      const pattern = `**/*${escapedQuery}*`;
      const excludePatterns = preferences.showHiddenFiles ? [] : [".*", "**/.*"];
      const matches = [];
      for (const root of scope.resolvedRoots) {
        const result = await scopedListing(scope, "search_files", {
          path: root,
          pattern,
          caseInsensitive: true,
          excludePatterns,
        }, minimatch);
        const text = result?.content?.filter((item) => item.type === "text").map((item) => item.text || "").join("\n") || "";
        if (text && text !== "No matches found") matches.push(...text.split("\n").filter(Boolean));
      }
      const uniqueMatches = [...new Set(matches)].sort((left, right) => left.localeCompare(right));
      const truncated = uniqueMatches.length > 100;
      const entries = [];
      for (const absolutePath of uniqueMatches.slice(0, 100)) {
        const validatedPath = await validateScopedPath(scope, absolutePath);
        const entryStats = await stat(validatedPath);
        entries.push({
          path: path.relative(scope.vaultPath, absolutePath).split(path.sep).join("/"),
          name: path.basename(absolutePath),
          directory: entryStats.isDirectory(),
        });
      }
      return { content: [{ type: "text", text: `${entries.length} Treffer${truncated ? " (auf 100 begrenzt)" : ""}` }], structuredContent: { entries, truncated } };
    }

    if (name === "read_note_for_handoff") {
      const state = await getState();
      if (state.status !== "ready") throw new Error(`${state.message} Verbinde zuerst einen Vault.`);
      const relativePath = args.path;
      if (typeof relativePath !== "string" || !relativePath.trim() || path.isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.split("/").some((part) => part === ".." || part === "")) {
        throw new Error("Bitte einen gültigen relativen Notizpfad innerhalb des verbundenen Vaults angeben.");
      }
      if (path.extname(relativePath).toLowerCase() !== ".md") throw new Error("Für die Übergabe werden nur Markdown-Notizen mit der Endung .md unterstützt.");
      const current = await loadConfig();
      const scope = await validateConfiguration(current.vaultPath, current.config);
      const absolutePath = await validateScopedPath(scope, path.resolve(scope.vaultPath, relativePath));
      const fileStats = await stat(absolutePath);
      if (!fileStats.isFile()) throw new Error("Der ausgewählte Pfad ist keine Notizdatei.");
      if (fileStats.size > MAX_HANDOFF_NOTE_CHARS * 4) throw new Error(`Die Notiz ist zu groß für die direkte Übergabe. Bitte sende eine kürzere Auswahl (maximal ${MAX_HANDOFF_NOTE_CHARS} Zeichen).`);
      const client = await ensureFilesystemClient();
      if (!client) throw new Error("Der lokale Dateiserver ist nicht verfügbar. Bitte die Vault-Verbindung prüfen.");
      const note = await client.callTool({ name: "read_text_file", arguments: { path: absolutePath } });
      if (note.isError) throw new Error(note.content?.map((item) => item.text || "").join("\\n") || "Die Notiz konnte nicht gelesen werden.");
      const content = note.content?.map((item) => item.text || "").join("\\n") || "";
      if (content.length > MAX_HANDOFF_NOTE_CHARS) throw new Error(`Die Notiz überschreitet ${MAX_HANDOFF_NOTE_CHARS} Zeichen. Bitte sende eine kürzere Auswahl.`);
      return { content: [{ type: "text", text: `Notiz bereit: ${relativePath}` }], structuredContent: { path: relativePath, content, title: path.basename(relativePath, ".md") } };
    }

    if (name === "choose_vault") {
      for (const [selectionId, selection] of selections) {
        if (selection.expiresAt <= Date.now()) selections.delete(selectionId);
      }
      const candidate = await chooseVaultPath();
      const current = await getState();
      if (!candidate) return resultFor({ ...current, cancelled: true, message: "Ordnerauswahl abgebrochen. Die bisherige Verbindung bleibt bestehen." });
      const selectionId = randomUUID();
      const sameVault = current.status === "ready" && current.vaultPath === candidate;
      const selectedConfig = sameVault
        ? { retrievalRoots: current.retrievalRoots, excludePaths: current.excludePaths }
        : { retrievalRoots: ["."], excludePaths: DEFAULT_EXCLUDES };
      selections.set(selectionId, { path: candidate, ...selectedConfig, expiresAt: Date.now() + 30 * 60 * 1000 });
      let recognized = true;
      try { recognized = (await stat(path.join(candidate, ".obsidian"))).isDirectory(); }
      catch (error) { if (error.code !== "ENOENT") throw error; recognized = false; }
      return resultFor({ ...current, selection: { selectionId, vaultPath: candidate, recognized, ...selectedConfig }, message: "Ordner ausgewählt. Mit Verbinden bestätigen." });
    }

    if (name === "connect_vault") {
      let vaultPath;
      let roots;
      if (args.selectionId !== undefined) {
        const selection = selections.get(args.selectionId);
        if (!selection || selection.expiresAt < Date.now()) throw new Error("Die Ordnerauswahl ist abgelaufen. Bitte den Ordner erneut auswählen.");
        vaultPath = selection.path;
        roots = selection.retrievalRoots;
      } else {
        const current = await loadConfig();
        if (!current) throw new Error("Bitte zuerst einen Vault-Ordner auswählen.");
        vaultPath = current.vaultPath;
        roots = current.config.retrievalRoots;
      }
      const result = await commitConnection(vaultPath, { retrievalRoots: roots, excludePaths: args.excludePaths });
      if (args.selectionId) selections.delete(args.selectionId);
      return result;
    }

    if (name === "save_vault_scope") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      return await commitConnection(current.vaultPath, { retrievalRoots: args.retrievalRoots, excludePaths: args.excludePaths });
    }

    const client = await ensureFilesystemClient();
    if (!client) throw new Error("No Vault is configured. Open configure_vault first.");
    const localConfig = await loadConfig();
    if (!normalizeAppPreferences(localConfig.config.appPreferences).allowNoteEditing && WRITE_TOOLS.has(name)) {
      throw new Error("Schreibzugriff auf den Vault ist in den Obsidian-Einstellungen gesperrt. Ändere die Einstellung, wenn du Dateien bearbeiten möchtest.");
    }
    const scope = await validateConfiguration(localConfig.vaultPath, localConfig.config);
    const knownTools = (await client.listTools()).tools;
    if (!knownTools.some((tool) => tool.name === name)) throw new Error(`Unknown Vault tool: ${name}`);
    const paths = name === "move_file" ? [args.source, args.destination] :
      name === "read_multiple_files" ? args.paths : name === "list_allowed_directories" ? [] : [args.path];
    if (!Array.isArray(paths)) throw new Error(`Invalid path arguments for Vault tool: ${name}`);
    for (const candidate of paths) await validateScopedPath(scope, candidate);
    const listing = await scopedListing(scope, name, args, minimatch);
    if (listing) return listing;
    return await client.callTool({ name, arguments: args });
  } catch (error) {
    return errorResult(error);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: UI_RESOURCE_URI, name: "Obsidian Vault Browser", description: "Browse the connected Vault and read Markdown notes, or manage the Vault connection.", mimeType: "text/html;profile=mcp-app" }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === UI_RESOURCE_URI) {
    return {
      contents: [{ uri: UI_RESOURCE_URI, mimeType: "text/html;profile=mcp-app", text: setupUi, _meta: { ui: { prefersBorder: true }, "openai/ui": { availableDisplayModes: ["inline"], preferredDisplayMode: "inline" } } }],
    };
  }
  const client = await ensureFilesystemClient();
  if (!client) throw new Error(`Unknown resource: ${request.params.uri}`);
  return await client.readResource({ uri: request.params.uri });
});

await server.connect(new StdioServerTransport());
