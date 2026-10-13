#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { readFile, writeFile, mkdir, stat, realpath, access, open, unlink, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scopedListing, validateScopedPath } from "../src/core/scope.ts";
import { validateConfiguration, verifyReadWrite } from "../src/core/validation.ts";
import { loadConfig, saveConfiguration, saveAppPreferences, normalizeAppPreferences, configDir, DEFAULT_EXCLUDES, DEFAULT_APP_PREFERENCES, migrateLegacyConfig, legacyConflict, configurationSnapshot } from "../src/core/config-store.ts";
import { selectVaultFolder } from "../src/core/folder-selection.ts";
import { searchEntries } from "../src/core/search.ts";
import { setupTools, UI_RESOURCE_URI } from "../src/server/tool-definitions.ts";
import { hostTool, hostCapabilities, resourceMetadata } from "../src/hosts/profiles.ts";
import { saveNote, MAX_EDITABLE_NOTE_CHARS } from "../src/core/notes.ts";
import { withVaultLock } from "../src/core/lock.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { minimatch } from "minimatch";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filesystemEntry = path.join(pluginDir, "scripts", "filesystem-server.bundle.mjs");
const MAX_HANDOFF_NOTE_CHARS = 24000;
const WRITE_TOOLS = new Set(["write_file", "edit_file", "create_directory", "move_file", "delete_file"]);
const version = JSON.parse(await readFile(path.join(pluginDir, "package.json"), "utf8")).version;
const selections = new Map();
const setupUiPath = path.join(pluginDir, "ui", "vault-setup.bundle.html");
const setupUi = await readFile(setupUiPath, "utf8");

let filesystemClient = null;
let filesystemRevision = -1;
let migrationFailure = null;

async function getState() {
  const empty = { configured: false, vaultPath: "", retrievalRoots: ["."], excludePaths: DEFAULT_EXCLUDES };
  let localConfig;
  try {
    localConfig = await loadConfig();
    if (!localConfig && migrationFailure) return { ...empty, status: "invalid", message: migrationFailure };
    if (!localConfig) return { ...empty, status: "unconfigured", message: "Wähle einen Ordner, um deinen Obsidian-Vault zu verbinden." };
    const validated = await validateConfiguration(localConfig.vaultPath, localConfig.config);
    for (const root of validated.resolvedRoots) await access(root, constants.R_OK | constants.W_OK | constants.X_OK);
    const client = await ensureFilesystemClient();
    if (!client) return { ...empty, status: "unavailable", message: "Der lokale Dateiserver ist nicht verfügbar. Bitte die Verbindung erneut prüfen." };
    await client.listTools();
    const appPreferences = normalizeAppPreferences(localConfig.config.appPreferences);
    return { configured: true, status: "ready", message: appPreferences.allowNoteEditing ? "Vault verbunden – bereit zum Lesen und Schreiben" : "Vault verbunden – Schreibzugriff ist in den Einstellungen gesperrt", vaultPath: validated.vaultPath, ...validated.config, appPreferences, configRevision: localConfig.config.revision, configurationNotice: await legacyConflict() };
  } catch (error) {
    const unavailable = ["ENOENT", "EACCES", "EPERM", "ENOTDIR", "ECONNRESET", "ETIMEDOUT", "ERR_MODULE_NOT_FOUND"].includes(error.code);
    const retrievalRoots = Array.isArray(localConfig?.config?.retrievalRoots) && localConfig.config.retrievalRoots.every((value) => typeof value === "string")
      ? localConfig.config.retrievalRoots
      : ["."];
    const excludePaths = Array.isArray(localConfig?.config?.excludePaths) && localConfig.config.excludePaths.every((value) => typeof value === "string")
      ? localConfig.config.excludePaths
      : DEFAULT_EXCLUDES;
    const snapshot = localConfig ? { revision: localConfig.config.revision, appPreferences: normalizeAppPreferences(localConfig.config.appPreferences) } : unavailable ? { revision: 0, appPreferences: DEFAULT_APP_PREFERENCES } : await configurationSnapshot();
    return { ...empty, configRevision: snapshot.revision, appPreferences: snapshot.appPreferences, ...(localConfig ? { vaultPath: localConfig.vaultPath, retrievalRoots, excludePaths } : {}),
      status: unavailable ? "unavailable" : "invalid", message: `${unavailable ? "Der Vault ist nicht zugänglich." : "Die Vault-Konfiguration ist ungültig."} ${error.message} Bitte den Ordner und seine Zugriffsrechte prüfen oder erneut verbinden.` };
  }
}

