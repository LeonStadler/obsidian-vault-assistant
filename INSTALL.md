# Installation

## Empfohlener Weg: Codex Marketplace

Voraussetzungen: Codex Desktop und Node.js 18 oder neuer. **npm wird für die normale Installation und Nutzung nicht benötigt.**

1. Füge das Plugin-Marketplace in Codex hinzu und installiere **Obsidian Vault Assistant**:

   ```bash
   codex plugin marketplace add LeonStadler/obsidian-vault-assistant
   codex plugin add obsidian-vault-assistant@obsidian-vault-assistant
   ```

   Alternativ kannst du das Marketplace und Plugin in der Codex-Oberfläche hinzufügen.
2. Starte einen neuen Chat, damit Codex die installierten Plugin-Funktionen lädt.
3. Wähle **Vault verbinden**. Beim ersten Start öffnet Codex den Einrichtungsassistenten.
4. Wähle im Ordnerdialog deinen Vault aus, prüfe den angezeigten Pfad und klicke **Verbinden**.

Die Verbindung wird erst nach erfolgreicher Zugriffs- und Schreibprüfung gespeichert. Die bestehende Verbindung bleibt bei Abbruch oder Fehlern erhalten. Standardmäßig sind `.obsidian`, `.git` und `.trash` ausgeschlossen. Die Einstellungen **Vault verwalten** und **Obsidian** öffnen später dieselbe Vault-Verbindung zum Ändern beziehungsweise Durchsuchen.

### Was die Installation lokal einrichtet

- Die MCP-Runtime ist mit dem Plugin gebündelt. Beim ersten Start werden keine npm-Pakete heruntergeladen und installiert.
- Node.js 18 oder neuer führt die lokale Runtime aus.
- Vault-Pfad, Zugriffsbereich und Einstellungen liegen in der lokalen Codex-Konfiguration und bleiben bei Plugin-Updates erhalten.
- Der Vault wird nicht kopiert oder indexiert. Codex liest nur die freigegebenen Bereiche, die du in der Verbindung festgelegt hast.

Falls Codex meldet, dass `node` fehlt, installiere Node.js 18 oder neuer, starte Codex neu und öffne einen neuen Chat. Du musst weder `npm install` noch `scripts/configure-vault.sh` für die Codex-Einrichtung ausführen.

## Lokale Entwicklung

Für Plugin-Entwicklung werden Node.js 18 oder neuer, npm und Git benötigt. Klone das Repository und registriere es als lokales Codex-Plugin:

```bash
git clone https://github.com/LeonStadler/obsidian-vault-assistant.git "$HOME/Development/obsidian-vault-assistant"
cd "$HOME/Development/obsidian-vault-assistant"
npm ci
npm run check
scripts/install-local.sh
```

Der Build aktualisiert die gebündelte MCP-Runtime und die Oberflächenressourcen. `scripts/install-local.sh` kopiert den Plugin-Stand in den lokalen Codex-Plugin-Ordner und registriert ihn im persönlichen Marketplace. Starte Codex danach neu und öffne einen neuen Chat. Zum Testen eines unveröffentlichten Builds kannst du den Vault im Codex-Assistenten verbinden; für Automatisierung lässt sich optional `scripts/configure-vault.sh` verwenden.

## Cursor und andere MCP-Hosts

Andere Hosts verwenden nicht die Codex-Onboarding-Oberfläche. Richte den Vault einmal mit `scripts/configure-vault.sh` ein und übernimm den Server-Eintrag aus [`mcp.example.json`](mcp.example.json) in die MCP-Konfiguration des Hosts. Passe dort den absoluten Plugin-Pfad an und starte den Host neu.

```bash
scripts/configure-vault.sh --select
```

Der Ordnerdialog in diesem Fallback ist macOS-spezifisch. Diese Einrichtung ist nur für andere MCP-Hosts oder Automatisierung vorgesehen; für Codex ist der Marketplace-Assistent der unterstützte Weg.

## Fehlerbehebung

- **Der Vault-Assistent öffnet sich nicht:** Stelle sicher, dass das Plugin in Codex installiert und aktiviert ist. Öffne danach einen neuen Chat und nutze **Vault verbinden**.
- **`node` wurde nicht gefunden:** Installiere Node.js 18 oder neuer und starte Codex neu.
- **Der Vault ist nicht verfügbar:** Öffne **Vault verwalten**, wähle den verschobenen Vault erneut aus und bestätige die Verbindung.
- **MCP-Werkzeuge fehlen nach einem Update:** Starte Codex neu und beginne einen neuen Chat, damit die aktualisierte Plugin-Version geladen wird.

## Entwicklung und Validierung

`npm run check` baut und prüft die Oberflächen und beide Runtime-Bundles. `npm test` startet das gebündelte MCP über stdio mit einem isolierten temporären Vault; der Test entfernt `npm` aus dem Laufzeit-`PATH`, um zu prüfen, dass die Runtime keine Paketinstallation voraussetzt. Der Test verändert deinen verbundenen Vault nicht.

Die echte native Ordnerauswahl und MCP-App-Darstellung müssen zusätzlich in Codex geprüft werden. Der Integrationstest allein bestätigt diese Host-Oberfläche nicht.
