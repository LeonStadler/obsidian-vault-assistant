# Architektur

## Gemeinsamer Kern

`src/core/` enthält streng typisierte Konfigurationsspeicherung, Scope-Validierung, Suche, Schreibsperren und konfliktgeschütztes Speichern von Markdown-Notizen. Der bestehende MCP-Dateiserver bleibt als lokaler Unterprozess erhalten. `scripts/vault-mcp-server.mjs` koordiniert Werkzeuge und Verbindungen; die Werkzeugverträge liegen in `src/server/`. Beide Prozesse werden ohne externe Laufzeit-Abhängigkeiten gebündelt.

Alle Dateioperationen durchlaufen die gespeicherten Retrieval-Ordner, Ausschlüsse und Symlink-Prüfungen. Die Sichtbarkeit von Punktdateien ändert keine Berechtigungen. Die Bearbeitungseinstellung sperrt sowohl UI-Speichern als auch schreibende MCP-Werkzeuge.

## Gemeinsame Speicherung

Die Konfiguration liegt auf macOS unter `~/Library/Application Support/Obsidian Vault Assistant/.vault-config.json`. `VAULT_MCP_CONFIG_DIR` isoliert Entwicklung und Tests. Die bisherige Codex-Konfiguration wird beim ersten Start übernommen; ursprüngliche Dateien bleiben bestehen. Eine vorhandene gemeinsame Verbindung wird nie automatisch durch eine Altkonfiguration ersetzt. Abweichungen erscheinen als Hinweis im Setup.

Jede Speicherung erhöht `revision`. Die Oberfläche erhält `configRevision`; veraltete Konfigurationsänderungen und Notiz-Speicherversuche werden abgelehnt. Ältere MCP-Clients können die optionalen Revisionsparameter weglassen; dann wird die aktuell unter Sperre gelesene Revision verwendet.

Eine gemeinsame, durch `proper-lockfile` mit Heartbeat gepflegte Sperre schützt die MCP-Datei- und Konfigurationsoperationen. Der native Ordnerdialog läuft außerhalb dieser Sperre, damit die bisherige Verbindung während der Auswahl in anderen Hosts nutzbar bleibt. Prozesse lesen vor Dateioperationen die aktuelle Konfiguration und erneuern ihren Dateiserver bei einem Revisionswechsel. Verwaiste Sperren werden nach 30 Sekunden ohne Heartbeat wieder nutzbar. Konfigurationen und Notizen werden über temporäre Dateien atomar ersetzt.

Notiz-Speichern vergleicht Inhalt und Dateistand nochmals unmittelbar vor dem Ersetzen. Das serialisiert Schreibvorgänge dieses Plugins. Obsidian verwendet unsere Sperre nicht; externe Änderungen werden bestmöglich erkannt, eine betriebssystemweite Compare-and-swap-Garantie gegenüber beliebigen externen Schreibern besteht nicht.

## Oberfläche und Host-Anbindungen

Die gemeinsame MCP-App wird in `ui/controllers/` nach Setup, Browser, Editor, Einstellungen und Kontextübergabe gegliedert. Die Host-Anbindung in `ui/hosts/` prüft angebotene Fähigkeiten. OpenAI-Kontextübergabe nutzt weiterhin die OpenAI Message API; andere unterstützende Hosts verwenden die standardisierte MCP-App Message API. Fehlende Message-Unterstützung sperrt nur diese Aktion.

Das Profil `VAULT_MCP_HOST` wählt OpenAI-, Cursor-, Claude-Desktop-, Claude-Code- oder generische Metadaten. Ohne explizites Profil bleibt OpenAI aktiv, um bestehende Installationen zu erhalten. Browser, Vorschau und Editor bleiben dieselbe Oberfläche. Theme und Schrift werden aus dem Host-Kontext übernommen.

Der Standard-Skill-Ablauf bleibt gezielte Suche, begrenzter Kontext und ausdrückliches Schreiben. Die Obsidian-Erweiterung behält ihre bestehenden OpenAI-Befehle; es wird kein ungeprüfter Chat-Übergabeweg für andere Hosts erfunden.

## Pakete

Der Paketbuild erzeugt für jedes Host-Profil Apple-Silicon- und Intel-Artefakte aus derselben Quelle. Die feste Node-LTS-Runtime `v24.21.0` wird beim Entwicklungsbuild von nodejs.org bezogen und gegen die offiziellen SHA-256-Prüfsummen geprüft. Laufzeitdownloads sind nicht erforderlich. Quellinstallationen können weiterhin die Entwicklungs-Node-Laufzeit verwenden.

Host-Pfade verwenden die jeweiligen Variablen: `${PLUGIN_ROOT}`, `${CURSOR_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_ROOT}` beziehungsweise `${__dirname}`. Claude-Desktop-Konfiguration kann einen Ordner als Vorauswahl anbieten; sie bestätigt keine Verbindung automatisch. Die Startprogramme stellen bei MCPB-Extraktion fehlende Ausführungsrechte ausschließlich für die paketinterne Node-Datei wieder her.

MCPB-Manifeste werden gegen das vendorte offizielle Schema 0.3 aus `@anthropic-ai/mcpb` 2.1.2 validiert. Dessen MIT-Lizenz liegt bei. Der vollständige MCPB-CLI-/Signierstack wird nicht als Projektabhängigkeit benötigt.

Öffentliche Artefakte benötigen eine eigene Signier-/Notarisierungsabnahme. Lokale Testpakete tragen ausdrücklich `publicationReady: false`. Ein erfolgreicher Paketstart bestätigt keine Marketplace-Installation und keine echte Host-UI.
