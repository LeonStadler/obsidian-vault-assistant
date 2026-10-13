import { app, hostAdapter, session, element, excludes, resultText } from './runtime.js';
import { clearSearch, loadDirectory } from './browser.js';

export function setBusy(value) {
  session.busy = value;
  element("choose").disabled = value;
  element("choose-ready").disabled = value;
  element("connect").disabled = value || !session.selection;
  element("excludes").disabled = value;
  element("save-excludes").disabled = value;
  element("send-handoff").disabled = value || !session.handoff?.content;
  element("manage-vault").disabled = value;
}

export function renderState(state) {
  session.currentState = state;
  element("configuration-notice").hidden = !state.configurationNotice;
  element("configuration-notice").textContent = state.configurationNotice || "";
  if (state?.appMode === "browser" && state.status === "ready") {
    clearSearch();
    document.title = "Obsidian";
    session.selection = null;
    element("title").textContent = "Obsidian";
    element("setup-description").hidden = true;
    element("notice").hidden = true;
    for (const id of ["disconnected", "connected", "selection", "manage-excludes"]) element(id).hidden = true;
    element("browser").hidden = false;
    const preferences = state.appPreferences || { showHiddenFiles: false, allowNoteEditing: true };
    element("settings-vault-path").textContent = state.vaultPath;
    element("settings-show-hidden").checked = preferences.showHiddenFiles;
    element("settings-allow-editing").checked = preferences.allowNoteEditing;
    element("reader-content").readOnly = !preferences.allowNoteEditing;
    element("edit-mode").hidden = !preferences.allowNoteEditing;
    if (!preferences.allowNoteEditing) element("edit-mode").disabled = true;
    else element("edit-mode").disabled = false;
    element("notice").textContent = "Wähle eine Notiz aus. Änderungen werden erst nach Klick auf „Änderungen speichern“ geschrieben.";
    const roots = state.retrievalRoots?.length ? state.retrievalRoots : ["."];
    const rootSelect = element("browser-root");
    rootSelect.replaceChildren(...roots.map((root) => {
      const option = document.createElement("option");
      option.value = root;
      option.textContent = root === "." ? "Gesamter Vault" : root;
      return option;
    }));
    rootSelect.hidden = roots.length < 2;
    session.browserRoot = roots[0];
    session.browserPath = session.browserRoot;
    rootSelect.onchange = () => {
      clearSearch();
      session.browserRoot = rootSelect.value;
      session.browserPath = session.browserRoot;
      element("reader-title").textContent = "Wähle eine Markdown-Notiz";
      element("reader-path").hidden = true;
      element("reader-mode-tabs").hidden = true;
      element("reader-content").hidden = true;
      element("markdown-preview").hidden = true;
      element("reader-actions").hidden = true;
      element("reader-notice").hidden = true;
      element("reader-empty").hidden = false;
      void loadDirectory(session.browserPath);
    };
    void loadDirectory(session.browserPath);
    return;
  }
  element("browser").hidden = true;
  document.title = "Obsidian-Vault verbinden";
  element("setup-description").hidden = false;
  element("notice").hidden = false;
  element("title").textContent = "Obsidian-Vault verbinden";
  if (state?.selection) {
    session.selection = state.selection;
    element("selection-path").textContent = session.selection.vaultPath;
    element("folder-name").textContent = session.selection.vaultPath.split("/").filter(Boolean).at(-1) || session.selection.vaultPath;
    element("selection").hidden = false;
    element("connected").hidden = true;
    element("disconnected").hidden = true;
    element("manage-excludes").hidden = true;
    element("excludes").value = session.selection.excludePaths.join("\n");
    element("unrecognized").hidden = session.selection.recognized;
    element("notice").textContent = session.selection.recognized
      ? "Ordner ausgewählt. Prüfe den Pfad und verbinde den Vault."
      : "Ordner ausgewählt. Prüfe den Hinweis und bestätige die Verbindung.";
    setBusy(false);
    element("connect").focus();
    return;
  }
  session.selection = null;
  element("connect").disabled = true;
  element("selection").hidden = true;
  const ready = state?.status === "ready";
  element("connected").hidden = !ready;
  element("disconnected").hidden = ready;
  element("manage-excludes").hidden = !ready;
  element("notice").textContent = state?.message ?? "Der Status des Vaults konnte nicht gelesen werden.";
  if (ready) {
    element("connected-path").textContent = state.vaultPath;
    element("excludes-existing").value = state.excludePaths.join("\n");
    element("choose").hidden = true;
    element("choose-ready").hidden = false;
  } else {
    element("choose").hidden = false;
    element("choose-ready").hidden = true;
  }
  setBusy(false);
  element(ready ? "choose-ready" : "choose").focus();
}

export async function renderResult(result) {
  if (result.isError) {
    element("notice").textContent = result.content?.map((item) => item.text ?? "").join("\n")
      || "Die Aktion ist fehlgeschlagen. Die bisherige Verbindung bleibt bestehen.";
    setBusy(false);
    return;
  }
  if (["unconfigured", "ready", "unavailable", "invalid"].includes(result.structuredContent?.status)) {
    const state = result.structuredContent;
    if (session.changingVaultFromBrowser && state.status === "ready" && !state.selection) {
      session.changingVaultFromBrowser = false;
      renderState({ ...state, appMode: "browser" });
    } else if (session.changingVaultFromBrowser && state.cancelled) {
      session.changingVaultFromBrowser = false;
      renderState({ ...state, appMode: "browser" });
    } else renderState(state);
  }
}

export async function callTool(name, args) {
  const result = await app.callServerTool({ name, arguments: args });
  await renderResult(result);
  return result;
}

export async function run(action) {
  setBusy(true);
  element("notice").textContent = action === "choose_vault"
    ? "Ordnerauswahl wird geöffnet …"
    : "Vault wird geprüft und verbunden …";
  try {
    const args = action === "connect_vault"
      ? { selectionId: session.selection.selectionId, configRevision: session.currentState?.configRevision, excludePaths: excludes() }
      : {};
    await callTool(action, args);
  } catch (error) {
    element("notice").textContent = error.message || "Die Aktion ist fehlgeschlagen. Die bisherige Verbindung bleibt bestehen.";
    setBusy(false);
  }
}
