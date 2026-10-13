import { stat, realpath, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveDestination, validateScopedPath } from "./scope.js";
import type { ScopeConfig, VaultScope } from "./types.js";
function isInside(parent: string, candidate: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

export async function validateConfiguration(candidateVaultPath: string, candidateConfig: ScopeConfig): Promise<VaultScope> {
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

export async function verifyReadWrite(scope: VaultScope): Promise<void> {
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

