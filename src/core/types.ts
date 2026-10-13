export interface AppPreferences { showHiddenFiles: boolean; allowNoteEditing: boolean }
export interface VaultConfig { vaultPath: string; retrievalRoots: string[]; excludePaths: string[]; appPreferences: AppPreferences; revision: number }
export interface ScopeConfig { retrievalRoots: string[]; excludePaths: string[] }
export interface VaultScope { vaultPath: string; config: ScopeConfig; resolvedRoots: string[]; resolvedExcludes: string[] }
export interface LoadedConfig { vaultPath: string; config: VaultConfig }
export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

export class ConfigurationError extends Error { constructor(message: string) { super(message); this.name = 'ConfigurationError'; } }