function resultFor(currentState) {
  return { content: [{ type: "text", text: currentState.message }], structuredContent: currentState };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: message }], structuredContent: { error: message } };
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
  const localConfig = await loadConfig();
  if (filesystemClient && localConfig?.config.revision === filesystemRevision) return filesystemClient;
  if (filesystemClient) { await filesystemClient.close(); filesystemClient = null; }
  if (!localConfig) return null;
  filesystemRevision = localConfig.config.revision;
  filesystemClient = await createFilesystemClient(await validateConfiguration(localConfig.vaultPath, localConfig.config));
  return filesystemClient;
}

async function commitConnection(vaultPath, config, expectedRevision) {
  const validated = await validateConfiguration(vaultPath, config);
  await verifyReadWrite(validated);
  const nextClient = await createFilesystemClient(validated);
  try {
    await saveConfiguration(validated, expectedRevision);
    migrationFailure = null;
    filesystemRevision = expectedRevision + 1;
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

const server = new Server(
  { name: "obsidian-vault-assistant", version },
  {
    capabilities: { tools: { listChanged: true }, resources: {},
      ...hostCapabilities(),
    },
    instructions:
      "This is the obsidianVaultFilesystem MCP for Obsidian Vault Assistant. First call get_vault_status. If ready, use Vault tools directly; otherwise call configure_vault to render the setup UI; do not use Md.obsidian Integration, Computer Use, or open Obsidian. The global open_vault_context app browses allowed Vault folders, edits Markdown notes with conflict checks, and lets the user explicitly add note content to the active chat. open_vault_browser_tab opens the same browser as a thread tab; configure_vault opens connection settings. The UI calls choose_vault for a draft, then connect_vault to confirm it. Never reselect a valid Vault unless requested. For an explicit Obsidian handoff, open_vault_context also accepts a deep-linked note path or selected text; read_note_for_handoff enforces the saved Vault scope and exclusions. Do not send handoff content until the user clicks the send action. Retrieval stays local and temporary: use only saved retrieval roots, never create a global memory database or vector index.",
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => await withVaultLock(configDir, async () => {
  const tools = setupTools.map(hostTool);
  try {
    const client = await ensureFilesystemClient();
    if (client) tools.push(...(await client.listTools()).tools);
  } catch (error) {
    console.error(JSON.stringify({ event: "filesystem_not_ready", error: error.message }));
  }
  return { tools };
}));

async function stageVaultSelection(candidate) {
      for (const [selectionId, selection] of selections) {
        if (selection.expiresAt <= Date.now()) selections.delete(selectionId);
      }
      const current = await getState();
      if (!candidate) return resultFor({ ...current, cancelled: true, message: "Ordnerauswahl abgebrochen. Die bisherige Verbindung bleibt bestehen." });
      const selectionId = randomUUID();
      const sameVault = current.status === "ready" && current.vaultPath === candidate;
      const selectedConfig = sameVault
        ? { retrievalRoots: current.retrievalRoots, excludePaths: current.excludePaths }
        : { retrievalRoots: ["."], excludePaths: DEFAULT_EXCLUDES };
      selections.set(selectionId, { revision: current.configRevision || 0, path: candidate, ...selectedConfig, expiresAt: Date.now() + 30 * 60 * 1000 });
      let recognized = true;
      try { recognized = (await stat(path.join(candidate, ".obsidian"))).isDirectory(); }
      catch (error) { if (error.code !== "ENOENT") throw error; recognized = false; }
      return resultFor({ ...current, selection: { selectionId, vaultPath: candidate, recognized, ...selectedConfig }, message: "Ordner ausgewählt. Mit Verbinden bestätigen." });
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "choose_vault") {
      // Do not block existing Vault access while the native folder dialog is open.
      const candidate = await selectVaultFolder(request.params.arguments?.vaultPath);
      return await withVaultLock(configDir, () => stageVaultSelection(candidate));
    }
    return await withVaultLock(configDir, () => handleTool(request));
  } catch (error) { return errorResult(error); }
});

