import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { ConfigurationError, errorCode, type AppPreferences, type LoadedConfig, type VaultConfig, type VaultScope } from './types.js';
import { withVaultLock } from './lock.js';

export const DEFAULT_EXCLUDES: string[] = ['.obsidian', '.git', '.trash'];
export const DEFAULT_APP_PREFERENCES: AppPreferences = { showHiddenFiles: false, allowNoteEditing: true };
export const configDir: string = path.resolve(process.env.VAULT_MCP_CONFIG_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'Obsidian Vault Assistant'));
const legacyDir = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'plugins', 'obsidian-vault-assistant');
export function normalizeAppPreferences(candidate: unknown): AppPreferences {
  const value = typeof candidate === 'object' && candidate !== null ? candidate as Partial<AppPreferences> : {};
  return { showHiddenFiles: typeof value.showHiddenFiles === 'boolean' ? value.showHiddenFiles : false, allowNoteEditing: typeof value.allowNoteEditing === 'boolean' ? value.allowNoteEditing : true };
}
async function readConfig(directory: string): Promise<LoadedConfig | null> {
  let candidate: unknown;
  try { candidate = JSON.parse(await readFile(path.join(directory, '.vault-config.json'), 'utf8')); }
  catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
    try { await readFile(path.join(directory, '.vault-path'), 'utf8'); }
    catch (legacyError) { if (errorCode(legacyError) === 'ENOENT') return null; throw legacyError; }
    throw new ConfigurationError('Die Vault-Konfiguration ist unvollständig. Bitte den Vault erneut verbinden.');
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new ConfigurationError('Ungültige Vault-Konfiguration.');
  const value = candidate as Record<string, unknown>;
  let vaultPath = value.vaultPath;
  if (vaultPath === undefined) {
    try { vaultPath = (await readFile(path.join(directory, '.vault-path'), 'utf8')).trim(); }
    catch (error) { if (errorCode(error) === 'ENOENT') throw new ConfigurationError('Die Vault-Konfiguration enthält keinen Vault-Pfad. Bitte den Vault erneut verbinden.'); throw error; }
  }
  if (typeof vaultPath !== 'string' || !path.isAbsolute(vaultPath)) throw new ConfigurationError('Die Vault-Konfiguration enthält keinen absoluten Ordnerpfad.');
  if (!Array.isArray(value.retrievalRoots) || !value.retrievalRoots.every((v: unknown) => typeof v === 'string') || !Array.isArray(value.excludePaths) || !value.excludePaths.every((v: unknown) => typeof v === 'string')) throw new ConfigurationError('Ungültige Retrieval-Ordner oder Ausschlüsse.');
  const revision = value.revision === undefined ? 0 : value.revision;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) throw new ConfigurationError('Ungültige Konfigurationsrevision.');
  return { vaultPath, config: { vaultPath, retrievalRoots: value.retrievalRoots as string[], excludePaths: value.excludePaths as string[], appPreferences: normalizeAppPreferences(value.appPreferences), revision } };
}
export async function loadConfig(): Promise<LoadedConfig | null> { return await readConfig(configDir); }
export async function writeConfig(config: VaultConfig): Promise<void> {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const temporary = path.join(configDir, `.vault-config-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(configDir, '.vault-config.json'));
  } finally { try { await unlink(temporary); } catch (error) { if (errorCode(error) !== 'ENOENT') throw error; } }
}
export async function migrateLegacyConfig(): Promise<void> {
  if (process.env.VAULT_MCP_CONFIG_DIR) return;
  await withVaultLock(configDir, async () => {
    if (await loadConfig()) return;
    const legacy = await readConfig(legacyDir);
    if (!legacy) return;
    await writeConfig({ ...legacy.config, revision: 1 });
    console.error(JSON.stringify({ event: 'legacy_config_migrated', from: legacyDir, to: configDir }));
  });
}
export async function legacyConflict(): Promise<string | null> {
  if (process.env.VAULT_MCP_CONFIG_DIR) return null;
  const current = await loadConfig();
  let legacy: LoadedConfig | null;
  try { legacy = await readConfig(legacyDir); }
  catch (error) { return `Die alte Codex-Konfiguration konnte nicht geprüft werden: ${error instanceof Error ? error.message : String(error)}`; }
  if (!current || !legacy) return null;
  const comparable = (config: VaultConfig): string => JSON.stringify({ vaultPath: config.vaultPath, retrievalRoots: config.retrievalRoots, excludePaths: config.excludePaths, appPreferences: config.appPreferences });
  return comparable(current.config) !== comparable(legacy.config) ? 'Die alte Codex-Konfiguration weicht ab. Die gemeinsame Verbindung bleibt aktiv. Zum Übernehmen den alten Vault ausdrücklich auswählen und die Einstellungen prüfen.' : null;
}
/** Preserve usable preferences/revisions when the remaining configuration needs repair. */
export async function configurationSnapshot(): Promise<{ revision: number; appPreferences: AppPreferences }> {
  let value: unknown;
  try { value = JSON.parse(await readFile(path.join(configDir, '.vault-config.json'), 'utf8')); }
  catch (error) { if (errorCode(error) === 'ENOENT' || error instanceof SyntaxError) return { revision: 0, appPreferences: normalizeAppPreferences(undefined) }; throw error; }
  const stored = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const revision = typeof stored.revision === 'number' && Number.isSafeInteger(stored.revision) && stored.revision >= 0 ? stored.revision : 0;
  return { revision, appPreferences: normalizeAppPreferences(stored.appPreferences) };
}
export async function saveConfiguration(validated: VaultScope, expectedRevision: number): Promise<void> {
  let current: LoadedConfig | null;
  try { current = await loadConfig(); }
  catch (error) { if (!(error instanceof SyntaxError) && !(error instanceof ConfigurationError)) throw error; current = null; }
  const snapshot = await configurationSnapshot();
  if (snapshot.revision !== expectedRevision) throw new ConfigurationError('Die Vault-Einstellungen wurden inzwischen geändert. Bitte neu laden und erneut bestätigen.');
  await writeConfig({ vaultPath: validated.vaultPath, ...validated.config, appPreferences: snapshot.appPreferences, revision: expectedRevision + 1 });
}
export async function saveAppPreferences(preferences: Partial<AppPreferences>, expectedRevision: number): Promise<AppPreferences> {
  const current = await loadConfig();
  if (!current) throw new ConfigurationError('Bitte zuerst einen Vault verbinden.');
  if (current.config.revision !== expectedRevision) throw new ConfigurationError('Die Vault-Einstellungen wurden inzwischen geändert. Bitte neu laden.');
  const appPreferences = normalizeAppPreferences({ ...current.config.appPreferences, ...preferences });
  await writeConfig({ ...current.config, appPreferences, revision: expectedRevision + 1 });
  return appPreferences;
}
