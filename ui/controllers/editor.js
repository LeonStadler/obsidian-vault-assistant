import { app, hostAdapter, session, element, excludes, resultText } from './runtime.js';
import { renderSafeMarkdown } from '../markdown-preview.js';
import { absoluteVaultPath } from './browser.js';

export function renderMarkdownPreview() {
  const safeFragment = renderSafeMarkdown(element("reader-content").value);
  element("markdown-preview").replaceChildren(safeFragment);
}

export function setReaderMode(mode) {
  const previewMode = mode === "preview" || session.currentState?.appPreferences?.allowNoteEditing === false;
  element("reader-content").hidden = previewMode;
  element("markdown-preview").hidden = !previewMode;
  element("edit-mode").setAttribute("aria-pressed", String(!previewMode));
  element("preview-mode").setAttribute("aria-pressed", String(previewMode));
  if (previewMode) renderMarkdownPreview();
}

export async function openNote(relativePath) {
  session.activeNotePath = relativePath;
  element("reader-title").textContent = relativePath.split("/").at(-1) || relativePath;
  element("reader-path").textContent = `/${relativePath}`;
  element("reader-path").hidden = false;
  for (const button of element("browser-list").querySelectorAll("button[data-path]")) {
    button.classList.toggle("selected", button.dataset.path === relativePath);
  }
  element("reader-content").hidden = true;
  element("reader-mode-tabs").hidden = true;
  element("markdown-preview").hidden = true;
  element("reader-actions").hidden = true;
  element("reader-notice").hidden = true;
  element("reader-empty").hidden = false;
  element("reader-empty").textContent = "Notiz wird geladen …";
  try {
    const result = await app.callServerTool({ name: "read_text_file", arguments: { path: absoluteVaultPath(relativePath) } });
    if (result.isError) throw new Error(resultText(result) || "Die Notiz konnte nicht gelesen werden.");
    session.openedRevision = session.currentState?.configRevision;
    session.savedNoteContent = resultText(result);
    element("reader-content").value = session.savedNoteContent;
    session.savedNoteEditorValue = element("reader-content").value;
    element("reader-mode-tabs").hidden = false;
    element("reader-content").hidden = false;
    element("edit-mode").hidden = session.currentState?.appPreferences?.allowNoteEditing === false;
    element("reader-content").readOnly = session.currentState?.appPreferences?.allowNoteEditing === false;
    setReaderMode(session.currentState?.appPreferences?.allowNoteEditing === false ? "preview" : "edit");
    element("reader-actions").hidden = false;
    element("reload-note").hidden = true;
    element("add-note-context").disabled = !hostAdapter.canSendContext || !session.savedNoteContent.trim();
    element("add-note-context").title = hostAdapter.canSendContext ? "" : "Diese Anwendung unterstützt die Kontextübergabe aus MCP-Apps nicht.";
    if (!hostAdapter.canSendContext) { element("reader-notice").hidden = false; element("reader-notice").textContent = "Die Kontextübergabe wird von dieser Anwendung nicht unterstützt."; }
    element("save-note").disabled = true;
    element("reader-empty").hidden = true;
  } catch (error) {
    element("reader-empty").textContent = error.message || "Die Notiz konnte nicht gelesen werden.";
  }
}

export function updateNoteEditState() {
  const content = element("reader-content").value;
  const changed = content !== session.savedNoteEditorValue;
  const stale = session.openedRevision !== session.currentState?.configRevision;
  const canEdit = session.currentState?.appPreferences?.allowNoteEditing !== false && !stale;
  element("save-note").disabled = session.busy || !changed || !canEdit;
  element("save-note").hidden = !canEdit;
  element("reload-note").hidden = !stale && (!changed || !canEdit);
  element("add-note-context").disabled = !hostAdapter.canSendContext || !content.trim();
}

export async function saveNote() {
  if (!session.activeNotePath || element("save-note").disabled) return;
  const content = element("reader-content").value;
  element("save-note").disabled = true;
  element("reload-note").disabled = true;
  element("reader-notice").hidden = false;
  element("reader-notice").textContent = "Notiz wird gespeichert …";
  try {
    const result = await app.callServerTool({
      name: "save_vault_note_from_app",
      arguments: { configRevision: session.openedRevision, path: session.activeNotePath, expectedContent: session.savedNoteContent, content },
    });
    if (result.isError) throw new Error(resultText(result) || "Die Notiz konnte nicht gespeichert werden.");
    session.savedNoteContent = content;
    session.savedNoteEditorValue = content;
    element("reader-notice").textContent = "Notiz gespeichert.";
    element("reader-content").focus();
  } catch (error) {
    element("reader-notice").textContent = error.message || "Die Notiz konnte nicht gespeichert werden.";
  } finally {
    element("reload-note").disabled = false;
    updateNoteEditState();
  }
}

export async function reloadNote() {
  if (!session.activeNotePath) return;
  await openNote(session.activeNotePath);
  element("reader-notice").textContent = "Aktueller Inhalt neu geladen; der lokale Entwurf wurde verworfen.";
  element("reader-notice").hidden = false;
}

export async function addNoteContext() {
  if (!session.activeNotePath || !hostAdapter.canSendContext) {
    element("reader-notice").hidden = false;
    element("reader-notice").textContent = "Diese Anwendung unterstützt das Senden an den aktiven Chat in MCP-Apps nicht.";
    return;
  }
  const editor = element("reader-content");
  const editorSelection = editor.hidden ? "" : editor.value.slice(editor.selectionStart, editor.selectionEnd);
  const browserSelection = window.getSelection();
  const previewSelection = editor.hidden && browserSelection?.rangeCount > 0
    && element("markdown-preview").contains(browserSelection.getRangeAt(0).commonAncestorContainer)
    ? browserSelection.toString()
    : "";
  const selected = editorSelection || previewSelection;
  const content = selected || editor.value;
  if (!content.trim()) return;
  if (content.length > 24000) {
    element("reader-notice").hidden = false;
    element("reader-notice").textContent = "Der Inhalt ist länger als 24.000 Zeichen. Markiere bitte einen kürzeren Abschnitt.";
    return;
  }
  element("add-note-context").disabled = true;
  element("reader-notice").hidden = false;
  element("reader-notice").textContent = "Vault-Kontext wird an den aktuellen Chat gesendet …";
  try {
    await hostAdapter.sendContext({
      role: "user",
      content: [{ type: "text", text: `Ich übergebe dir folgenden Obsidian-Kontext. Bitte nutze ihn für meine aktuelle Anfrage.\nTitel: ${element("reader-title").textContent}\nVault-Notiz: ${session.activeNotePath}${selected ? "\nAuswahl aus der Notiz" : ""}\n\n${content}` }],
    });
    element("reader-notice").textContent = selected
      ? "Die markierte Auswahl wurde in den aktuellen Chat übernommen."
      : "Die Notiz wurde in den aktuellen Chat übernommen.";
  } catch (error) {
    element("reader-notice").textContent = error.message || "Der Vault-Kontext konnte nicht an den aktuellen Chat gesendet werden.";
  } finally {
    updateNoteEditState();
  }
}
