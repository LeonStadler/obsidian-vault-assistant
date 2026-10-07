import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";
import { renderSafeMarkdown } from "./markdown-preview.js";

const app = new App({ name: "obsidian-vault-assistant", version: "0.13.0" });
const openaiExtensions = new OpenAIExtensions(app);
let currentState = null;
let selection = null;
let handoff = null;
let activeDeepLink = "";
let busy = false;
let browserRoot = ".";
let browserPath = ".";
let activeNotePath = "";
let savedNoteContent = "";
let savedNoteEditorValue = "";
let changingVaultFromBrowser = false;
let searchTimer = null;
let searchRequestId = 0;

const element = (id) => document.getElementById(id);
const excludes = () => element("excludes").value.split("\n").map((value) => value.trim()).filter(Boolean);

function setBusy(value) {
  busy = value;
  element("choose").disabled = value;
  element("choose-ready").disabled = value;
  element("connect").disabled = value || !selection;
  element("excludes").disabled = value;
  element("save-excludes").disabled = value;
  element("send-handoff").disabled = value || !handoff?.content;
  element("manage-vault").disabled = value;
}

function renderState(state) {
  currentState = state;
  if (state?.appMode === "browser" && state.status === "ready") {
    clearSearch();
    document.title = "Obsidian";
    selection = null;
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
    browserRoot = roots[0];
    browserPath = browserRoot;
    rootSelect.onchange = () => {
      clearSearch();
      browserRoot = rootSelect.value;
      browserPath = browserRoot;
      element("reader-title").textContent = "Wähle eine Markdown-Notiz";
      element("reader-path").hidden = true;
      element("reader-mode-tabs").hidden = true;
      element("reader-content").hidden = true;
      element("markdown-preview").hidden = true;
      element("reader-actions").hidden = true;
      element("reader-notice").hidden = true;
      element("reader-empty").hidden = false;
      void loadDirectory(browserPath);
    };
    void loadDirectory(browserPath);
    return;
  }
  element("browser").hidden = true;
  document.title = "Obsidian-Vault verbinden";
  element("setup-description").hidden = false;
  element("notice").hidden = false;
  element("title").textContent = "Obsidian-Vault verbinden";
  if (state?.selection) {
    selection = state.selection;
    element("selection-path").textContent = selection.vaultPath;
    element("folder-name").textContent = selection.vaultPath.split("/").filter(Boolean).at(-1) || selection.vaultPath;
    element("selection").hidden = false;
    element("connected").hidden = true;
    element("disconnected").hidden = true;
    element("manage-excludes").hidden = true;
    element("excludes").value = selection.excludePaths.join("\n");
    element("unrecognized").hidden = selection.recognized;
    element("notice").textContent = selection.recognized
      ? "Ordner ausgewählt. Prüfe den Pfad und verbinde den Vault."
      : "Ordner ausgewählt. Prüfe den Hinweis und bestätige die Verbindung.";
    setBusy(false);
    element("connect").focus();
    return;
  }
  selection = null;
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

function joinRelative(parent, child) {
  return parent === "." ? child : `${parent}/${child}`;
}

function clearSearch() {
  if (searchTimer !== null) clearTimeout(searchTimer);
  searchTimer = null;
  searchRequestId += 1;
  element("vault-search").value = "";
}

function absoluteVaultPath(relativePath) {
  return relativePath === "." ? currentState.vaultPath : `${currentState.vaultPath}/${relativePath}`;
}

function resultText(result) {
  return result.content?.filter((item) => item.type === "text").map((item) => item.text || "").join("\n")
    || result.structuredContent?.content
    || "";
}

function renderMarkdownPreview() {
  const safeFragment = renderSafeMarkdown(element("reader-content").value);
  element("markdown-preview").replaceChildren(safeFragment);
}

function setReaderMode(mode) {
  const previewMode = mode === "preview" || currentState?.appPreferences?.allowNoteEditing === false;
  element("reader-content").hidden = previewMode;
  element("markdown-preview").hidden = !previewMode;
  element("edit-mode").setAttribute("aria-pressed", String(!previewMode));
  element("preview-mode").setAttribute("aria-pressed", String(previewMode));
  if (previewMode) renderMarkdownPreview();
}

function renderBreadcrumbs() {
  const container = element("breadcrumbs");
  const rootParts = browserRoot === "." ? [] : browserRoot.split("/");
  const currentParts = browserPath === "." ? [] : browserPath.split("/");
  const rootLabel = rootParts.at(-1) || "Vault";
  const crumbs = [{ label: rootLabel, path: browserRoot }];
  for (let index = rootParts.length; index < currentParts.length; index += 1) {
    crumbs.push({ label: currentParts[index], path: currentParts.slice(0, index + 1).join("/") });
  }
  container.replaceChildren(...crumbs.flatMap((crumb, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = crumb.label;
    button.setAttribute("aria-current", index === crumbs.length - 1 ? "location" : "false");
    button.addEventListener("click", () => {
      clearSearch();
      void loadDirectory(crumb.path);
    });
    return index === 0 ? [button] : [document.createTextNode("/"), button];
  }));
}

async function openNote(relativePath) {
  activeNotePath = relativePath;
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
    savedNoteContent = resultText(result);
    element("reader-content").value = savedNoteContent;
    savedNoteEditorValue = element("reader-content").value;
    element("reader-mode-tabs").hidden = false;
    element("reader-content").hidden = false;
    element("edit-mode").hidden = currentState?.appPreferences?.allowNoteEditing === false;
    element("reader-content").readOnly = currentState?.appPreferences?.allowNoteEditing === false;
    setReaderMode(currentState?.appPreferences?.allowNoteEditing === false ? "preview" : "edit");
    element("reader-actions").hidden = false;
    element("reload-note").hidden = true;
    element("add-note-context").disabled = !openaiExtensions.message || !savedNoteContent.trim();
    element("save-note").disabled = true;
    element("reader-empty").hidden = true;
  } catch (error) {
    element("reader-empty").textContent = error.message || "Die Notiz konnte nicht gelesen werden.";
  }
}

