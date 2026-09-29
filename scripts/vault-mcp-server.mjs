#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, chmod, stat, realpath } from "node:fs/promises";
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
const DEFAULT_EXCLUDES = [".obsidian", ".git", "Attachments", "Archive", "Archiv"];
const setupUiPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui/vault-setup.html");
const setupUi = await readFile(setupUiPath, "utf8");

let filesystemClient = null;

function configPath(name) {
  return path.join(configDir, name);
}

function isInside(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

async function loadConfig() {
  try {
    const configuredVault = (await readFile(configPath(".vault-path"), "utf8")).trim();
    const config = JSON.parse(await readFile(configPath(".vault-config.json"), "utf8"));
    if (!configuredVault || typeof config !== "object" || config === null) {
      throw new Error("The local Vault configuration is incomplete.");
    }
    return { vaultPath: configuredVault, config };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Could not read local Vault configuration: ${error.message}`);
  }
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

async function saveConfiguration(vaultPath, config) {
  const validated = await validateConfiguration(vaultPath, config);
  await mkdir(configDir, { recursive: true });
  await writeFile(configPath(".vault-path"), `${validated.vaultPath}\n`, { mode: 0o600 });
  await writeFile(configPath(".vault-config.json"), `${JSON.stringify(validated.config, null, 2)}\n`, { mode: 0o600 });
  await chmod(configPath(".vault-path"), 0o600);
  await chmod(configPath(".vault-config.json"), 0o600);
  return validated;
}

async function getState() {
  const localConfig = await loadConfig();
  if (!localConfig) {
    return { configured: false, vaultPath: "", retrievalRoots: ["."], excludePaths: DEFAULT_EXCLUDES };
  }
  const validated = await validateConfiguration(localConfig.vaultPath, localConfig.config);
  return {
    configured: true,
    vaultPath: validated.vaultPath,
    retrievalRoots: validated.config.retrievalRoots,
    excludePaths: validated.config.excludePaths,
  };
}

function stateText(currentState) {
  if (!currentState.configured) return "No Obsidian Vault is configured yet. Use the Vault setup UI to select one.";
  return [
    `Configured Vault: ${currentState.vaultPath}`,
    `Retrieval roots: ${currentState.retrievalRoots.join(", ")}`,
    `Excluded paths: ${currentState.excludePaths.join(", ") || "none"}`,
  ].join("\n");
}

function resultFor(currentState, message = stateText(currentState)) {
  return { content: [{ type: "text", text: message }], structuredContent: currentState };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: message }], structuredContent: { configured: false, error: message } };
}

function chooseVaultPath() {
  if (process.platform !== "darwin") throw new Error("The native Vault picker is currently available on macOS only.");
  const picker = spawnSync(
    "osascript",
    ["-e", 'POSIX path of (choose folder with prompt "Select your Obsidian vault")'],
    { encoding: "utf8" },
  );
  if (picker.status !== 0) throw new Error(picker.stderr?.trim() || "The folder selection was cancelled.");
  const selectedPath = picker.stdout.trim();
  if (!selectedPath) throw new Error("No Obsidian Vault was selected.");
  return selectedPath;
}

async function closeFilesystemClient() {
  if (filesystemClient) await filesystemClient.close();
  filesystemClient = null;
}

async function ensureFilesystemClient() {
  if (filesystemClient) return filesystemClient;
  const localConfig = await loadConfig();
  if (!localConfig) return null;
  const validated = await validateConfiguration(localConfig.vaultPath, localConfig.config);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [filesystemEntry, ...validated.resolvedRoots],
    stderr: "inherit",
  });
  const client = new Client({ name: "obsidian-vault-assistant-proxy", version: "0.5.3" });
  try {
    await client.connect(transport);
  } catch (error) {
    await client.close();
    throw error;
  }
  filesystemClient = client;
  return filesystemClient;
}

const setupTools = [
  {
    name: "configure_vault",
    title: "Obsidian Vault Assistant Setup",
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
    description: "Open the native macOS folder picker and select the local Obsidian Vault.",
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
  { name: "obsidian-vault-assistant", version: "0.5.3" },
  {
    capabilities: { tools: { listChanged: true }, resources: {} },
    instructions:
      "This is the obsidianVaultFilesystem MCP for Obsidian Vault Assistant. For setup, call configure_vault to render the in-chat UI; do not use Md.obsidian Integration, Computer Use, or open Obsidian. The UI calls choose_vault, then save_vault_scope. Retrieval stays local and temporary: use only saved retrieval roots, never create a global memory database or vector index.",
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
    if (name === "configure_vault") return resultFor(await getState());

    if (name === "choose_vault") {
      await saveConfiguration(chooseVaultPath(), { retrievalRoots: ["."], excludePaths: DEFAULT_EXCLUDES });
      await closeFilesystemClient();
      await ensureFilesystemClient();
      await server.sendToolListChanged();
      return resultFor(await getState(), "Vault selected. Review the retrieval scope in the UI and save it.");
    }

    if (name === "save_vault_scope") {
      const current = await loadConfig();
      if (!current) throw new Error("Select an Obsidian Vault first.");
      await saveConfiguration(current.vaultPath, { retrievalRoots: args.retrievalRoots, excludePaths: args.excludePaths });
      await closeFilesystemClient();
      await ensureFilesystemClient();
      await server.sendToolListChanged();
      return resultFor(await getState(), "Vault retrieval scope saved locally.");
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
      contents: [{ uri: UI_RESOURCE_URI, mimeType: "text/html;profile=mcp-app", text: setupUi, _meta: { ui: { prefersBorder: true } } }],
    };
  }
  const client = await ensureFilesystemClient();
  if (!client) throw new Error(`Unknown resource: ${request.params.uri}`);
  return await client.readResource({ uri: request.params.uri });
});

await server.connect(new StdioServerTransport());
