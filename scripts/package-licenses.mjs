import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
/** Include dependency notices in distribution packages, separate from Node's own LICENSE. */
export async function dependencyNotices() {
  const directories = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { encoding: 'utf8' }).trim().split('\n').slice(1);
  const notices = [];
  for (const directory of [...new Set(directories)].sort()) {
    const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const files = (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice)([-_.]|$)/i.test(name));
    const external = { '@cfworker/json-schema': 'licenses/cfworker-MIT.txt', '@modelcontextprotocol/server-filesystem': 'licenses/mcp-servers-MIT.txt' };
    if (!files.length && !external[metadata.name]) throw new Error(`Missing dependency license: ${metadata.name}@${metadata.version}`);
    const texts = [];
    if (!files.length) texts.push(await readFile(external[metadata.name], 'utf8'));
    for (const file of files) texts.push(await readFile(path.join(directory, file), 'utf8'));
    notices.push(`${metadata.name}@${metadata.version}\n${texts.join('\n')}\n`);
  }
  return notices.join('\n---\n\n');
}
