import { app, hostAdapter, session, element, excludes, resultText } from './runtime.js';
import { setBusy } from './setup.js';

export function showHandoffError(message, canManageVault) {
  element("handoff-warning").textContent = message;
  element("handoff-warning").hidden = false;
  element("send-handoff").hidden = true;
  element("manage-vault").hidden = !canManageVault;
}

export async function openHandoff() {
  const deepLink = hostAdapter.getDeepLink();
  if (!deepLink?.url) return;
  let route;
  try {
    route = new URL(deepLink.url, "https://codex.local");
  } catch {
    return;
  }
  if (route.pathname !== "/handoff") return;
  if (deepLink.url === session.activeDeepLink) return;
  session.activeDeepLink = deepLink.url;

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
    session.handoff = { title: noteTitle, path: notePath || "", content: selectedText };
  } else if (notePath) {
    setBusy(true);
    element("handoff-source").textContent = notePath;
    element("handoff-content").value = "Notiz wird über den verbundenen Vault gelesen …";
    try {
      const result = await app.callServerTool({ name: "read_note_for_handoff", arguments: { path: notePath } });
      if (result.isError) throw new Error(result.content?.map((item) => item.text || "").join("\n") || "Die Notiz konnte nicht gelesen werden.");
      session.handoff = result.structuredContent;
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

  if (!session.handoff.content.trim()) {
    showHandoffError("Die Notiz oder Auswahl ist leer.");
    return;
  }
  if (session.handoff.content.length > 24000) {
    showHandoffError("Der Inhalt ist länger als 24.000 Zeichen. Sende bitte eine kürzere Auswahl.");
    return;
  }
  element("handoff-title").textContent = session.handoff.title || "Notiz an Codex übergeben";
  element("handoff-source").textContent = session.handoff.path || "Markierte Textauswahl";
  element("handoff-content").value = session.handoff.content;
  element("handoff-warning").hidden = true;
  element("send-handoff").hidden = false;
  element("manage-vault").hidden = true;
  element("send-handoff").disabled = false;
}

export async function sendHandoff() {
  if (!session.handoff?.content) return;
  const message = hostAdapter.canSendContext ? { send: (value) => hostAdapter.sendContext(value) } : null;
  if (!message) {
    showHandoffError("Diese Anwendung unterstützt das Senden an den aktiven Chat in MCP-Apps nicht.", false);
    return;
  }
  setBusy(true);
  try {
    const reference = session.handoff.path ? `\nVault-Notiz: ${session.handoff.path}` : "";
    await message.send({
      role: "user",
      content: [{ type: "text", text: `Ich übergebe dir den folgenden Obsidian-Kontext. Bitte nutze ihn für meine aktuelle Anfrage.\nTitel: ${session.handoff.title}${reference}\n\n${session.handoff.content}` }],
    });
    element("notice").textContent = "Der Obsidian-Kontext wurde an den aktuellen Chat gesendet.";
    element("send-handoff").disabled = true;
    session.handoff = null;
  } catch (error) {
    element("notice").textContent = error.message || "Der Kontext konnte nicht an den aktuellen Chat gesendet werden.";
    setBusy(false);
  }
}