function updateNoteEditState() {
  const content = element("reader-content").value;
  const changed = content !== savedNoteEditorValue;
  const canEdit = currentState?.appPreferences?.allowNoteEditing !== false;
  element("save-note").disabled = busy || !changed || !canEdit;
  element("save-note").hidden = !canEdit;
  element("reload-note").hidden = !changed || !canEdit;
  element("add-note-context").disabled = !openaiExtensions.message || !content.trim();
}

async function saveNote() {
  if (!activeNotePath || element("save-note").disabled) return;
  const content = element("reader-content").value;
  element("save-note").disabled = true;
  element("reload-note").disabled = true;
  element("reader-notice").hidden = false;
  element("reader-notice").textContent = "Notiz wird gespeichert …";
  try {
    const result = await app.callServerTool({
      name: "save_vault_note_from_app",
      arguments: { path: activeNotePath, expectedContent: savedNoteContent, content },
    });
    if (result.isError) throw new Error(resultText(result) || "Die Notiz konnte nicht gespeichert werden.");
    savedNoteContent = content;
    savedNoteEditorValue = content;
    element("reader-notice").textContent = "Notiz gespeichert.";
    element("reader-content").focus();
  } catch (error) {
    element("reader-notice").textContent = error.message || "Die Notiz konnte nicht gespeichert werden.";
  } finally {
    element("reload-note").disabled = false;
    updateNoteEditState();
  }
}

async function reloadNote() {
  if (!activeNotePath) return;
  await openNote(activeNotePath);
  element("reader-notice").textContent = "Aktueller Inhalt neu geladen; der lokale Entwurf wurde verworfen.";
  element("reader-notice").hidden = false;
}

