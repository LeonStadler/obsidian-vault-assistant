import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const version = 'v24.21.0';
const base = `https://nodejs.org/dist/${version}`;
const directory = path.resolve('.cache/runtime');
await mkdir(directory, { recursive: true });
const response = await fetch(`${base}/SHASUMS256.txt`);
if (!response.ok) throw new Error(`Node checksum request failed: ${response.status}`);
const sums = await response.text();
for (const architecture of ['arm64', 'x64']) {
  const filename = `node-${version}-darwin-${architecture}.tar.gz`;
  const expected = sums.split('\n').find((line) => line.endsWith(`  ${filename}`))?.split(' ')[0];
  if (!expected) throw new Error(`Missing official checksum for ${filename}`);
  const archive = path.join(directory, filename);
  let bytes;
  try { bytes = await readFile(archive); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== expected) {
    const download = await fetch(`${base}/${filename}`);
    if (!download.ok) throw new Error(`Node download failed: ${filename}, ${download.status}`);
    bytes = Buffer.from(await download.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Node checksum mismatch: ${filename}`);
    await writeFile(archive, bytes);
  }
  const destination = path.join(directory, architecture);
  await mkdir(destination, { recursive: true });
  execFileSync('/usr/bin/tar', ['-xzf', archive, '-C', destination, '--strip-components=1', `node-${version}-darwin-${architecture}/bin/node`, `node-${version}-darwin-${architecture}/LICENSE`]);
  await chmod(path.join(destination, 'bin/node'), 0o755);
  await writeFile(path.join(destination, 'provenance.json'), JSON.stringify({ version, architecture, source: `${base}/${filename}`, sha256: expected }, null, 2) + '\n');
}
