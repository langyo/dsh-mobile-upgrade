# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | [Español](../es/README.md) | [Français](../fr/README.md) | Deutsch | [Русский](../ru/README.md)

Mobilfreundliche Verbesserungen für das Web-Profil von [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), ausgeliefert als ein einzelnes Plugin. Fast alles rendert über die eigenen Slots und Zustandssignale des Hosts — keine Layout-Übernahme, kein DOM-Polling des Chats. Einige Overlays sind absichtlich fest positioniertes reines DOM — der Verbindungschip/die Verbindungskarte unten links, das Selbstaktualisierungs-Banner, der gemeinsame Toast: Sie müssen gerade dann überleben, wenn der React-Baum des Hosts eingefroren ist.

## Was Sie bekommen

- **Neustart-Zeile** — ein Eintrag „Dienst neu starten" unter Einstellungen → Allgemein. Fragt zuerst nach, startet den `dsh`-Prozess neu und lädt die Seite automatisch neu, sobald der Dienst wieder antwortet.
- **Scrollbare Fragekarte** — unter 1024px kann eine offene Frage ihre eigenen Optionen nicht mehr aus dem Bild drängen: Die Frage bekommt einen eigenen, höhenbegrenzten Scrollbereich, sodass eine lange Frage an Ort und Stelle scrollt, während die Optionsliste darunter den verbleibenden Platz behält und die Optionen, die Sendezeile und die Schaltflächen zum Minimieren und Schließen auf dem Bildschirm bleiben und erreichbar sind. Eine kurze Frage bleibt unangetastet, und die Karte umschließt weiterhin ihren Inhalt.
- **Sturmsichere Reaktivität** — der dokumentweite Beobachter der Fragekarte und der Settings-Poller reagieren auf einen Burst von Streaming-Nachrichten mit gedrosselter Rate und gehen in Backoff, solange der Host nicht erreichbar ist: Viele gleichzeitig streamende Sitzungen frieren die Eingabe nicht mehr ein und bremsen die Seite nicht mehr aus, während die Seitenleiste ganz beim eigenen schmalen Layout des Hosts bleibt.
- **Guard für den Subagenten-Katalog** — der Host dient den Subagenten-Katalog, indem er pro Anfrage das gesamte Sitzungskorpus aufzählt (~1s bei langer Historie), und sein Client fragt bei jeder Auswahl, jedem Chip-Hover und jedem Membership-Ereignis nach. Das Plugin wrappt diesen Refresh: Ein Eltern-Agent ohne Kinder in der Live-Sitzungsliste wird nie gefragt, ein Eltern-Agent wird höchstens einmal pro 2,5s erneut gefragt, und Refresh-Starts werden zeitlich versetzt — ein Subagenten-Fan-Out hungert den Host nicht mehr mit Full-Corpus-Scans aus.
- **Per Klick öffnende Lineage-Chips** — auf dem Desktop öffnen sich die Subagenten-Chips („N subagents" und der Subagenten-Titel-Umschalter) im aktuellen Host nur beim Hover; ein Klick tut nichts. Das Plugin übersetzt einen Klick auf einen Chip in das Hover-Ereignispaar, das der Host bereits versteht, sodass ein Klick den Baum öffnet und schließt (Crumbs der Vorfahren behalten ihr Navigate-on-Click).
- **Header-Collector auf schmalen Bildschirmen** — unter 1024px sind die Chips des Sitzungs-Headers (Lineage, Jobs, Preset) breiter als das Telefon und nur per Hover bedienbar. Sie falten sich zu einem Pill (`≡ Titel · N agents · M jobs`); ein Tip darauf öffnet ein Sheet in voller Breite mit der Session-Lineage (jeder Vorfahr antippbar, jeder mit seiner Nachfahrenzahl), dem am Familien-Root verwurzelten Subagenten-Baum — Zeilen rendern aus der Live-Sitzungsliste, Zweige holen ihren Katalog on demand über den bewachten Refresh — und den Hintergrund-Jobs dieser Sitzung. Auf dem Desktop ändert sich nichts.
- **Selbst-Update** — das Client-Bundle wird pro Revision unveränderlich ausgeliefert, daher kann ein Telefon-Tag tagelang einen älteren Build weiterlaufen lassen. Die Seite vergleicht die Revision, mit der sie gebootet hat, mit der, die der Server jetzt veröffentlicht, und lädt sich selbst neu, sobald die Seite idle ist (nie, während ein Entwurf getippt wird), oder bietet ein antippbares Banner an.
- **Render-Drossel der Sitzungsliste** — der Host sendet für jede Projektionsänderung jeder angehängten Sitzung ein Ganzwert-Frame, und die Timing-Ansicht eines laufenden Subagenten ändert sich mit jedem committeten Event — eine beschäftigte Hintergrund-Flotte streamt also 50-150 Frames/s in die Seite. Jedes Frame renderte bisher die gesamte Sitzungsliste neu (ein Rebuild läuft über jede Summary plus einen O(n²)-Cache-Sweep — gemessen als der Großteil der Main-Thread-Zeit; die Seite fror bis zum Neuladen). Das Plugin fasst diese Re-Renders auf ein adaptives Trailing-Intervall zusammen, während die Werte unverändert weiter in die Per-Sitzungs-Stores fließen — Hintergrund-Streaming friert die Seite nicht mehr ein, egal welche Sitzung offen ist.
- **Verbindungskarte** — das Verbindungssteuerelement unten links im Host reagiert auf einen Klick mit nichts Beobachtbarem: Die angeforderte Neuverbindung taucht zurück in denselben verklemmten Transport, die Wiederherstellungsanzeige ist ein nicht klickbares div, das nach einem Timer verschwindet, und die schmale Rail/Drawer-Seitenleiste rendert es ohnehin nicht. Dieses Plugin verankert den Status mit einem reinen-DOM-Chip in dieser Ecke (lebendig sogar, wenn der React-Baum des Hosts eingefroren ist) und lässt darüber eine semi-permanente Karte aufploppen: Sie bleibt, solange der Zeiger darin ist, blendet sich sonst automatisch aus und führt die beiden Aktionen mit, die wirklich wirken — eine sofortige Neuverbindung über den Verbindungsdienst und ein vollständiges manuelles Neuladen der Seite. Hängende oder fehlgeschlagene `/api/`-Anfragen erscheinen am selben Ort: ein Badge mit Zähler auf dem Chip, in der Karte eine Anfragenliste samt Lebenszeichen-Probe — so viele Anfragen auch hängen oder scheitern, neben den Composer-Steuerungen erscheint künftig keine Warnung mehr.
- **Schalter pro Funktion** — das Plugin installiert einen Abschnitt `dsh-mobile-upgrade` unter Einstellungen → Plugins mit einem Schalter pro Funktion.

## Screenshots

Einstellungen als Tabs auf schmalen Bildschirmen und der Header-Collector (mit Beschriftung):

| | |
|---|---|
| ![Einstellungen-Tabs](../../res/shot-settings-tabs.png) | ![Header-Collector](../../res/shot-header-collector.png) |

## Installation

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Starten Sie `dsh web` neu und öffnen Sie das Web-Profil auf dem Telefon: Die Neustart-Zeile findet sich unter Einstellungen → Allgemein und die Funktionsschalter unter Einstellungen → Plugins → dsh-mobile-upgrade. Anhänge kommen aus dem eigenen Anhang-System des Composer des Hosts.

Erfordert `dsh` 0.2.0-rc.2 oder neuer (das eingebaute Anhang-System des Hosts hat die Upload-Funktion dieses Plugins ersetzt). Der Host bringt den Schmalbildschirm-Teil nun selbst mit — einen Drawer mit Öffnen-Schaltflächen in den beiden oberen Fensterecken —, sodass dieses Plugin die Seitenleiste nicht mehr anfasst: Der eigene Drawer-Takeover und der schwebende Button wurden in den Ruhestand geschickt, statt weiter gegen die native Implementierung zu kämpfen; geblieben sind die Erweiterungen unten.

## Konfiguration

Die Einstellungskarte des Plugins listet einen Schalter pro Funktion (siehe Funktionsschalter); `restartEnabled` steuert zusätzlich die Neustart-Route:

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| `restartEnabled` | `true` | Neustart-Zeile und ihre Route anbieten |

## Funktionsschalter

Jede der obigen Funktionen lässt sich unter Einstellungen → Plugins → dsh-mobile-upgrade umschalten (wirksam beim nächsten Laden der Seite) oder pro Gerät mit einem `localStorage`-Schlüssel überschreiben — `mfx-restart`, `mfx-net`, `mfx-questions`, `mfx-selfupdate`, `mfx-agents`, `mfx-header`, `mfx-listthrottle`, `mfx-conn` — wobei der Wert `"0"` die Funktion ausschaltet. Der Schlüssel `mfx-drawer` des ausgemusterten Drawers und die pro Gerät gespeicherte Ziehposition (`mfx-chip-side` / `mfx-chip-top`) werden nicht mehr gelesen; aufräumen ist optional.

## Bekannte Einschränkungen

- Der Client hängt sich über veröffentlichte `data-*`-Verträge an die Host-Oberfläche — den `data-question-key` der Fragekarte und den `data-slot`-Sitz des Header-Collectors — und, wo der Host kein Attribut veröffentlicht, über den lokalen Teil eines CSS-Modul-Klassennamens (`_crumbs`, `_tabs`, `_headingBlock`). Die auf die Seitenleiste bezogenen Hooks des ausgemusterten Drawers (`data-sidebar-*`, `data-rightbar-col`, `data-shortcut-modal`, `_sidebarCol`) sind mit ihm weggefallen. Alle überleben einen Neubau: Das Hash vor dem lokalen Namen ist das Einzige, was ein Neubau ändert. Benennt ein Host-Build die verbleibenden Verträge um, degradieren die betroffenen Funktionen, bis dieses Plugin nachzieht; alles andere funktioniert weiter.
- Der Header-Collector und der Lineage-Klick-Shim reiten auf den eigenen Daten des Hosts (der Live-Sitzungsliste und ihren Subagenten-Katalogen); sie fügen außer den bewachten Zweig-Fetches keine Requests hinzu, und ein Tap auf eine Zeile, deren Modus noch lädt, vervollständigt sich von selbst, sobald der Katalog eintrifft.
- Eingabemodalitäts-Schalter können nur Provider-Routen patchen, die Sie selbst angepasst haben; reine Katalogrouten sind absichtlich nur lesend, weil eine erfundene Katalogsektion das Modellverzeichnis zum Einsturz bringt.

## Sicherheitshinweise

Die HTTP-Routen des Plugins (Neustart, Einstellungsänderungen) nehmen keine eigene Authentifizierung vor — sie vertrauen der `dsh`-Web-Oberfläche, in die sie geladen werden. Bevor Sie die Bereitstellung über localhost hinaus freigeben, stellen Sie sie hinter dieselbe Schranke wie den Rest der Oberfläche (Reverse-Proxy-Auth, Loopback-Bindung).

## Community-Links

- [Linux.Do](https://linux.do) — Eine Community zum Teilen und Diskutieren von Technik.

## Lizenz

Vertrieben unter der [Synthetic Source License (SySL), Version 1.0](LICENSE).

> HINWEIS: Diese Software enthält von künstlicher Intelligenz generierten Code. Siehe die LICENSE-Datei für die Bedingungen der Synthetic Source License, einschließlich der Anforderungen zur Modelloffenlegung.
