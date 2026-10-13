import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'acorn';
for (const file of ['ui/vault-setup.js', ... (await readdir('ui/controllers')).filter(name => name.endsWith('.js')).map(name => `ui/controllers/${name}`)]) {
  parse(await readFile(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
}
