import { lstat, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

/** @typedef {{vaultPath: string, resolvedRoots: string[], resolvedExcludes: string[], config: {retrievalRoots: string[], excludePaths: string[]}}} VaultScope */

/** @typedef {{name: string, type: string, children?: TreeNode[]}} TreeNode */
/** @typedef {{path: string, pattern?: string, excludePatterns?: string[], sortBy?: string}} ListingArgs */
/** @typedef {(value: string, pattern: string, options: {dot: boolean}) => boolean} Matcher */

/** @param {string} parent @param {string} candidate @returns {boolean} */
function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

/** Resolve missing write destinations through their nearest existing ancestor.
 * @param {string} candidate @returns {Promise<string>} */
export async function resolveDestination(candidate) {
  try {
    return await realpath(candidate);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // A dangling symlink must not be treated as a new destination.
    try {
      const info = await lstat(candidate);
      if (info.isSymbolicLink()) throw new Error(`Dangling symlink cannot be accessed: ${candidate}`);
    } catch (entryError) {
      if (entryError.code !== "ENOENT") throw entryError;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) throw error;
    return path.join(await resolveDestination(parent), path.basename(candidate));
  }
}

/** @param {VaultScope} scope @param {string} candidate @returns {boolean} */
function isAllowed(scope, candidate) {
  return scope.resolvedRoots.some((root) => isInside(root, candidate)) &&
    !scope.config.excludePaths.some((excluded) => isInside(path.resolve(scope.vaultPath, excluded), candidate)) &&
    !scope.resolvedExcludes.some((excluded) => isInside(excluded, candidate));
}

/** @param {VaultScope} scope @param {string} candidate @returns {Promise<string>} */
export async function validateScopedPath(scope, candidate) {
  if (typeof candidate !== "string" || !path.isAbsolute(candidate)) {
    throw new Error("Vault tool paths must be absolute paths inside a configured retrieval root.");
  }
  const normalized = path.resolve(candidate);
  const resolved = await resolveDestination(normalized);
  if (!isAllowed(scope, normalized) || !isAllowed(scope, resolved)) {
    throw new Error(`Access denied by Vault retrieval scope: ${candidate}`);
  }
  return resolved;
}

/** @param {VaultScope} scope @param {string} directory @returns {Promise<import('node:fs').Dirent[]>} */
async function visibleEntries(scope, directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  /** @type {import('node:fs').Dirent[]} */
  const visible = [];
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (!isAllowed(scope, candidate)) continue;
    // Do not enumerate symlink aliases to excluded or external paths.
    if (entry.isSymbolicLink()) {
      const resolved = await realpath(candidate);
      if (!isAllowed(scope, resolved)) continue;
    }
    visible.push(entry);
  }
  return visible;
}

/** @param {string} text @returns {{content: {type: 'text', text: string}[], structuredContent: {content: string}}} */
function textResult(text) {
  return { content: [{ type: "text", text }], structuredContent: { content: text } };
}

/** Scope-aware traversal: excluded directories are pruned before reading them.
 * @param {VaultScope} scope @param {string} directory @param {string} root
 * @param {string[]} exclusions @param {Matcher} match
 * @returns {Promise<TreeNode[]>} */
async function scopedTree(scope, directory, root, exclusions, match) {
  /** @type {TreeNode[]} */
  const nodes = [];
  for (const entry of await visibleEntries(scope, directory)) {
    const candidate = path.join(directory, entry.name);
    const relative = path.relative(root, candidate);
    if (exclusions.some((pattern) => match(relative, pattern, { dot: true }) ||
      (!pattern.includes("*") && match(relative, `**/${pattern}`, { dot: true })))) continue;
    /** @type {TreeNode} */
    const node = { name: entry.name, type: entry.isDirectory() ? "directory" : "file" };
    if (entry.isDirectory()) node.children = await scopedTree(scope, candidate, root, exclusions, match);
    nodes.push(node);
  }
  return nodes;
}

/** @param {VaultScope} scope @param {string} name @param {ListingArgs} args
 * @param {Matcher} match
 * @returns {Promise<ReturnType<typeof textResult> | null>} */
export async function scopedListing(scope, name, args, match) {
  if (!["list_directory", "list_directory_with_sizes", "directory_tree", "search_files"].includes(name)) return null;
  const root = await validateScopedPath(scope, args.path);
  if (name === "directory_tree" || name === "search_files") {
    if (!Array.isArray(args.excludePatterns || []) || !(args.excludePatterns || []).every((pattern) => typeof pattern === "string")) {
      throw new Error("excludePatterns must be an array of glob strings.");
    }
    if (name === "search_files" && typeof args.pattern !== "string") throw new Error("search_files requires a glob pattern string.");
    const tree = await scopedTree(scope, root, root, args.excludePatterns || [], match);
    if (name === "directory_tree") return textResult(JSON.stringify(tree, null, 2));
    /** @type {string[]} */
    const results = [];
    /** @param {TreeNode[]} nodes @param {string} directory @returns {void} */
    function collect(nodes, directory) {
      for (const node of nodes) {
        const candidate = path.join(directory, node.name);
        if (match(path.relative(root, candidate), args.pattern, { dot: true })) results.push(candidate);
        if (node.children) collect(node.children, candidate);
      }
    }
    collect(tree, root);
    return textResult(results.join("\n") || "No matches found");
  }
  const entries = await visibleEntries(scope, root);
  if (name === "list_directory") {
    return textResult(entries.map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`).join("\n"));
  }
  if (args.sortBy !== undefined && !["name", "size"].includes(args.sortBy)) throw new Error("sortBy must be name or size.");
  const details = await Promise.all(entries.map(async (entry) => ({
    name: entry.name, directory: entry.isDirectory(), size: (await stat(path.join(root, entry.name))).size,
  })));
  const sorted = [...details].sort((a, b) => args.sortBy === "size" ? b.size - a.size : a.name.localeCompare(b.name));
  const files = details.filter((entry) => !entry.directory);
  return textResult([
    ...sorted.map((entry) => `${entry.directory ? "[DIR]" : "[FILE]"} ${entry.name} ${entry.directory ? "" : `${entry.size} B`}`),
    "", `Total: ${files.length} files, ${details.length - files.length} directories`,
    `Combined size: ${files.reduce((sum, entry) => sum + entry.size, 0)} B`,
  ].join("\n"));
}
