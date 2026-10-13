import { applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from '@modelcontextprotocol/ext-apps';
import { app, hostAdapter, session, element, resultText } from './controllers/runtime.js';
import { setBusy, renderResult, callTool, run } from './controllers/setup.js';
import { searchVault } from './controllers/browser.js';
import { renderMarkdownPreview, setReaderMode, updateNoteEditState, saveNote, reloadNote, addNoteContext } from './controllers/editor.js';
import { openHandoff, sendHandoff } from './controllers/handoff.js';
import { saveTogglePreference, refreshConnection } from './controllers/settings.js';
element("choose").addEventListener("click", () => run("choose_vault"));
element("choose-ready").addEventListener("click", () => run("choose_vault"));
element("connect").addEventListener("click", () => run("connect_vault"));
element("send-handoff").addEventListener("click", sendHandoff);
element("settings-show-hidden").addEventListener("change", (event) => void saveTogglePreference("showHiddenFiles", event.currentTarget, null));
element("settings-allow-editing").addEventListener("change", (event) => void saveTogglePreference("allowNoteEditing", event.currentTarget));
element("vault-search").addEventListener("input", () => {
  if (session.searchTimer !== null) clearTimeout(session.searchTimer);
  session.searchTimer = setTimeout(() => {
    session.searchTimer = null;
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
  session.changingVaultFromBrowser = true;
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
  element("save-excludes").disabled = session.busy;
});
element("save-excludes").addEventListener("click", async () => {
  if (!session.currentState?.vaultPath) return;
  setBusy(true);
  element("notice").textContent = "Ausschlüsse werden geprüft …";
  try {
    const result = await callTool("connect_vault", {
      configRevision: session.currentState?.configRevision,
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
  try {
  await app.connect();
  const host = app.getHostContext();
  if (host?.theme) applyDocumentTheme(host.theme);
  if (host?.styles?.variables) applyHostStyleVariables(host.styles.variables);
  if (host?.styles?.css?.fonts) applyHostFonts(host.styles.css.fonts);
  await openHandoff();
  } catch (error) { element("notice").hidden = false; element("notice").textContent = `Die Verbindung zur Anwendung ist fehlgeschlagen: ${error.message}`; }
})();

window.addEventListener("focus", () => void refreshConnection());
