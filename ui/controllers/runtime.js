import { App } from '@modelcontextprotocol/ext-apps';
import { createHostAdapter } from '../hosts/adapter.ts';
export const app = new App({ name: 'obsidian-vault-assistant', version: '0.16.0' });
export const hostAdapter = createHostAdapter(app);
export const session = {
currentState: null,
selection: null,
handoff: null,
activeDeepLink: "",
busy: false,
browserRoot: ".",
browserPath: ".",
activeNotePath: "",
openedRevision: null,
savedNoteContent: "",
savedNoteEditorValue: "",
changingVaultFromBrowser: false,
searchTimer: null,
searchRequestId: 0
};
export const element = (id) => document.getElementById(id);
export const excludes = () => element('excludes').value.split('\n').map(value=>value.trim()).filter(Boolean);
export function resultText(result) { return result.content?.filter(item=>item.type==='text').map(item=>item.text || '').join('\n') || ''; }
