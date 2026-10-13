import { mkdtemp, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const architecture = process.arch;
if (!['arm64','x64'].includes(architecture) || process.platform !== 'darwin') throw new Error('Host acceptance packages require macOS.');
const root = await mkdtemp(path.join(os.tmpdir(),'vault-host-acceptance-'));
const config = path.join(root,'config');
const vault = path.join(root,'Test Vault');
await mkdir(config);
await mkdir(path.join(vault,'.obsidian'),{recursive:true});
await mkdir(path.join(vault,'Projekte'));
await writeFile(path.join(vault,'Testnotiz.md'),'# Abnahmetest\n\nDiese Notiz enthält ausschließlich künstliche Testdaten.\n\n**Markdown-Vorschau** und ausdrückliches Speichern prüfen.\n');
await writeFile(path.join(vault,'Projekte','Projekt.md'),'# Testprojekt\n\nNur für die Plugin-Abnahme.\n');
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
for (const host of ['claude-desktop','cursor']) {
  const source = path.resolve(`dist/obsidian-vault-assistant-${host}-darwin-${architecture}`);
  const destination = path.join(root,host);
  await cp(source,destination,{recursive:true});
  const launcherPath = path.join(destination,'scripts/launch-host.sh');
  const launcher = await readFile(launcherPath,'utf8');
  await writeFile(launcherPath,launcher.replace('exec /bin/bash',`export VAULT_MCP_CONFIG_DIR=${shellQuote(config)}\nexec /bin/bash`),{mode:0o755});
  const metadata = JSON.parse(await readFile(path.join(destination,'plugin.json'),'utf8'));
  metadata.name='obsidian-vault-assistant-acceptance';
  await writeFile(path.join(destination,'plugin.json'),JSON.stringify(metadata,null,2)+'\n');
  if(host==='claude-desktop'){
    const manifest = JSON.parse(await readFile(path.join(destination,'manifest.json'),'utf8'));
    manifest.name=metadata.name;
    manifest.display_name='Obsidian Vault Assistant — Abnahmetest';
    manifest.description='Isolierter Test mit künstlichen Notizen; kein Zugriff auf den persönlichen Vault.';
    await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    execFileSync('/usr/bin/zip',['-q','-r',path.join(root,'Obsidian-Abnahmetest.mcpb'),'.'],{cwd:destination});
  } else {
    const manifestPath=path.join(destination,'.cursor-plugin/plugin.json');
    const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    manifest.name=metadata.name;
    await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
    const marketplacePath=path.join(destination,'.cursor-plugin/marketplace.json');
    const marketplace=JSON.parse(await readFile(marketplacePath,'utf8'));
    marketplace.plugins[0].name=metadata.name;
    await writeFile(marketplacePath,JSON.stringify(marketplace,null,2)+'\n');
  }
}
await writeFile(path.resolve('.cache/host-acceptance.json'),JSON.stringify({root,config,vault,claudeBundle:path.join(root,'Obsidian-Abnahmetest.mcpb'),cursorPlugin:path.join(root,'cursor')},null,2)+'\n');
console.log(JSON.stringify({root,config,vault,claudeBundle:path.join(root,'Obsidian-Abnahmetest.mcpb'),cursorPlugin:path.join(root,'cursor')},null,2));
