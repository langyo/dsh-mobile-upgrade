# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | [Español](../es/README.md) | [Français](../fr/README.md) | Deutsch | [Русский](../ru/README.md)

Mobilfreundliche Verbesserungen für das Web-Profil von [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), ausgeliefert als ein einzelnes Plugin. Alles rendert über die eigenen Slots und Zustandssignale des Hosts — keine Layout-Übernahme, keine schwebenden Widgets, kein DOM-Polling des Chats.

## Was Sie bekommen

- **Neustart-Zeile** — ein Eintrag „Dienst neu starten" unter Einstellungen → Allgemein. Fragt zuerst nach, startet den `dsh`-Prozess neu und lädt die Seite automatisch neu, sobald der Dienst wieder antwortet.
- **Eingabemodalitäts-Schalter** — Text/Bild/Video-Kontrollkästchen an jeder Modellzeile des nativen Provider-Editors, die das `input`-Array des Modells in die `settings.yaml` zurückschreibt (mit Sicherung neben der Datei). Katalogmodelle ohne benutzerdefinierte Route zeigen die Schalter nur lesend.
- **Drawer für schmale Bildschirme** — unter 1024px schrumpft die Seitenleiste zu einem kleinen Eck-Chip, der den eigenen Umschalter des Hosts behält; ausgeklappt schwebt die volle Seitenleiste als Drawer über dem Inhalt in voller Breite, und die Wahl einer Sitzung schließt ihn wieder. Chip und Drawer werden atomar getauscht (keine Geometrie-Animation, die auf einem ausgelasteten Main-Thread einfrieren kann), und ein Tippen, das den Drawer schließt, klappt ihn im selben Frame ein, statt auf das erneute Rendern des Hosts zu warten — so kann ein Telefon mit vielen laufenden Sitzungen den Drawer nicht halb ausgeklappt zurücklassen, und der geschlossene Chip liegt nie weiß über einer Leiste, die der Host bereits geleert hat.
- **Einstellungen als Tabs auf schmalen Bildschirmen** — unter 700px wird die Seitennavigation des Einstellungsdialogs zu einer horizontal scrollbaren Tab-Leiste.
- **Modellmenü in voller Bildschirmbreite** — unter 700px wird das Modellmenü des Composers genau auf die Telefonbreite (12px Ränder) verankert, statt vom Bildschirmrand abgeschnitten zu werden; die vertikale Platzierung über dem Auslöser übernimmt weiterhin der Host.
- **Scrollbare Fragekarte** — unter 1024px kann eine offene Frage ihre eigenen Optionen nicht mehr aus dem Bild drängen: Die Frage bekommt einen eigenen, höhenbegrenzten Scrollbereich, sodass eine lange Frage an Ort und Stelle scrollt, während die Optionsliste darunter den verbleibenden Platz behält und die Optionen, die Sendezeile und die Schaltflächen zum Minimieren und Schließen auf dem Bildschirm bleiben und erreichbar sind. Eine kurze Frage bleibt unangetastet, und die Karte umschließt weiterhin ihren Inhalt.
- **Ablösung des Detail-Overlays** — das Vollbild-Overlay der Werkzeugdetails, dessen Schließen-Steuerung im aktuellen Host wirkungslos ist, wird auf schmalen Bildschirmen gar nicht gerendert und kann den Chat daher nicht blockieren.
- **Sturmsichere Reaktivität** — die Drawer-/Menü-Beobachter und der Settings-Poller reagieren auf einen Burst von Streaming-Nachrichten mit gedrosselter Rate und gehen in Backoff, solange der Host nicht erreichbar ist; ein Rail-Remount während einer Wiederverbindung hält den Drawer-Zustand statt ihn flackern zu lassen, und Drawer-Schließen-Tipps wiederholen sich durch einen Remount, statt auf einem veralteten Umschalter zu landen: viele gleichzeitig streamende Sitzungen frieren die Eingabe nicht mehr ein und zucken die Seitenleiste nicht mehr unklickbar — ob offen oder geschlossen.
- **Guard für den Subagenten-Katalog** — der Host dient den Subagenten-Katalog, indem er pro Anfrage das gesamte Sitzungskorpus aufzählt (~1s bei langer Historie), und sein Client fragt bei jeder Auswahl, jedem Chip-Hover und jedem Membership-Ereignis nach. Das Plugin wrappt diesen Refresh: Ein Eltern-Agent ohne Kinder in der Live-Sitzungsliste wird nie gefragt, ein Eltern-Agent wird höchstens einmal pro 2,5s erneut gefragt, und Refresh-Starts werden zeitlich versetzt — ein Subagenten-Fan-Out hungert den Host nicht mehr mit Full-Corpus-Scans aus.
- **Per Klick öffnende Lineage-Chips** — auf dem Desktop öffnen sich die Subagenten-Chips („N subagents" und der Subagenten-Titel-Umschalter) im aktuellen Host nur beim Hover; ein Klick tut nichts. Das Plugin übersetzt einen Klick auf einen Chip in das Hover-Ereignispaar, das der Host bereits versteht, sodass ein Klick den Baum öffnet und schließt (Crumbs der Vorfahren behalten ihr Navigate-on-Click).
- **Header-Collector auf schmalen Bildschirmen** — unter 1024px sind die Chips des Sitzungs-Headers (Lineage, Jobs, Preset) breiter als das Telefon und nur per Hover bedienbar. Sie falten sich zu einem Pill (`≡ Titel · N agents · M jobs`); ein Tip darauf öffnet ein Sheet in voller Breite mit der Session-Lineage (jeder Vorfahr antippbar, jeder mit seiner Nachfahrenzahl), dem am Familien-Root verwurzelten Subagenten-Baum — Zeilen rendern aus der Live-Sitzungsliste, Zweige holen ihren Katalog on demand über den bewachten Refresh — und den Hintergrund-Jobs dieser Sitzung. Auf dem Desktop ändert sich nichts.
- **Selbst-Update** — das Client-Bundle wird pro Revision unveränderlich ausgeliefert, daher kann ein Telefon-Tag tagelang einen älteren Build weiterlaufen lassen. Die Seite vergleicht die Revision, mit der sie gebootet hat, mit der, die der Server jetzt veröffentlicht, und lädt sich selbst neu, sobald die Seite idle ist (nie, während ein Entwurf getippt wird), oder bietet ein antippbares Banner an.
- **Render-Drossel der Sitzungsliste** — der Host sendet für jede Projektionsänderung jeder angehängten Sitzung ein Ganzwert-Frame, und die Timing-Ansicht eines laufenden Subagenten ändert sich mit jedem committeten Event — eine beschäftigte Hintergrund-Flotte streamt also 50-150 Frames/s in die Seite. Jedes Frame renderte bisher die gesamte Sitzungsliste neu (ein Rebuild läuft über jede Summary plus einen O(n²)-Cache-Sweep — gemessen als der Großteil der Main-Thread-Zeit; die Seite fror bis zum Neuladen). Das Plugin fasst diese Re-Renders auf ein adaptives Trailing-Intervall zusammen, während die Werte unverändert weiter in die Per-Sitzungs-Stores fließen — Hintergrund-Streaming friert die Seite nicht mehr ein, egal welche Sitzung offen ist.
- **Schalter pro Funktion** — das Plugin installiert einen Abschnitt `dsh-mobile-upgrade` unter Einstellungen → Plugins mit einem Schalter pro Funktion.

## Screenshots

Schwebender Chip und Session-Drawer (mit Beschriftung):

| | |
|---|---|
| ![Schwebender Chip](../../res/shot-floating-chip.png) | ![Session-Drawer](../../res/shot-drawer.png) |

## Installation

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Starten Sie `dsh web` neu und öffnen Sie das Web-Profil auf dem Telefon: Die Neustart-Zeile findet sich unter Einstellungen → Allgemein und die Funktionsschalter unter Einstellungen → Plugins → dsh-mobile-upgrade. Anhänge kommen aus dem eigenen Anhang-System des Composer des Hosts.

Erfordert `dsh` 0.1.5-rc.1 oder neuer (das eingebaute Anhang-System des Hosts hat die Upload-Funktion dieses Plugins ersetzt).

## Konfiguration

Die Einstellungskarte des Plugins nimmt:

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| `restartEnabled` | `true` | Neustart-Zeile und ihre Route anbieten |

## Funktionsschalter

Jede der obigen Funktionen lässt sich unter Einstellungen → Plugins → dsh-mobile-upgrade umschalten (wirksam beim nächsten Laden der Seite) oder pro Gerät mit einem `localStorage`-Schlüssel überschreiben — `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus`, `mfx-net`, `mfx-questions`, `mfx-selfupdate`, `mfx-agents`, `mfx-header`, `mfx-listthrottle` — wobei der Wert `"0"` die Funktion ausschaltet.

## Bekannte Einschränkungen

- Der Client hängt sich über gehashte CSS-Klassennamen an bestimmte Elemente der Host-Oberfläche (Menü, Drawer-Umschalter, Provider-Editor, Sitzungs-Header-Chips). Benennt ein Host-Build diese um, degradieren die betroffenen Funktionen, bis dieses Plugin nachzieht; alles andere funktioniert weiter. Der Fragebereich der Fragekarte wird stattdessen über deren eigenen Hook `data-question-key` gefunden, sodass er auch dann weiter funktioniert, wenn ein Host-Neubau lediglich seine CSS-Module neu hasht.
- Der Header-Collector und der Lineage-Klick-Shim reiten auf den eigenen Daten des Hosts (der Live-Sitzungsliste und ihren Subagenten-Katalogen); sie fügen außer den bewachten Zweig-Fetches keine Requests hinzu, und ein Tap auf eine Zeile, deren Modus noch lädt, vervollständigt sich von selbst, sobald der Katalog eintrifft.
- Eingabemodalitäts-Schalter können nur Provider-Routen patchen, die Sie selbst angepasst haben; reine Katalogrouten sind absichtlich nur lesend, weil eine erfundene Katalogsektion das Modellverzeichnis zum Einsturz bringt.

## Sicherheitshinweise

Die HTTP-Routen des Plugins (Neustart, Einstellungsänderungen) nehmen keine eigene Authentifizierung vor — sie vertrauen der `dsh`-Web-Oberfläche, in die sie geladen werden. Bevor Sie die Bereitstellung über localhost hinaus freigeben, stellen Sie sie hinter dieselbe Schranke wie den Rest der Oberfläche (Reverse-Proxy-Auth, Loopback-Bindung).

## Community-Links

- [Linux.Do](https://linux.do) — Eine Community zum Teilen und Diskutieren von Technik.

## Lizenz

Vertrieben unter der [Synthetic Source License (SySL), Version 1.0](LICENSE).

> HINWEIS: Diese Software enthält von künstlicher Intelligenz generierten Code. Siehe die LICENSE-Datei für die Bedingungen der Synthetic Source License, einschließlich der Anforderungen zur Modelloffenlegung.
