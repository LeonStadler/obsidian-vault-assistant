import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";

const app = new App({ name: "obsidian-vault-assistant", version: "0.6.0" });
new OpenAIExtensions(app);
let currentState = null;
let selection = null;
let busy = false;

const element = (id) => document.getElementById(id);
const excludes = () => element("excludes").value.split("\n").map((value) => value.trim()).filter(Boolean);

function setBusy(value) {
  busy = value;
  element("choose").disabled = value;
  element("choose-ready").disabled = value;
  element("connect").disabled = value || !selection;
  element("excludes").disabled = value;
  element("save-excludes").disabled = value;
}

function renderState(state) {
  currentState = state;
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

async function renderResult(result) {
  if (result.isError) {
    element("notice").textContent = result.content?.map((item) => item.text ?? "").join("\n")
      || "Die Aktion ist fehlgeschlagen. Die bisherige Verbindung bleibt bestehen.";
    setBusy(false);
    return;
  }
  if (result.structuredContent) renderState(result.structuredContent);
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

element("choose").addEventListener("click", () => run("choose_vault"));
element("choose-ready").addEventListener("click", () => run("choose_vault"));
element("connect").addEventListener("click", () => run("connect_vault"));

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
};

void (async () => {
  await app.connect();
  const host = app.getHostContext();
  if (host?.theme) applyDocumentTheme(host.theme);
  if (host?.styles?.variables) applyHostStyleVariables(host.styles.variables);
  if (host?.styles?.css?.fonts) applyHostFonts(host.styles.css.fonts);
})();
