const CODEX_PLUGIN_ID = "obsidian-vault-assistant";
const CODEX_MARKETPLACE = "local-plugins";
const MAX_SELECTION_LENGTH = 6000;

function encodeHandoffPath(route) {
  const encodedTool = encodeURIComponent("open_vault_context");
  const encodedAppPath = encodeURIComponent(route);
  return `codex://plugins/${encodeURIComponent(CODEX_PLUGIN_ID)}@${encodeURIComponent(CODEX_MARKETPLACE)}/app/${encodedTool}?path=${encodedAppPath}`;
}

function buildHandoffRoute(filePath, title, selection) {
  const query = new URLSearchParams();
  query.set("notePath", filePath);
  query.set("title", title);
  if (selection !== undefined) query.set("selection", selection);
  return `/handoff?${query.toString()}`;
}

function openCodex(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export default class ObsidianCodexBridge extends Plugin {
  onload() {
    this.addCommand({
      id: "send-active-note-to-codex",
      name: "Obsidian-Notiz an aktuellen Codex-Chat senden",
      callback: () => this.sendActiveNote(),
    });
    this.addCommand({
      id: "send-selection-to-codex",
      name: "Textauswahl an aktuellen Codex-Chat senden",
      editorCallback: (editor, view) => this.sendSelection(editor, view),
    });
  }

  sendActiveNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice("Öffne eine Markdown-Notiz, bevor du sie an Codex sendest.");
      return;
    }
    openCodex(encodeHandoffPath(buildHandoffRoute(file.path, file.basename)));
    new Notice("Die Notiz wird in Codex zur Kontrolle geöffnet. Sende sie dort ausdrücklich an den Chat.");
  }

  sendSelection(editor, view) {
    const selectedText = editor.getSelection();
    if (!selectedText.trim()) {
      new Notice("Markiere Text in einer Markdown-Notiz, bevor du ihn an Codex sendest.");
      return;
    }
    if (selectedText.length > MAX_SELECTION_LENGTH) {
      new Notice(`Die Auswahl ist zu lang. Markiere höchstens ${MAX_SELECTION_LENGTH} Zeichen.`);
      return;
    }
    const file = view.file;
    if (!file || file.extension !== "md") {
      new Notice("Der aktuelle Editor zeigt keine Markdown-Notiz.");
      return;
    }
    openCodex(encodeHandoffPath(buildHandoffRoute(file.path, file.basename, selectedText)));
    new Notice("Die Auswahl wird in Codex zur Kontrolle geöffnet. Sende sie dort ausdrücklich an den Chat.");
  }

}
import { Notice, Plugin } from "obsidian";
