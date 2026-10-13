import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
import { configDir, loadConfig, saveConfiguration, migrateLegacyConfig, DEFAULT_EXCLUDES } from './config-store.js';
import { withVaultLock } from './lock.js';
import { validateConfiguration, verifyReadWrite } from './validation.js';
const execute = promisify(execFile);
const args = process.argv.slice(2);
let candidate: string | undefined;
const roots: string[] = [];
const excludes: string[] = [];
let select = false;
for (let index = 0; index < args.length; index++) {
  const value = args[index];
  if (value === '--select') select = true;
  else if (value === '--retrieval-root' || value === '--exclude') {
    const next = args[++index];
    if (!next) throw new Error(`Missing value for ${value}`);
    (value === '--retrieval-root' ? roots : excludes).push(next);
  } else if (value === '--help' || value === '-h') {
    console.log('configure-vault.sh VAULT_PATH [--retrieval-root PATH] [--exclude PATH]\nconfigure-vault.sh --select');
    process.exit(0);
  } else if (value.startsWith('-') || candidate) throw new Error(`Invalid argument: ${value}`);
  else candidate = value;
}
if (select && candidate) throw new Error('Use either --select or VAULT_PATH.');
if (!candidate) {
  if (process.platform !== 'darwin') throw new Error('Native folder selection requires macOS. Pass VAULT_PATH explicitly.');
  try {
    candidate = (await execute('/usr/bin/osascript', ['-e', 'POSIX path of (choose folder with prompt "Obsidian-Vault auswählen")'])).stdout.trim();
    await execute('/usr/bin/osascript', ['-e', 'display dialog "Den ausgewählten Vault für alle Anwendungen verbinden?" buttons {"Abbrechen", "Verbinden"} default button "Verbinden" cancel button "Abbrechen"']);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'stderr' in error && String(error.stderr).includes('(-128)')) { console.log('Auswahl abgebrochen. Die Verbindung bleibt unverändert.'); process.exit(0); }
    throw error;
  }
}
await migrateLegacyConfig();
const selectedPath = await realpath(candidate);
await withVaultLock(configDir, async () => {
  const current = await loadConfig();
  const same = current?.vaultPath === selectedPath;
  const scope = await validateConfiguration(selectedPath, { retrievalRoots: roots.length ? roots : same ? current.config.retrievalRoots : ['.'], excludePaths: excludes.length ? excludes : current?.config.excludePaths || DEFAULT_EXCLUDES });
  await verifyReadWrite(scope);
  await saveConfiguration(scope, current?.config.revision || 0);
  console.log(`Vault verbunden: ${scope.vaultPath}`);
});
