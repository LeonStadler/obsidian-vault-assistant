# Host-Kompatibilität und Abnahme

Stand: 2026-10-13. Die Multi-Host-Erweiterung ist ein Entwicklungsstand auf `feature/multi-host-plugin`; die Manifestversion bleibt bis zur vollständigen Abnahme `0.16.0`. Zielversion ist `0.18.0`.

| Host | Paket | Technische Prüfung | Echte Host-Abnahme |
| --- | --- | --- | --- |
| ChatGPT/Codex Desktop | OpenAI-Plugin | Bestehende MCP-Verträge, Sidebar-/Thread-Metadaten, Einstellungen; paketinterner Start geprüft | Offen: die installierte Cache-Version ist `0.16.0`; Branch-Build nicht in der echten App geprüft. Computer Use verweigerte den Zugriff auf die Codex-App |
| Cursor | Cursor-Plugin | Standard-MCP-App-Metadaten, Skills, Paketstart und lokales Marketplace-Manifest geprüft | Offen: korrigiertes Paket wurde neu gebaut, aber nicht importiert. Cursor-UI-Steuerung lieferte `noWindowsAvailable`; ein AX-Klick ergab `AXError.invalidUIElement` |
| Claude Desktop | `.mcpb` | Offizielles Manifest-Schema und Paketstart geprüft | Installiert und aktiviert. Der Statusaufruf lief, meldete aber `unconfigured`; `configure_vault` antwortete im echten Host auch nach vier Minuten nicht. Setup und Vault-App daher nicht abgenommen |
| Claude Code | Claude-Plugin | Manifest, Skills, MCP-Paketstart geprüft | Offen: CLI nicht vorhanden |
| Weitere MCP-Clients | Generisches Paket | MCP-Paketstart geprüft | Keine pauschale UI-Zusage |

Die installierten App-Versionen wurden aus ihren Paketmetadaten gelesen: ChatGPT `26.1007.30912`, Cursor `3.24.12`, Claude `2.31226.1`. Das ist kein Funktionsnachweis.

Das Claude-Testpaket ist unter der temporären Identität `obsidian-vault-assistant-acceptance` installiert. Es verwendet ausschließlich eine separate Testkonfiguration und künstliche Notizen unter dem System-Temp-Verzeichnis. Der persönliche Vault-Pfad ist dort nicht hinterlegt. Das Testplugin nach der Abnahme aus Claude entfernen.

## Prüfgrenzen

Die bestehenden Integrationstests prüfen Einrichtung, Abbruch, fehlgeschlagene Verbindung, Ausschlüsse, Symlinks, Navigation, Suche, Lesen, Schreiben und Neustart-Persistenz. Zusätzliche Tests starten echte MCP-Prozesse und prüfen Migration, gemeinsame Einstellungen, Revisionskonflikte, konkurrierende Bearbeitung und Paketstart ohne externes Node/npm.

Die UI-Bridge-Prüfung verwendet die echte gebündelte Oberfläche und den echten MCP-Server mit einem simulierten Host. Sie prüft Initialisierung, Lesen, Vorschau, Editor und ausdrückliche Kontextübergabe. Sie ersetzt die Prüfung in ChatGPT, Cursor oder Claude nicht.

Apple-Silicon-Pakete werden auf diesem Mac ausgeführt. Intel-Artefakte werden erzeugt und statisch geprüft; die Intel-Runtime kann auf diesem Mac ohne Rosetta nicht gestartet werden (`bad CPU type in executable`). Intel-Live-Abnahme ist offen.

Eine Apple-Development-Identität ist vorhanden, jedoch keine Developer-ID-Application-Identität für öffentliche Distribution. Signierung, Notarisierung und öffentliche Installation sind offen.

## Verbindliche Host-Abnahme

Für jeden Host Installationsweg und Version festhalten, mit isolierter Konfiguration beginnen und anschließend die vorhandene gemeinsame Verbindung prüfen:

1. Installieren, Setup öffnen, nativen Ordnerdialog verwenden, abbrechen und nochmals auswählen.
2. Pfad kontrollieren, ausdrücklich verbinden und nach Host-Neustart die Verbindung wiederverwenden.
3. Ordner öffnen, Namen suchen, Notiz lesen, Vorschau anzeigen, Testnotiz ändern und wieder lesen.
4. Ausschlüsse, Punktdatei-Einstellung und Bearbeitungssperre prüfen.
5. In zwei Hosts dieselbe Verbindung verwenden und Änderungen beziehungsweise Schreibkonflikte prüfen.
6. Hell-/Dunkelmodus, Tastatur, Fokus und konkrete Fehlermeldungen prüfen.
7. In der OpenAI-Integration zusätzlich Sidebar, Thread-Tab, Host-Einstellungen, Obsidian-Deep-Link und Übergabe an den richtigen Chat prüfen. Es darf keine Übertragung ohne ausdrückliche Aktion erfolgen.

Die OpenAI-Funktionsparität ist eine verpflichtende Freigabebedingung. Nicht bestandene oder nicht durchgeführte Prüfungen bleiben offen.
