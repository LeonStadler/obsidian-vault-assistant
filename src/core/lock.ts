import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { lock } from 'proper-lockfile';
import { errorCode } from './types.js';

/** One shared, heartbeat-maintained lock protects config and file operations in all hosts. */
export async function withVaultLock<T>(directory: string, action: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let release: () => Promise<void>;
  try {
    release = await lock(directory, {
      realpath: false,
      lockfilePath: path.join(directory, '.operation-lock'),
      stale: 30000,
      update: 10000,
      retries: { retries: 60, factor: 1, minTimeout: 250, maxTimeout: 250, randomize: false },
    });
  } catch (error) {
    if (errorCode(error) !== 'ELOCKED') throw error;
    throw new Error('Der Vault wird gerade von einer anderen Anwendung verwendet. Bitte erneut versuchen.', { cause: error });
  }
  try { return await action(); }
  finally { await release(); }
}
