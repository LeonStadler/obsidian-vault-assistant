# Installation

## Bestehender Stand und lokale Testpakete

Der gesicherte Stand `c8a665e` mit Version `0.16.0` bleibt die Referenz. Der Multi-Host-Refaktor ist noch nicht veröffentlicht. Die hier erzeugten Testpakete enthalten eine eigene Runtime; der bisherige Marketplace-Stand benötigt weiterhin Node.js 18 oder neuer. Es wird keine bereits erfolgte Marketplace-Veröffentlichung vorausgesetzt.

Für die normalen Pakete gilt: **Plugin installieren → Vault auswählen → Pfad und Ausschlüsse prüfen → Verbinden**. npm, Terminalbefehle und eine separat installierte Node-Laufzeit sind bei diesen Paketen nicht erforderlich.

## Pakete für macOS

Wähle Apple Silicon (`arm64`) oder Intel (`x64`). Lokal erzeugte Pakete liegen unter `dist/`.

- **ChatGPT/Codex Desktop:** OpenAI-Paket über den vom Host angebotenen lokalen Plugin-/Marketplace-Einstieg installieren. Die bestehende Plugin-Identität bleibt erhalten. Nach Installation einen neuen Chat öffnen und **Vault verbinden** wählen.
- **Cursor:** Cursor-Paket als lokales Plugin beziehungsweise über ein passendes Marketplace installieren. Es enthält Skills, MCP und die gemeinsame MCP-App. Eine separate permanente Sidebar-Erweiterung gehört nicht zum Paket.
- **Claude Desktop:** `.mcpb` in den Desktop-Erweiterungseinstellungen installieren. Ein dort ausgewählter Vault-Ordner ist nur eine Vorauswahl; erst im Vault-Setup **Verbinden** bestätigen.
- **Claude Code:** Claude-Code-Paket über dessen Plugin-System installieren. Skills und MCP-Werkzeuge sind enthalten. Bei fehlender App-Oberfläche führt der Setup-Skill durch Auswahl und ausdrückliche Bestätigung.
- **Weitere MCP-Clients:** Generisches Paket entpacken und den lokalen MCP-Server konfigurieren:

```json
{
  "mcpServers": {
    "obsidianVaultFilesystem": {
      "command": "/bin/bash",
      "args": ["/ABSOLUTER/PAKETPFAD/scripts/launch-host.sh"]
    }
  }
}
```

Die tatsächlichen Installationsdialoge und UI-Funktionen werden pro Host abgenommen. Der aktuelle Prüfstand steht ausschließlich in [Host-Kompatibilität](docs/host-compatibility.md). Lokale Testpakete sind nicht signiert/notarisiert und noch nicht für öffentliche Verteilung freigegeben.

## Eine gemeinsame Vault-Verbindung

Alle lokalen Hosts verwenden `~/Library/Application Support/Obsidian Vault Assistant/`. Vorhandene Codex-Einstellungen werden einmalig übernommen, sofern dort noch keine gemeinsame Konfiguration liegt. Die ursprünglichen Dateien bleiben erhalten. Abweichende Altkonfigurationen ersetzen die gemeinsame Verbindung nicht automatisch.

Zum Ändern des Vaults **Vault verwalten** beziehungsweise **Einstellungen** öffnen. Auswahl und Bestätigung sind getrennt. Abbruch oder fehlgeschlagene Verbindung erhalten den bisherigen Vault. Updates und die Deinstallation einzelner Host-Pakete löschen weder Vault-Dateien noch die gemeinsame Konfiguration.

## Lokale Entwicklung

Node.js und npm werden nur für die Entwicklung aus dem Repository benötigt; empfohlen ist dieselbe Node-LTS-Version wie im Paketbuild.

```bash
npm ci
npm run check
npm run prepare:runtime
npm run build:packages
npm run check:packages
npm test
npm run test:multi-host
npm run test:ui
```

`prepare:runtime` lädt die festgelegten macOS-Runtimes mit Prüfsummenprüfung. `build:packages` benötigt diese Dateien, lädt beim Host-Start nichts nach und erzeugt alle fünf Host-Profile für beide Architekturen.

`scripts/install-local.sh` registriert weiterhin eine Quellinstallation für OpenAI-Entwicklung. `scripts/configure-vault.sh --select` ist die optionale CLI-Einrichtung über dieselbe Speicher-/Validierungslogik. Für automatisierte Tests ein separates `VAULT_MCP_CONFIG_DIR` setzen. Die reale Konfiguration darf nicht für Erstinstallations-Tests verwendet werden. `node scripts/prepare-host-acceptance.mjs` erstellt getrennte Claude-/Cursor-Testpakete, eine gemeinsame isolierte Konfiguration und ausschließlich künstliche Testnotizen.

## Fehlerbehebung

- **Werkzeuge fehlen nach Installation/Update:** Plugin-Aktivierung prüfen, Host neu starten und einen neuen Chat beginnen.
- **Ein Quellcheckout verlangt Node:** Ein reguläres Paket verwenden oder die Entwicklungs-Laufzeit installieren.
- **Unvollständiges Paket:** Neu erstellen oder installieren; keine Abhängigkeiten beim ersten Start nachinstallieren.
- **Vault nicht zugänglich:** Pfad und Rechte prüfen oder über das Setup ausdrücklich neu verbinden.
- **Konfiguration inzwischen geändert:** Aktuellen Zustand laden und Änderung erneut bestätigen.
- **Notizkonflikt:** Entwurf behalten, aktuelle Notiz laden und die Änderungen bewusst übernehmen.
- **Keine Chat-Übergabe:** Der Host bietet diese Fähigkeit nicht an; Lesen und Bearbeiten bleiben nutzbar.

Architektur und Speicher-/Sperrverhalten: [Architektur](docs/architecture.md).