async function handleTool(request) {
  const name = request.params.name;
  const args = request.params.arguments || {};
  try {
    const requestConfig = await loadConfig().catch((error) => { if (["get_vault_status", "configure_vault", "open_vault_context", "open_vault_browser_tab", "choose_vault", "connect_vault"].includes(name)) return null; throw error; });
    const expectedRevision = args.configRevision ?? requestConfig?.config.revision ?? 0;
    if (args.configRevision !== undefined && requestConfig && args.configRevision !== requestConfig.config.revision && !["get_vault_status", "configure_vault"].includes(name)) throw new Error("Die Vault-Verbindung oder Einstellungen wurden inzwischen geändert. Bitte neu laden.");
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
      if (current.config.revision !== expectedRevision) throw new Error("Die Vault-Einstellungen wurden inzwischen geändert. Bitte neu laden.");
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
        }, expectedRevision);
      }
      const appPreferences = Object.keys(preferences).length ? await saveAppPreferences(preferences, (await loadConfig()).config.revision) : normalizeAppPreferences(current.config.appPreferences);
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
      const scope = await validateConfiguration(current.vaultPath, current.config);
      await saveNote(scope, relativePath, expectedContent, content);
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
      const scope = await validateConfiguration(current.vaultPath, current.config);
      return await searchEntries(scope, normalizeAppPreferences(current.config.appPreferences), args.query.trim());
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
      const result = await commitConnection(vaultPath, { retrievalRoots: roots, excludePaths: args.excludePaths }, args.selectionId ? selections.get(args.selectionId).revision : expectedRevision);
      if (args.selectionId) selections.delete(args.selectionId);
      return result;
    }

    if (name === "save_vault_scope") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      return await commitConnection(current.vaultPath, { retrievalRoots: args.retrievalRoots, excludePaths: args.excludePaths }, expectedRevision);
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
}

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{ uri: UI_RESOURCE_URI, name: "Obsidian Vault Browser", description: "Browse the connected Vault and read Markdown notes, or manage the Vault connection.", mimeType: "text/html;profile=mcp-app" }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === UI_RESOURCE_URI) {
    return {
      contents: [{ uri: UI_RESOURCE_URI, mimeType: "text/html;profile=mcp-app", text: setupUi, _meta: resourceMetadata() }],
    };
  }
  const client = await ensureFilesystemClient();
  if (!client) throw new Error(`Unknown resource: ${request.params.uri}`);
  return await client.readResource({ uri: request.params.uri });
});

try { await migrateLegacyConfig(); } catch (error) { migrationFailure = `Die bisherige Vault-Konfiguration konnte nicht übernommen werden: ${error.message} Bitte den Vault ausdrücklich erneut verbinden.`; console.error(JSON.stringify({ event: "configuration_migration_failed", error: error.message })); }
const transport = new StdioServerTransport();
await server.connect(transport);
const previousOnClose = transport.onclose;
transport.onclose = () => {
  previousOnClose?.();
  if (filesystemClient) void filesystemClient.close().catch((error) => console.error(JSON.stringify({ event: "filesystem_shutdown_failed", error: error.message })));
};

process.stdin.once("end", () => {
  void (async () => {
    if (filesystemClient) await filesystemClient.close();
    await server.close();
  })().catch((error) => console.error(JSON.stringify({ event: "stdio_shutdown_failed", error: error.message })));
});
