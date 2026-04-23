# Codex-Installation

## Was du brauchst

- dieses Plugin unter `~/.codex/plugins/obsidian-vault-assistant`
- eine globale Marketplace-Datei: `~/.agents/plugins/marketplace.json`
- das MCP startet aus der Plugin-Datei `.mcp.json` automatisch mit

## Schritte

1. Plugin nach `~/.codex/plugins/obsidian-vault-assistant` legen (z. B. per `git clone`).
2. Falls nicht vorhanden, `~/.agents/plugins/marketplace.json` erstellen.
3. Den Eintrag aus `marketplace.global.example.json` in die globale Marketplace-Datei übernehmen.
4. Codex neu starten.
5. Im Marketplace `obsidian-vault-assistant` aktivieren.

## Globale Nutzung

Wenn du das Repository auf GitHub veröffentlichst, kann jede Person es direkt nach `~/.codex/plugins/obsidian-vault-assistant` klonen und global aktivieren.

## Beispiel-Registry-Eintrag

```json
{
    "name": "obsidian-vault-assistant",
    "source": {
      "source": "local",
      "path": "./.codex/plugins/obsidian-vault-assistant"
    },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

## Kurz erklärt

- `docs/legal/` enthält die Texte, die du öffentlich verlinken kannst.
- `marketplace.global.example.json` ist die Vorlage für die globale Codex-Registry.
- Im Vault selbst muss dafür keine zusätzliche Plugin-Datei außerhalb dieses Ordners liegen.
