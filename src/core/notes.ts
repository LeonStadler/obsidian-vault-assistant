import { readFile, writeFile, stat, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { errorCode, type VaultScope } from './types.js';
import { validateScopedPath } from './scope.js';
export const MAX_EDITABLE_NOTE_CHARS = 200000;
export async function saveNote(scope: VaultScope, relativePath: string, expectedContent: string, content: string): Promise<void> {
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').some((part) => part === '..' || part === '')) throw new Error('Bitte einen gültigen relativen Notizpfad innerhalb des verbundenen Vaults angeben.');
  if (path.extname(relativePath).toLowerCase() !== '.md') throw new Error('In dieser Ansicht können nur Markdown-Notizen mit der Endung .md bearbeitet werden.');
  if (typeof expectedContent !== 'string' || typeof content !== 'string') throw new Error('Der Notizinhalt konnte nicht verarbeitet werden.');
  if (expectedContent.length > MAX_EDITABLE_NOTE_CHARS || content.length > MAX_EDITABLE_NOTE_CHARS) throw new Error('Notizen können hier bis maximal 200.000 Zeichen bearbeitet werden.');
  const absolutePath = await validateScopedPath(scope, path.resolve(scope.vaultPath, relativePath));
  const original = await stat(absolutePath);
  if (!original.isFile()) throw new Error('Der ausgewählte Pfad ist keine Notizdatei.');
  if (await readFile(absolutePath, 'utf8') !== expectedContent) throw new Error('Diese Notiz wurde seit dem Öffnen geändert. Dein Entwurf ist noch vorhanden; lade die aktuelle Version neu, bevor du weiter speicherst.');
  const temporary = path.join(path.dirname(absolutePath), `.vault-note-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, { mode: original.mode, flag: 'wx' });
    // Recheck immediately before rename, also catching external Obsidian edits.
    const latest = await stat(absolutePath);
    if (latest.ino !== original.ino || latest.mtimeMs !== original.mtimeMs || await readFile(absolutePath, 'utf8') !== expectedContent) throw new Error('Diese Notiz wurde während des Speicherns geändert. Bitte neu laden.');
    await validateScopedPath(scope, absolutePath);
    await rename(temporary, absolutePath);
  } finally { try { await unlink(temporary); } catch (error) { if (errorCode(error) !== 'ENOENT') throw error; } }
}
