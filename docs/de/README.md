# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | [Español](../es/README.md) | [Français](../fr/README.md) | Deutsch | [Русский](../ru/README.md)

Mobilfreundliche Verbesserungen für das Web-Profil von [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), ausgeliefert als ein einzelnes Plugin. Alles rendert über die eigenen Slots und Zustandssignale des Hosts — keine Layout-Übernahme, keine schwebenden Widgets, kein DOM-Polling des Chats.

## Was Sie bekommen

- **Anhang-Upload im Composer** — ein Büroklammer-Button neben der Werkzeugzeile des Composers. Bilder gehen über den nativen Einfüge-Pfad des Editors; jede andere Datei wird auf den Server geladen und ihr absoluter Pfad in den Entwurf eingefügt, damit der Agent sie mit seinen Datei-Werkzeugen lesen kann.
- **Neustart-Zeile** — ein Eintrag „Dienst neu starten" unter Einstellungen → Allgemein. Fragt zuerst nach, startet den `dsh`-Prozess neu und lädt die Seite automatisch neu, sobald der Dienst wieder antwortet.
- **Eingabemodalitäts-Schalter** — Text/Bild/Video-Kontrollkästchen an jeder Modellzeile des nativen Provider-Editors, die das `input`-Array des Modells in die `settings.yaml` zurückschreibt (mit Sicherung neben der Datei). Katalogmodelle ohne benutzerdefinierte Route zeigen die Schalter nur lesend.
- **Drawer für schmale Bildschirme** — unter 1024px schrumpft die Seitenleiste zu einem kleinen Eck-Chip, der den eigenen Umschalter des Hosts behält; ausgeklappt schwebt die volle Seitenleiste als Drawer über dem Inhalt in voller Breite, und die Wahl einer Sitzung schließt ihn wieder.
- **Einstellungen als Tabs auf schmalen Bildschirmen** — unter 700px wird die Seitennavigation des Einstellungsdialogs zu einer horizontal scrollbaren Tab-Leiste.
- **Modellmenü in voller Bildschirmbreite** — unter 700px wird das Modellmenü des Composers genau auf die Telefonbreite (12px Ränder) verankert, statt vom Bildschirmrand abgeschnitten zu werden; die vertikale Platzierung über dem Auslöser übernimmt weiterhin der Host.
- **Scrollbare Fragekarte** — unter 1024px kann eine offene Frage ihre eigenen Optionen nicht mehr aus dem Bild drängen: Die Frage bekommt einen eigenen, höhenbegrenzten Scrollbereich, sodass eine lange Frage an Ort und Stelle scrollt, während die Optionsliste darunter den verbleibenden Platz behält und die Optionen, die Sendezeile und die Schaltflächen zum Minimieren und Schließen auf dem Bildschirm bleiben und erreichbar sind. Eine kurze Frage bleibt unangetastet, und die Karte umschließt weiterhin ihren Inhalt.
- **Ablösung des Detail-Overlays** — das Vollbild-Overlay der Werkzeugdetails, dessen Schließen-Steuerung im aktuellen Host wirkungslos ist, wird auf schmalen Bildschirmen gar nicht gerendert und kann den Chat daher nicht blockieren.
- **Schalter pro Funktion** — das Plugin installiert einen Abschnitt `dsh-mobile-upgrade` unter Einstellungen → Plugins mit einem Schalter pro Funktion.

## Screenshots

Schwebender Chip, Session-Drawer, Einstellungs-Tabs auf schmalen Bildschirmen und der Anhang-Button im Composer (mit Beschriftung):

| | |
|---|---|
| ![Schwebender Chip](../../res/shot-floating-chip.png) | ![Session-Drawer](../../res/shot-drawer.png) |
| ![Einstellungs-Tabs](../../res/shot-settings-tabs.png) | ![Anhang-Button](../../res/shot-composer-attach.png) |

## Installation

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Starten Sie `dsh web` neu und öffnen Sie das Web-Profil auf dem Telefon: Die Büroklammer sitzt im Composer, die Neustart-Zeile unter Einstellungen → Allgemein und die Funktionsschalter unter Einstellungen → Plugins → dsh-mobile-upgrade.

Erfordert `dsh` 0.1.2-rc.1 oder neuer.

## Konfiguration

Die Einstellungskarte des Plugins nimmt:

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| `uploadDir` | `<dsh home>/mobile-uploads` | Speicherort für Uploads, die keine Bilder sind |
| `restartEnabled` | `true` | Neustart-Zeile und ihre Route anbieten |

## Funktionsschalter

Jede der obigen Funktionen lässt sich unter Einstellungen → Plugins → dsh-mobile-upgrade umschalten (wirksam beim nächsten Laden der Seite) oder pro Gerät mit einem `localStorage`-Schlüssel überschreiben — `mfx-attach`, `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus`, `mfx-questions` — wobei der Wert `"0"` die Funktion ausschaltet.

## Bekannte Einschränkungen

- Der Client hängt sich über gehashte CSS-Klassennamen an bestimmte Elemente der Host-Oberfläche (Menü, Drawer-Umschalter, Provider-Editor). Benennt ein Host-Build diese um, degradieren die betroffenen Funktionen, bis dieses Plugin nachzieht; alles andere funktioniert weiter. Der Fragebereich der Fragekarte wird stattdessen über deren eigenen Hook `data-question-key` gefunden, sodass er auch dann weiter funktioniert, wenn ein Host-Neubau lediglich seine CSS-Module neu hasht.
- Eingabemodalitäts-Schalter können nur Provider-Routen patchen, die Sie selbst angepasst haben; reine Katalogrouten sind absichtlich nur lesend, weil eine erfundene Katalogsektion das Modellverzeichnis zum Einsturz bringt.

## Sicherheitshinweise

Die HTTP-Routen des Plugins (Upload, Neustart, Einstellungsänderungen) nehmen keine eigene Authentifizierung vor — sie vertrauen der `dsh`-Web-Oberfläche, in die sie geladen werden. Bevor Sie die Bereitstellung über localhost hinaus freigeben, stellen Sie sie hinter dieselbe Schranke wie den Rest der Oberfläche (Reverse-Proxy-Auth, Loopback-Bindung).

## Community-Links

- [Linux.Do](https://linux.do) — Eine Community zum Teilen und Diskutieren von Technik.

## Lizenz

Vertrieben unter der [Synthetic Source License (SySL), Version 1.0](LICENSE).

> HINWEIS: Diese Software enthält von künstlicher Intelligenz generierten Code. Siehe die LICENSE-Datei für die Bedingungen der Synthetic Source License, einschließlich der Anforderungen zur Modelloffenlegung.