async function addNoteContext() {
  if (!activeNotePath || !openaiExtensions.message) {
    element("reader-notice").hidden = false;
    element("reader-notice").textContent = "Diese Codex-Version unterstützt das Senden an den aktiven Chat in MCP-Apps nicht.";
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
    await openaiExtensions.message.send({
      role: "user",
      content: [{ type: "text", text: `Ich übergebe dir folgenden Obsidian-Kontext. Bitte nutze ihn für meine aktuelle Anfrage.\nTitel: ${element("reader-title").textContent}\nVault-Notiz: ${activeNotePath}${selected ? "\nAuswahl aus der Notiz" : ""}\n\n${content}` }],
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

async function loadDirectory(relativePath) {
  if (browserRoot !== "." && relativePath !== browserRoot && !relativePath.startsWith(`${browserRoot}/`)) return;
  browserPath = relativePath;
  renderBreadcrumbs();
  const list = element("browser-list");
  list.replaceChildren();
  const loading = document.createElement("li");
  loading.textContent = "Ordner wird geladen …";
  list.append(loading);
  try {
    const result = await app.callServerTool({
      name: "list_vault_directory_for_app",
      arguments: { path: absoluteVaultPath(relativePath), showHidden: currentState?.appPreferences?.showHiddenFiles === true },
    });
    if (result.isError) throw new Error(resultText(result) || "Der Ordner konnte nicht gelesen werden.");
    const entries = resultText(result).split("\n").flatMap((line) => {
      const match = line.match(/^\[(DIR|FILE)\] (.*)$/u);
      return match ? [{ directory: match[1] === "DIR", name: match[2], path: joinRelative(relativePath, match[2]) }] : [];
    });
    renderEntries(entries, "Dieser Ordner ist leer.");
  } catch (error) {
    element("file-count").textContent = "";
    list.replaceChildren();
    const item = document.createElement("li");
    item.textContent = error.message || "Der Ordner konnte nicht gelesen werden.";
    list.append(item);
  }
}

function renderEntries(entries, emptyMessage) {
  const list = element("browser-list");
  const sortedEntries = [...entries].sort((left, right) => Number(right.directory) - Number(left.directory) || left.name.localeCompare(right.name));
  element("file-count").textContent = sortedEntries.length ? String(sortedEntries.length) : "";
  list.replaceChildren();
  for (const entry of sortedEntries) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = entry.directory ? "directory-entry" : "file-entry";
    button.dataset.kind = entry.directory ? "directory" : "file";
    button.dataset.path = entry.path;
    const selected = button.dataset.path === activeNotePath;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
    button.type = "button";
    const icon = document.createElement("span");
    icon.className = "entry-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = entry.directory ? "▸" : entry.name.toLowerCase().endsWith(".md") ? "◈" : "·";
    const label = document.createElement("span");
    label.textContent = entry.name;
    button.append(icon, label);
    if (element("vault-search").value.trim() && entry.path.includes("/")) {
      const location = document.createElement("small");
      location.className = "entry-path";
      location.textContent = entry.path;
      button.append(location);
    }
    if (entry.directory) {
      button.addEventListener("click", () => {
        if (element("vault-search").value.trim()) clearSearch();
        void loadDirectory(entry.path);
      });
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      button.addEventListener("click", () => {
        const wasSearching = Boolean(element("vault-search").value.trim());
        if (wasSearching) clearSearch();
        void openNote(entry.path);
        if (wasSearching) void loadDirectory(browserPath);
      });
    } else {
      button.disabled = true;
      button.title = "In dieser Ansicht können Markdown-Notizen gelesen werden.";
    }
    item.append(button);
    list.append(item);
  }
  if (sortedEntries.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = emptyMessage;
    list.append(empty);
  }
}

async function searchVault(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    searchRequestId += 1;
    await loadDirectory(browserPath);
    return;
  }
  const list = element("browser-list");
  const requestId = ++searchRequestId;
  list.replaceChildren();
  const loading = document.createElement("li");
  loading.textContent = "Vault-Namen werden durchsucht …";
  list.append(loading);
  try {
    const result = await app.callServerTool({ name: "search_vault_entries_for_app", arguments: { query: normalizedQuery } });
    if (requestId !== searchRequestId) return;
    if (result.isError) throw new Error(resultText(result) || "Die Suche konnte nicht ausgeführt werden.");
    const entries = result.structuredContent?.entries;
    if (!Array.isArray(entries)) throw new Error("Die Suchantwort enthält keine Trefferliste.");
    renderEntries(entries, `Keine Datei- oder Ordnernamen für „${normalizedQuery}“ gefunden.`);
    if (result.structuredContent.truncated) {
      const message = document.createElement("li");
      message.textContent = "Die Trefferliste ist auf 100 Einträge begrenzt. Verfeinere die Suche für weitere Treffer.";
      element("browser-list").append(message);
    }
  } catch (error) {
    if (requestId !== searchRequestId) return;
    list.replaceChildren();
    const item = document.createElement("li");
    item.textContent = error.message || "Die Suche konnte nicht ausgeführt werden.";
    list.append(item);
  }
}

async function renderResult(result) {
  if (result.isError) {
    element("notice").textContent = result.content?.map((item) => item.text ?? "").join("\n")
      || "Die Aktion ist fehlgeschlagen. Die bisherige Verbindung bleibt bestehen.";
    setBusy(false);
    return;
  }
  if (["unconfigured", "ready", "unavailable", "invalid"].includes(result.structuredContent?.status)) {
    const state = result.structuredContent;
    if (changingVaultFromBrowser && state.status === "ready" && !state.selection) {
      changingVaultFromBrowser = false;
      renderState({ ...state, appMode: "browser" });
    } else if (changingVaultFromBrowser && state.cancelled) {
      changingVaultFromBrowser = false;
      renderState({ ...state, appMode: "browser" });
    } else renderState(state);
  }
}

async function callTool(name, args) {
  const result = await app.callServerTool({ name, arguments: args });
  await renderResult(result);
  return result;
}

async function run(action) {
  setBusy(true);
  element("notice").textContent = action === "choose_vault"
    ? "Ordnerauswahl wird geöffnet …"
    : "Vault wird geprüft und verbunden …";
  try {
    const args = action === "connect_vault"
      ? { selectionId: selection.selectionId, excludePaths: excludes() }
      : {};
    await callTool(action, args);
  } catch (error) {
    element("notice").textContent = error.message || "Die Aktion ist fehlgeschlagen. Die bisherige Verbindung bleibt bestehen.";
    setBusy(false);
  }
}

function showHandoffError(message, canManageVault) {
  element("handoff-warning").textContent = message;
  element("handoff-warning").hidden = false;
  element("send-handoff").hidden = true;
  element("manage-vault").hidden = !canManageVault;
}

async function openHandoff() {
  const deepLink = openaiExtensions.deepLink.getCurrent();
  if (!deepLink?.url) return;
  let route;
  try {
    route = new URL(deepLink.url, "https://codex.local");
  } catch {
    return;
  }
  if (route.pathname !== "/handoff") return;
  if (deepLink.url === activeDeepLink) return;
  activeDeepLink = deepLink.url;

  element("title").textContent = "Obsidian-Kontext übernehmen";
  element("setup-description").hidden = true;
  for (const id of ["browser", "disconnected", "connected", "selection", "manage-excludes"]) element(id).hidden = true;
  element("handoff").hidden = false;
  element("notice").hidden = false;
  element("handoff-title").focus();
  const notePath = route.searchParams.get("notePath");
  const selectedText = route.searchParams.get("selection");
  const noteTitle = route.searchParams.get("title") || "Auswahl aus Obsidian";
  if (selectedText) {
    handoff = { title: noteTitle, path: notePath || "", content: selectedText };
  } else if (notePath) {
    setBusy(true);
    element("handoff-source").textContent = notePath;
    element("handoff-content").value = "Notiz wird über den verbundenen Vault gelesen …";
    try {
      const result = await app.callServerTool({ name: "read_note_for_handoff", arguments: { path: notePath } });
      if (result.isError) throw new Error(result.content?.map((item) => item.text || "").join("\n") || "Die Notiz konnte nicht gelesen werden.");
      handoff = result.structuredContent;
    } catch (error) {
      element("handoff-content").value = "";
      showHandoffError(error.message || "Die Notiz konnte nicht gelesen werden.", true);
      setBusy(false);
      return;
    }
    setBusy(false);
  } else {
    showHandoffError("Der Obsidian-Link enthält weder eine Notiz noch eine Textauswahl.");
    return;
  }

  if (!handoff.content.trim()) {
    showHandoffError("Die Notiz oder Auswahl ist leer.");
    return;
  }
  if (handoff.content.length > 24000) {
    showHandoffError("Der Inhalt ist länger als 24.000 Zeichen. Sende bitte eine kürzere Auswahl.");
    return;
  }
  element("handoff-title").textContent = handoff.title || "Notiz an Codex übergeben";
  element("handoff-source").textContent = handoff.path || "Markierte Textauswahl";
  element("handoff-content").value = handoff.content;
  element("handoff-warning").hidden = true;
  element("send-handoff").hidden = false;
  element("manage-vault").hidden = true;
  element("send-handoff").disabled = false;
}

async function sendHandoff() {
  if (!handoff?.content) return;
  const message = openaiExtensions.message;
  if (!message) {
    showHandoffError("Diese Codex-Version unterstützt das Senden an den aktiven Chat in MCP-Apps nicht.", false);
    return;
  }
  setBusy(true);
  try {
    const reference = handoff.path ? `\nVault-Notiz: ${handoff.path}` : "";
    await message.send({
      role: "user",
      content: [{ type: "text", text: `Ich übergebe dir den folgenden Obsidian-Kontext. Bitte nutze ihn für meine aktuelle Anfrage.\nTitel: ${handoff.title}${reference}\n\n${handoff.content}` }],
    });
    element("notice").textContent = "Der Obsidian-Kontext wurde an den aktuellen Chat gesendet.";
    element("send-handoff").disabled = true;
    handoff = null;
  } catch (error) {
    element("notice").textContent = error.message || "Der Kontext konnte nicht an den aktuellen Chat gesendet werden.";
    setBusy(false);
  }
}

element("choose").addEventListener("click", () => run("choose_vault"));
element("choose-ready").addEventListener("click", () => run("choose_vault"));
element("connect").addEventListener("click", () => run("connect_vault"));
element("send-handoff").addEventListener("click", sendHandoff);
async function updateAppPreference(preference, value) {
  const result = await app.callServerTool({ name: "settings.update", arguments: { set: { [preference]: value } } });
  if (result.isError) throw new Error(resultText(result) || "Die Einstellung konnte nicht gespeichert werden.");
  currentState = { ...currentState, appPreferences: result.structuredContent.values };
}

async function saveTogglePreference(preference, control, peerControl) {
  const previous = currentState?.appPreferences?.[preference] === true;
  control.disabled = true;
  element("settings-notice").hidden = true;
  try {
    await updateAppPreference(preference, control.checked);
    if (peerControl) peerControl.checked = control.checked;
    if (preference === "showHiddenFiles") {
      const query = element("vault-search").value;
      if (query.trim()) await searchVault(query);
      else await loadDirectory(browserPath);
    }
    if (preference === "allowNoteEditing" && activeNotePath) {
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

element("settings-show-hidden").addEventListener("change", (event) => void saveTogglePreference("showHiddenFiles", event.currentTarget, null));
element("settings-allow-editing").addEventListener("change", (event) => void saveTogglePreference("allowNoteEditing", event.currentTarget));
element("vault-search").addEventListener("input", () => {
  if (searchTimer !== null) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    void searchVault(element("vault-search").value);
  }, 250);
});
element("toggle-settings").addEventListener("click", () => {
  const panel = element("browser-settings");
  const opening = panel.hidden;
  panel.hidden = !opening;
  element("toggle-settings").setAttribute("aria-expanded", String(opening));
  element("browser-toolbar").hidden = opening;
  element("browser-layout").hidden = opening;
  if (opening) element("change-vault").focus();
});
element("change-vault").addEventListener("click", () => {
  changingVaultFromBrowser = true;
  run("choose_vault");
});
element("reader-content").addEventListener("input", updateNoteEditState);
element("reader-content").addEventListener("input", () => {
  if (!element("markdown-preview").hidden) renderMarkdownPreview();
});
element("edit-mode").addEventListener("click", () => setReaderMode("edit"));
element("preview-mode").addEventListener("click", () => setReaderMode("preview"));
element("save-note").addEventListener("click", saveNote);
element("reload-note").addEventListener("click", reloadNote);
element("add-note-context").addEventListener("click", addNoteContext);
element("manage-vault").addEventListener("click", () => {
  element("handoff").hidden = true;
  element("title").textContent = "Obsidian-Vault verbinden";
  element("setup-description").hidden = false;
  run("configure_vault");
});

element("toggle-excludes").addEventListener("click", () => {
  const panel = element("exclusion-panel");
  const expanded = element("toggle-excludes").getAttribute("aria-expanded") === "true";
  element("toggle-excludes").setAttribute("aria-expanded", String(!expanded));
  panel.hidden = expanded;
});
element("toggle-excludes-existing").addEventListener("click", () => {
  const panel = element("existing-exclusions");
  const expanded = element("toggle-excludes-existing").getAttribute("aria-expanded") === "true";
  element("toggle-excludes-existing").setAttribute("aria-expanded", String(!expanded));
  panel.hidden = expanded;
});
element("excludes-existing").addEventListener("input", () => {
  element("save-excludes").hidden = false;
  element("save-excludes").disabled = busy;
});
element("save-excludes").addEventListener("click", async () => {
  if (!currentState?.vaultPath) return;
  setBusy(true);
  element("notice").textContent = "Ausschlüsse werden geprüft …";
  try {
    const result = await callTool("connect_vault", {
      excludePaths: element("excludes-existing").value.split("\n").map((value) => value.trim()).filter(Boolean),
    });
    if (!result.isError) element("save-excludes").hidden = true;
  } catch (error) {
    element("notice").textContent = error.message || "Die Ausschlüsse konnten nicht gespeichert werden.";
    setBusy(false);
  }
});

app.ontoolresult = renderResult;
app.onhostcontextchanged = (context) => {
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  void openHandoff();
};

void (async () => {
  await app.connect();
  const host = app.getHostContext();
  if (host?.theme) applyDocumentTheme(host.theme);
  if (host?.styles?.variables) applyHostStyleVariables(host.styles.variables);
  if (host?.styles?.css?.fonts) applyHostFonts(host.styles.css.fonts);
  await openHandoff();
})();
