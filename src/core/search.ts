import path from 'node:path';
import { stat } from 'node:fs/promises';
import { minimatch } from 'minimatch';
import { scopedListing, validateScopedPath } from './scope.js';
import type { VaultScope, AppPreferences } from './types.js';
interface SearchEntry { path: string; name: string; directory: boolean }
interface SearchResult { content: { type: 'text'; text: string }[]; structuredContent: { entries: SearchEntry[]; truncated: boolean } }
export async function searchEntries(scope: VaultScope, preferences: AppPreferences, query: string): Promise<SearchResult> {
const escapedQuery = minimatch.escape(query);
const pattern = `**/*${escapedQuery}*`;
const excludePatterns = preferences.showHiddenFiles ? [] : [".*", "**/.*"];
const matches: string[] = [];
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
const entries: SearchEntry[] = [];
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
