import { app, hostAdapter, session, element, excludes, resultText } from './runtime.js';
import { loadDirectory, searchVault } from './browser.js';
import { renderState } from './setup.js';
import { setReaderMode, updateNoteEditState } from './editor.js';

export async function updateAppPreference(preference, value) {
  const previousRevision = session.currentState?.configRevision;
  const result = await app.callServerTool({ name: "settings.update", arguments: { configRevision: session.currentState?.configRevision, set: { [preference]: value } } });
  if (result.isError) throw new Error(resultText(result) || "Die Einstellung konnte nicht gespeichert werden.");
  const fresh = await app.callServerTool({ name: "get_vault_status", arguments: {} });
  if (fresh.isError) throw new Error(resultText(fresh));
  session.currentState = { ...session.currentState, ...fresh.structuredContent };
  if (session.openedRevision === previousRevision) session.openedRevision = session.currentState.configRevision;
}

export async function saveTogglePreference(preference, control, peerControl) {
  const previous = session.currentState?.appPreferences?.[preference] === true;
  control.disabled = true;
  element("settings-notice").hidden = true;
  try {
    await updateAppPreference(preference, control.checked);
    if (peerControl) peerControl.checked = control.checked;
    if (preference === "showHiddenFiles") {
      const query = element("vault-search").value;
      if (query.trim()) await searchVault(query);
      else await loadDirectory(session.browserPath);
    }
    if (preference === "allowNoteEditing" && session.activeNotePath) {
      element("reader-content").readOnly = !control.checked;
      element("edit-mode").hidden = !control.checked;
      if (!control.checked) setReaderMode("preview");
      updateNoteEditState();
    }
    element("settings-notice").textContent = "Einstellung gespeichert.";
  } catch (error) {
    control.checked = previous;
    if (peerControl) peerControl.checked = previous;
    element("settings-notice").textContent = error.message || "Die Einstellung konnte nicht gespeichert werden.";
  } finally {
    control.disabled = false;
    element("settings-notice").hidden = false;
  }
}

export async function refreshConnection() {
  if (session.busy || !session.currentState) return;
  try {
    const result = await app.callServerTool({ name: "get_vault_status", arguments: {} });
    if (result.isError) throw new Error(resultText(result));
    const fresh = result.structuredContent;
    if (fresh.configRevision === session.currentState.configRevision && fresh.status === session.currentState.status) return;
    const old = session.currentState;
    renderState({ ...fresh, appMode: old.appMode });
    if (session.activeNotePath) {
      updateNoteEditState();
      element("reader-notice").hidden = false;
      element("reader-notice").textContent = "Die gemeinsame Vault-Verbindung oder Einstellungen wurden geändert. Dein Entwurf bleibt erhalten. Lade die Notiz vor dem Speichern neu.";
      element("save-note").disabled = true;
    }

  } catch (error) {
    element("settings-notice").hidden = false;
    element("settings-notice").textContent = error.message;
  }
}
