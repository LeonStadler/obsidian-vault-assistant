import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(await readFile('schemas/mcpb-manifest-v0.3.schema.json','utf8')));
const version = JSON.parse(await readFile('package.json','utf8')).version;
for (const architecture of ['arm64','x64']) {
  for (const host of ['openai','cursor','claude-desktop','claude-code','generic']) {
    const root = `dist/obsidian-vault-assistant-${host}-darwin-${architecture}`;
    const metadata = JSON.parse(await readFile(`${root}/plugin.json`,'utf8'));
    if (metadata.version !== version || metadata.name !== 'obsidian-vault-assistant') throw new Error(`Inconsistent package: ${root}`);
    const runtime = JSON.parse(await readFile(`${root}/runtime/provenance.json`,'utf8'));
    if (runtime.version !== 'v24.21.0' || runtime.architecture !== architecture) throw new Error(`Inconsistent runtime: ${root}`);
    if (host === 'claude-desktop') {
      const manifest = JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
      if (!validate(manifest)) throw new Error(`MCPB schema mismatch: ${JSON.stringify(validate.errors)}`);
    }
    if (host === 'cursor') {
      const marketplace = JSON.parse(await readFile(`${root}/.cursor-plugin/marketplace.json`,'utf8'));
      if (marketplace.plugins.length !== 1 || marketplace.plugins[0].name !== metadata.name || marketplace.plugins[0].source !== '.') throw new Error('Cursor marketplace manifest is inconsistent.');
    }
    if (host === 'openai') {
      const overlay = JSON.parse(await readFile(`${root}/.codex-plugin/plugin.json`, 'utf8'));
      if (overlay.version.split('+')[0] !== version || overlay.extensions?.['com.openai']?.onboardingSkill !== metadata.extensions['com.openai'].onboardingSkill) throw new Error('OpenAI compatibility manifest is inconsistent.');
    }
    const mcp = JSON.parse(await readFile(`${root}/mcp.json`,'utf8'));
    const argument = mcp.mcpServers.obsidianVaultFilesystem.args[0];
    if (host === 'cursor' && !argument.startsWith('${CURSOR_PLUGIN_ROOT}')) throw new Error('Cursor path placeholder is invalid.');
    if (host === 'claude-code' && !argument.startsWith('${CLAUDE_PLUGIN_ROOT}')) throw new Error('Claude Code path placeholder is invalid.');
  }
}
console.log('All ten packages have consistent identities, versions, runtimes and host configuration; both MCPB schemas validate.');
