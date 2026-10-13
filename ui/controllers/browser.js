import { app, hostAdapter, session, element, excludes, resultText } from './runtime.js';
import { openNote } from './editor.js';

export function joinRelative(parent, child) {
  return parent === "." ? child : `${parent}/${child}`;
}

export function clearSearch() {
  if (session.searchTimer !== null) clearTimeout(session.searchTimer);
  session.searchTimer = null;
  session.searchRequestId += 1;
  element("vault-search").value = "";
}

export function absoluteVaultPath(relativePath) {
  return relativePath === "." ? session.currentState.vaultPath : `${session.currentState.vaultPath}/${relativePath}`;
}

export function renderBreadcrumbs() {
  const container = element("breadcrumbs");
  const rootParts = session.browserRoot === "." ? [] : session.browserRoot.split("/");
  const currentParts = session.browserPath === "." ? [] : session.browserPath.split("/");
  const rootLabel = rootParts.at(-1) || "Vault";
  const crumbs = [{ label: rootLabel, path: session.browserRoot }];
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

export async function loadDirectory(relativePath) {
  if (session.browserRoot !== "." && relativePath !== session.browserRoot && !relativePath.startsWith(`${session.browserRoot}/`)) return;
  session.browserPath = relativePath;
  renderBreadcrumbs();
  const list = element("browser-list");
  list.replaceChildren();
  const loading = document.createElement("li");
  loading.textContent = "Ordner wird geladen …";
  list.append(loading);
  try {
    const result = await app.callServerTool({
      name: "list_vault_directory_for_app",
      arguments: { path: absoluteVaultPath(relativePath), showHidden: session.currentState?.appPreferences?.showHiddenFiles === true },
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

export function renderEntries(entries, emptyMessage) {
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
    const selected = button.dataset.path === session.activeNotePath;
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
        if (wasSearching) void loadDirectory(session.browserPath);
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

export async function searchVault(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    session.searchRequestId += 1;
    await loadDirectory(session.browserPath);
    return;
  }
  const list = element("browser-list");
  const requestId = ++session.searchRequestId;
  list.replaceChildren();
  const loading = document.createElement("li");
  loading.textContent = "Vault-Namen werden durchsucht …";
  list.append(loading);
  try {
    const result = await app.callServerTool({ name: "search_vault_entries_for_app", arguments: { query: normalizedQuery } });
    if (requestId !== session.searchRequestId) return;
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
    if (requestId !== session.searchRequestId) return;
    list.replaceChildren();
    const item = document.createElement("li");
    item.textContent = error.message || "Die Suche konnte nicht ausgeführt werden.";
    list.append(item);
  }
}
