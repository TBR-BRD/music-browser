# Dein Music Browser

🇩🇪 Deutsch · [🇬🇧 English](README_EN.md)

Radio direkt im Browser: **rund 290 Sender** von 9 Anbietern, mit großem Albumcover, aktuellem Titel, Datum, Uhrzeit und Wetter. Abspielen kannst du im Browserfenster oder per **Chromecast / Google Cast**.

Die Webseite ist rein statisch und läuft auf **GitHub Pages**, ohne eigenen Server und weltweit erreichbar.

**▶ Live-Version: [tbr-brd.github.io/music-browser](https://tbr-brd.github.io/music-browser/)**

<br>
<a href="https://www.buymeacoffee.com/thoralf.brandt" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174">
</a>
<br>

## Funktionen

- **Anbieter-Buttons** (in der Vollansicht links über den Sendern): ON Radio, 80s80s, Sunshine Live, RADIO BOB!, HIT RADIO FFH, Absolut Radio, ENERGY, ANTENNE BAYERN, Eigene und ★ Favoriten. Darunter stehen nur die Sender des gewählten Anbieters.
- **Suche** über alle Sender, auch mit mehreren Wörtern (z. B. „bob rock“)
- **Favoriten** per ☆ beim laufenden Sender
- **Großes Cover und aktueller Titel** bei 80s80s, RADIO BOB!, Sunshine Live, HIT RADIO FFH und ENERGY, direkt von deren Schnittstellen und sonst über die iTunes-Suche. Ohne laufenden Titel erscheint das Senderlogo des Anbieters.
- **Datum und Uhrzeit** oben rechts
- **Wetter** wie bei onradio-cover-bridge: aktuell mit Luftdruck und Tendenz (↑ → ↓), dazu Heute und Morgen mit Niederschlag (Open-Meteo)
- **QR-Code** oben rechts zum Weitergeben der Seite an Freunde; ein Klick vergrößert ihn
- **Als App speichern:** Wer die Seite über den QR-Code oder zum ersten Mal auf dem Handy öffnet, bekommt das Speichern auf dem Startbildschirm angeboten. Unter Android/Chrome genügt ein Tipp auf „Speichern“, auf iPhone/iPad erklärt der Hinweis den Weg über „Teilen → Zum Home-Bildschirm“. „Später“ blendet ihn für 30 Tage aus. Die Seite läuft dann wie eine App im Vollbild.
- **Zwei Ansichten:** Voll (Desktop/TV) und Mobil. Sie schalten sich automatisch nach Bildschirmbreite um. Der Button 🔄/🖥️/📱 schaltet zwischen Auto, Voll und Mobil.
- **Einstellungen:** Ort für das Wetter und Dunkel-/Hell-Modus
- **Chromecast / Google Cast** in Chrome und Edge
- Medientasten und Sperrbildschirm-Anzeige (Media Session API), Leertaste für Play/Stopp

## Senderliste

Die Sender kommen live aus [radiostations](https://github.com/TBR-BRD/radiostations), dem gemeinsamen Katalog für dieses Projekt, die [Google-TV-App](https://github.com/TBR-BRD/googletv-musicplayer) und den [Raspberry Pi](https://github.com/TBR-BRD/onradio-cover-bridge). Ein neuer Sender wird dort einmal eingetragen und erscheint dann überall. Die Gruppe „Other stations“ heißt hier **Eigene**.

## Wo werden Favoriten und Einstellungen gespeichert?

Nur **im Browser** (`localStorage`), nicht auf einem Server. Sie bleiben erhalten, bis du die Websitedaten löschst. Auf einem anderen Gerät oder in einem anderen Browser fängst du mit leeren Favoriten an.

## Warum zeigen manche Sender keinen Titel?

Eine Webseite darf Daten fremder Server nur lesen, wenn der Anbieter das erlaubt (CORS). Die Google-TV-App und der Raspberry Pi sind eigene Programme, für sie gilt diese Sperre nicht.

| Anbieter | Titel und Cover im Browser |
|---|---|
| 80s80s, RADIO BOB!, Sunshine Live, HIT RADIO FFH, ENERGY | ✅ direkt über deren Schnittstellen |
| ON Radio | ✅ teilweise: Hits, Charts, Oldies, Chillout, Relax, Pop, Dance (Icecast-Status von radionetz) |
| übrige ON-Sender, Absolut Radio, ANTENNE BAYERN, Eigene | ❌ nur Sendername bzw. Logo, der Stream läuft trotzdem |

Wer auch dort Titel haben möchte, kann optional einen kleinen Helfer betreiben, z. B. den Cloudflare Worker aus [`proxy/worker.js`](proxy/worker.js). Seine Adresse wird dann in `js/config.js` als `METADATA_PROXY` eingetragen. Nötig ist das nicht.

## Installation auf GitHub Pages

1. Repository forken oder die Dateien in ein eigenes Repository hochladen.
2. **Settings → Pages**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten läuft die Seite unter `https://<name>.github.io/music-browser/`.

## Lokal testen

```bash
python3 -m http.server 8000
# http://localhost:8000 öffnen
```

## Repository-Struktur

```text
index.html          Seite
css/style.css       Gestaltung: Dunkel/Hell, Voll- und Mobilansicht
js/app.js           Oberfläche, Wiedergabe, Ansicht, Einstellungen
js/config.js        Gruppennamen, direkte Stream-Adressen, optionaler Helfer
js/stations.js      Senderliste laden (mit Offline-Kopie)
js/metadata.js      Titel, Interpret, Cover (80s80s, BOB, Sunshine Live, FFH, ENERGY)
js/cover.js         Cover-Suche (iTunes) und Platzhalter
js/weather.js       Wetter (Open-Meteo)
assets/             Icon, QR-Code, Wettersymbole (aus onradio-cover-bridge)
js/cast.js          Google Cast
js/storage.js       Einstellungen und Favoriten (localStorage)
js/install.js       Angebot „Als App speichern“
manifest.webmanifest, sw.js   Installierbare Web-App (PWA)
proxy/worker.js     Optionaler Metadaten-Helfer (Cloudflare Worker)
```

## Datenschutz

Es gibt keinen eigenen Server und kein Tracking. Die Seite lädt nur die Streams und Titel der Radiosender, Cover von iTunes und das Wetter von Open-Meteo. Einstellungen und Favoriten bleiben in deinem Browser.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Senderlogos, Cover und Streams gehören den jeweiligen Rechteinhabern.
