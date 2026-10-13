import { mkdir, cp, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dependencyNotices } from './package-licenses.mjs';
const metadata = JSON.parse(await readFile('plugin.json', 'utf8'));
const root = path.resolve('dist');
const sourceBundleSha256 = createHash('sha256').update(await readFile('scripts/vault-mcp-server.bundle.mjs')).digest('hex');
await mkdir(root, { recursive: true });
const notices = await dependencyNotices();
for (const architecture of ['arm64', 'x64']) {
  for (const host of ['openai', 'cursor', 'claude-desktop', 'claude-code', 'generic']) {
    const name = `obsidian-vault-assistant-${host}-darwin-${architecture}`;
    const destination = path.join(root, name);
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination);
    for (const item of ['package.json','plugin.json','skills','assets','LICENSE','INSTALL.md','docs','ui/vault-setup.bundle.html']) {
      await mkdir(path.dirname(path.join(destination,item)), { recursive:true });
      await cp(item,path.join(destination,item),{recursive:true});
    }
    await writeFile(path.join(destination,'THIRD-PARTY-LICENSES.txt'), notices);
    await mkdir(path.join(destination,'scripts'));
    for (const item of ['start-vault-mcp.sh','configure-vault.sh','vault-mcp-server.bundle.mjs','filesystem-server.bundle.mjs','configure-vault.bundle.mjs']) await cp(`scripts/${item}`,path.join(destination,'scripts',item));
    await cp(`.cache/runtime/${architecture}`,path.join(destination,'runtime'),{recursive:true});
    const launcher = `#!/bin/bash\nset -euo pipefail\nplugin_dir="$(cd "$(dirname "$0")/.." && pwd -P)"\nexport VAULT_MCP_HOST=${host}\nexec /bin/bash "$plugin_dir/scripts/start-vault-mcp.sh" "$@"\n`;
    await writeFile(path.join(destination,'scripts/launch-host.sh'),launcher,{mode:0o755});
    let variable='${PLUGIN_ROOT}';
    if(host==='cursor')variable='${CURSOR_PLUGIN_ROOT}';
    if(host==='claude-code')variable='${CLAUDE_PLUGIN_ROOT}';
    const mcp={mcpServers:{obsidianVaultFilesystem:{command:'/bin/bash',args:[`${variable}/scripts/launch-host.sh`]}}};
    await writeFile(path.join(destination,'mcp.json'),JSON.stringify(mcp,null,2)+'\n');
    await writeFile(path.join(destination,'.mcp.json'),JSON.stringify(mcp,null,2)+'\n');
    const minimal={name:metadata.name,version:metadata.version,description:metadata.description,author:metadata.author,skills:'./skills'};
    if(host==='openai')await cp('.codex-plugin',path.join(destination,'.codex-plugin'),{recursive:true});
    if(host==='cursor'){
      await mkdir(path.join(destination,'.cursor-plugin'));
      await writeFile(path.join(destination,'.cursor-plugin/plugin.json'),JSON.stringify({...minimal,mcpServers:'./mcp.json'},null,2)+'\n');
      await writeFile(path.join(destination,'.cursor-plugin/marketplace.json'),JSON.stringify({name:'obsidian-vault-assistant-marketplace',owner:{name:metadata.author.name},metadata:{description:'Obsidian Vault Assistant for Cursor'},plugins:[{name:metadata.name,source:'.',description:metadata.description,version:metadata.version,author:metadata.author,license:metadata.license}]},null,2)+'\n');
    }
    if(host==='claude-code'){
      await mkdir(path.join(destination,'.claude-plugin'));
      await writeFile(path.join(destination,'.claude-plugin/plugin.json'),JSON.stringify(minimal,null,2)+'\n');
    }
    await writeFile(path.join(destination,'BUILD-INFO.json'),JSON.stringify({version:metadata.version,host,architecture,runtime:'v24.21.0',sourceBundleSha256,developmentBuild:true,signing:'not-verified',publicationReady:false},null,2)+'\n');
    if(host==='claude-desktop'){
      const manifest={manifest_version:'0.3',name:metadata.name,display_name:'Obsidian Vault Assistant',version:metadata.version,description:metadata.description,author:metadata.author,server:{type:'binary',entry_point:'scripts/launch-host.sh',mcp_config:{command:'/bin/bash',args:['${__dirname}/scripts/launch-host.sh'],env:{VAULT_MCP_VAULT_CANDIDATE:'${user_config.vault_folder}'}}},compatibility:{platforms:['darwin']},user_config:{vault_folder:{type:'directory',title:'Obsidian-Vault (optional)',description:'Nur eine Vorauswahl. Erst im Vault-Setup ausdrücklich verbinden.',required:false}},license:metadata.license};
      await writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
      execFileSync('/usr/bin/zip',['-q','-r','-FS',path.join(root,`${name}.mcpb`),'.'],{cwd:destination});
    } else {
      execFileSync('/usr/bin/tar',['-czf',path.join(root,`${name}.tar.gz`),'-C',root,name]);
    }

  }
}
console.log('Built local test packages for five host profiles and both macOS architectures in dist/.');
