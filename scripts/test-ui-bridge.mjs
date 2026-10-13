import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/ext-apps';
const directory = await mkdtemp(path.join(os.tmpdir(),'vault-ui-bridge-'));
const vault = path.join(directory,'vault');
const config = path.join(directory,'config');
await mkdir(vault); await mkdir(config);
await writeFile(path.join(vault,'Note.md'),'# Title\n\n**Bold**\n\n<script>alert("unsafe")</script>');
await writeFile(path.join(config,'.vault-config.json'),JSON.stringify({vaultPath:vault,retrievalRoots:['.'],excludePaths:['.git'],appPreferences:{showHiddenFiles:false,allowNoteEditing:true}}));
const client = new Client({name:'ui-integration',version:'1'});
await client.connect(new StdioClientTransport({command:'/bin/bash',args:[path.resolve('scripts/start-vault-mcp.sh')],env:{...process.env,VAULT_MCP_CONFIG_DIR:config},stderr:'inherit'}));
const html = await readFile('ui/vault-setup.bundle.html','utf8');
let checks=0;
async function waitFor(condition, description) {
  const deadline=Date.now()+5000;
  while(!condition()) { if(Date.now()>deadline)throw new Error(`UI did not reach: ${description}`); await new Promise(resolve=>setTimeout(resolve,20)); }
  checks++;console.log(`[PASS] ${description}`);
}
try {
 for(const profile of ['openai','standard','tools-only','openai-deep-link']) {
  const sent=[];const errors=[];
  const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message));
  const initial=await client.callTool({name:'open_vault_context',arguments:{}});
  let dom;
  const parent={postMessage: async message=>{
   try {
    let result;
    if(message.method==='ui/initialize') result={protocolVersion:LATEST_PROTOCOL_VERSION,hostInfo:{name:profile,version:'test-harness'},hostCapabilities:{serverTools:{},...(profile==='openai'?{experimental:{'openai/message':{}}}:profile==='standard'?{message:{}}:{})},hostContext:{theme:'dark',displayMode:'inline',...(profile==='openai-deep-link'?{'openai/deepLink':{url:'/handoff?notePath=Note.md'}}:{})}};
    else if(message.method==='tools/call') result=await client.callTool(message.params);
    else if(message.method==='ui/message'||message.method==='openai/message') {sent.push(message.params);result={};}
    else if(message.method==='ui/notifications/initialized') {
      dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{jsonrpc:'2.0',method:'ui/notifications/tool-result',params:initial},source:parent}));return;
    } else if(message.id===undefined)return;
    else throw new Error(`Unexpected bridge method ${message.method}`);
    dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{jsonrpc:'2.0',id:message.id,result},source:parent}));
   } catch(error) {errors.push(error.message); if(dom)dom.window.dispatchEvent(new dom.window.MessageEvent('message',{data:{jsonrpc:'2.0',id:message.id,error:{code:-32603,message:error.message}},source:parent}));}
  }};
  dom=new JSDOM(html,{runScripts:'dangerously',url:'https://vault-ui.test',pretendToBeVisual:true,virtualConsole,beforeParse(window){Object.defineProperty(window,'parent',{value:parent});window.ResizeObserver=class { observe() {} disconnect() {} };}});
  const document=dom.window.document;
  if (profile === 'openai-deep-link') {
    await waitFor(() => !document.getElementById('handoff').hidden && document.getElementById('handoff-content').value.includes('Title'), 'openai: deep-link context without message capability');
    assert.equal(sent.length, 0);
    assert.deepEqual(errors, []);
    dom.window.close();
    continue;
  }
  await waitFor(()=>!document.getElementById('browser').hidden,`${profile}: initial tool result renders browser`);
  await waitFor(()=>document.querySelector('button[data-path="Note.md"]'),`${profile}: real MCP directory listing`);
  document.querySelector('button[data-path="Note.md"]').click();
  await waitFor(()=>!document.getElementById('reader-content').hidden,`${profile}: read note`);
  if (profile === 'openai') {
    await client.callTool({ name: 'settings.update', arguments: { set: { showHiddenFiles: true } } });
    dom.window.dispatchEvent(new dom.window.Event('focus'));
    await waitFor(() => document.getElementById('settings-show-hidden').checked, 'openai: settings from another host refresh in UI');
    document.getElementById('reader-content').value = '# Draft';
    document.getElementById('reader-content').dispatchEvent(new dom.window.Event('input'));
    assert.equal(document.getElementById('save-note').disabled, true);
    document.getElementById('reload-note').click();
    await waitFor(() => document.getElementById('reader-content').value.includes('Title'), 'openai: stale draft requires explicit reload');
  }
  document.getElementById('preview-mode').click();
  assert.equal(document.querySelector('#markdown-preview strong')?.textContent,'Bold');
  assert.equal(document.querySelector('#markdown-preview script'),null);
  assert.equal(sent.length,0);
  checks++;console.log(`[PASS] ${profile}: preview and no automatic context transmission`);
  if(profile==='tools-only') assert.equal(document.getElementById('add-note-context').disabled,true);
  else {
    document.getElementById('add-note-context').click();
    await waitFor(()=>sent.length===1,`${profile}: explicit context handoff`);
    assert.ok(sent[0].content[0].text.includes('Note.md'));
  }
  document.getElementById('edit-mode').click();
  document.getElementById('reader-content').value='# Edited';
  document.getElementById('reader-content').dispatchEvent(new dom.window.Event('input'));
  document.getElementById('save-note').click();
  await waitFor(()=>document.getElementById('reader-notice').textContent==='Notiz gespeichert.',`${profile}: editor saves through real MCP`);
  assert.equal(await readFile(path.join(vault,'Note.md'),'utf8'),'# Edited');
  assert.deepEqual(errors,[]);
  dom.window.close();
  await writeFile(path.join(vault,'Note.md'),'# Title\n\n**Bold**\n\n<script>alert("unsafe")</script>');
 }
 console.log(`Summary: ${checks} UI bridge integration checks passed (simulated host, real MCP server).`);
} finally { await client.close(); await rm(directory,{recursive:true,force:true}); }
