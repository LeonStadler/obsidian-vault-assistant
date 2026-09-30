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

const UI_RESOURCE_URI = "ui://obsidian-vault-assistant/vault-setup-v1.html";
const { minimatch } = await import(pathToFileURL(path.join(nodeModulesDir, "minimatch", "dist", "esm", "index.js")).href);
const DEFAULT_EXCLUDES = [".obsidian", ".git", ".trash"];
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
  await mkdir(configDir, { recursive: true });
  const temporary = configPath(`.vault-config-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify({ vaultPath: validated.vaultPath, ...validated.config }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, configPath(".vault-config.json"));
  } finally {
    try { await unlink(temporary); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
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
    return { configured: true, status: "ready", message: "Vault verbunden – bereit zum Lesen und Schreiben", vaultPath: validated.vaultPath, ...validated.config };
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
    description: "Update only the exclusion paths of the currently connected Vault.",
    inputSchema: { type: "object", properties: { set: { type: "object", properties: { excludePaths: { type: "string" } }, required: ["excludePaths"], additionalProperties: false } }, required: ["set"], additionalProperties: false },
    outputSchema: { type: "object", properties: { values: { type: "object", properties: { excludePaths: { type: "string" } }, required: ["excludePaths"], additionalProperties: false } }, required: ["values"], additionalProperties: false },
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
      "This is the obsidianVaultFilesystem MCP for Obsidian Vault Assistant. First call get_vault_status. If ready, use Vault tools directly; otherwise call configure_vault to render the setup UI; do not use Md.obsidian Integration, Computer Use, or open Obsidian. The UI calls choose_vault for a draft, then connect_vault to confirm it. Never reselect a valid Vault unless requested. Retrieval stays local and temporary: use only saved retrieval roots, never create a global memory database or vector index.",
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
      return { content: [], structuredContent: {
        schema: { type: "object", properties: { excludePaths: { type: "string", title: "Ausgeschlossene Vault-Pfade", description: "Relative Datei- oder Ordnerpfade, ein Eintrag pro Zeile." } }, required: ["excludePaths"] },
        layout: [{ kind: "group", title: "Obsidian Vault", items: [{ kind: "property", property: "excludePaths" }, { kind: "tool", tool: "configure_vault", title: "Vault verwalten", description: "Vault-Ordner wechseln und Verbindung prüfen." }] }],
        values: { excludePaths: (state.excludePaths || DEFAULT_EXCLUDES).join("\n") },
      } };
    }

    if (name === "settings.update") {
      const current = await loadConfig();
      if (!current) throw new Error("Bitte zuerst einen Vault verbinden.");
      const excludePaths = args.set?.excludePaths;
      if (typeof excludePaths !== "string") throw new Error("Die Ausschlüsse müssen als relative Pfade, je einer pro Zeile, eingegeben werden.");
      await commitConnection(current.vaultPath, {
        retrievalRoots: current.config.retrievalRoots,
        excludePaths: excludePaths.split("\n").map((value) => value.trim()).filter(Boolean),
      });
      const state = await getState();
      return { content: [], structuredContent: { values: { excludePaths: state.excludePaths.join("\n") } } };
    }

    if (name === "configure_vault" || name === "get_vault_status") return resultFor(await getState());

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
  resources: [{ uri: UI_RESOURCE_URI, name: "Obsidian Vault Setup", description: "Local Vault and retrieval-scope configuration UI.", mimeType: "text/html;profile=mcp-app" }],
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
