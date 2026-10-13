import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
const execute = promisify(execFile);
export async function selectVaultFolder(explicitPath: unknown): Promise<string | null> {
  if (explicitPath !== undefined && (typeof explicitPath !== 'string' || !explicitPath.trim())) throw new Error('Bitte einen vollständigen Vault-Ordnerpfad angeben.');
  const candidate = explicitPath || process.env.VAULT_MCP_VAULT_CANDIDATE;
  if (typeof candidate === 'string' && candidate) return await realpath(candidate);
  if (process.platform !== 'darwin') throw new Error('Die native Ordnerauswahl ist nur auf macOS verfügbar. Bitte einen absoluten Vault-Pfad angeben.');
  try {
    const result = await execute('osascript', ['-e', 'POSIX path of (choose folder with prompt "Wähle deinen Obsidian-Vault")']);
    if (!result.stdout.trim()) throw new Error('Es wurde kein Vault-Ordner ausgewählt.');
    return await realpath(result.stdout.trim());
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'stderr' in error && String(error.stderr).includes('(-128)')) return null;
    throw error;
  }
}
