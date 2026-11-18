# music-browser

🇩🇪 Deutsch · [🇬🇧 English](README_EN.md)

Radio und Musik direkt im Browser: **253 Sender** mit großem Albumcover, aktuellem Titel, Uhr und Wetter. Abspielen kannst du im Browserfenster, auf **Chromecast / Google-Cast-Lautsprechern** oder auf jedem **Home-Assistant-Media-Player** (Sonos, Denon/HEOS, Echo …).

Die Webseite ist rein statisch und läuft auf **GitHub Pages**, ohne eigenen Server und weltweit erreichbar.

<br>
<a href="https://www.buymeacoffee.com/thoralf.brandt" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174">
</a>
<br>

## Funktionen

- Senderliste live aus [radiostations](https://github.com/TBR-BRD/radiostations), mit Offline-Kopie im Browser
- Gruppen (ON Radio, 80s80s, RADIO BOB!, FFH, ENERGY, Sunshine Live, Absolut …), Suche und Favoriten
- Großes Cover: von der 80s80s-API direkt, sonst über die iTunes Search API (mit Cache und Drosselung)
- Titel und Interpret: 80s80s direkt; ON Radio und ICY-Streams über den optionalen Metadaten-Proxy
- Wetter von Open-Meteo, mit Ort wählbar (Standard: Falkensee), aktuell plus drei Tage
- Ausgabe: dieser Browser, Google Cast (Chrome/Edge) oder Home-Assistant-Player
- Medientasten, Sperrbildschirm-Anzeige (Media Session API), Leertaste = Play/Stopp
- Mobil bedienbar
- In Vorbereitung (Phase 2): Spotify (Web Playback SDK, Spotify Connect) und Apple Music (MusicKit JS)

## Herkunft

Das Projekt vereint drei bestehende Projekte:

| Projekt | Übernommen |
|---|---|
| [radiostations](https://github.com/TBR-BRD/radiostations) | Senderkatalog (`stations.json`) |
| [googletv-musicplayer](https://github.com/TBR-BRD/googletv-musicplayer) | Metadaten-Logik (ICY, ON-Radio-JSON, 80s80s-API), Wettercodes, Ausgabe-Idee |
| [cover-music-player](https://github.com/TBR-BRD/cover-music-player) | Cover-Suche, Encoding-Korrektur, Player-Ansicht |

## Was im Browser direkt geht und was nicht

Ein Browser darf von einer fremden Seite nur Daten lesen, wenn der Anbieter das per CORS erlaubt. Getestet von einer https-Seite aus:

| Quelle | Direkt im Browser |
|---|---|
| Audio-Streams (auch http-Streams, Chrome stuft sie auf https hoch) | ✅ |
| `stations.json`, 80s80s-API, iTunes, Open-Meteo | ✅ |
| ON-Radio-JSON (`0nradio.com`) | ❌ CORS, braucht den Proxy |
| ICY-Titel aus dem Stream (RADIO BOB!, FFH, ENERGY, Sunshine Live …) | ❌ braucht den Proxy |
| m3u-Playlists (Absolut Radio, Fritz, rbb888) | ❌ braucht den Proxy |

**Ohne Proxy** laufen alle Direkt-Streams, und die 80s80s-Sender zeigen Titel und Cover. Die anderen Sender zeigen „Livestream“, m3u-Sender sind mit „Proxy“ markiert.
**Mit Proxy** gibt es Titel und Cover für alle 253 Sender.

## Installation auf GitHub Pages

1. Neues Repository `music-browser` anlegen und alle Dateien hochladen.
2. **Settings → Pages → Build and deployment**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten läuft die Seite unter `https://tbr-brd.github.io/music-browser/`.
4. Optional mit eigener Domain, z. B. `music.lets-make.de`: CNAME-Eintrag bei goneo auf `tbr-brd.github.io` setzen und unter **Settings → Pages → Custom domain** eintragen. Danach „Enforce HTTPS“ aktivieren.

## Metadaten-Proxy (Cloudflare Worker, kostenlos)

Der Proxy steht in [`proxy/worker.js`](proxy/worker.js). Er liest den aktuellen Titel aus ICY-Streams, löst m3u/pls-Playlists auf und reicht das ON-Radio-JSON mit CORS-Header durch. Er beantwortet nur Anfragen von deiner eigenen Seite. Lokale Adressen sind gesperrt, und es werden nur kleine Datenmengen gelesen, kein Audio.

1. Bei [Cloudflare](https://dash.cloudflare.com) kostenlos anmelden.
2. **Workers & Pages → Create → Worker**, Name z. B. `music-proxy`, dann **Deploy**.
3. **Edit code**: den Inhalt von `proxy/worker.js` einfügen und **Deploy** klicken.
4. **Settings → Variables**: `ALLOWED_ORIGINS` = `https://tbr-brd.github.io` (bei eigener Domain zusätzlich mit Komma `https://music.lets-make.de`).
5. In music-browser unter ⚙️ die Worker-URL eintragen, z. B. `https://music-proxy.DEINNAME.workers.dev`.

Der Free-Plan erlaubt 100.000 Anfragen pro Tag. Bei einer Abfrage alle 15 Sekunden sind das rund 5.800 pro Stunde Dauerbetrieb.

## Home Assistant als Ausgabe

1. Home Assistant muss per **https** erreichbar sein (z. B. Nabu Casa), sonst blockiert Chrome die Anfragen.
2. In `configuration.yaml` die Seite freigeben und Home Assistant neu starten:

   ```yaml
   http:
     cors_allowed_origins:
       - https://tbr-brd.github.io
   ```

3. Im Profil einen **Long-Lived Access Token** erstellen.
4. In music-browser unter ⚙️ URL und Token eintragen und **Verbindung testen** klicken. Danach stehen alle Media-Player unter „Ausgabe“.

Der Token wird nur im `localStorage` dieses Browsers gespeichert und an nichts außer deinem Home Assistant gesendet.

## Chromecast / Google Cast

Das Cast-Symbol neben „Ausgabe“ erscheint in Chrome und Edge automatisch, sobald ein Cast-Gerät im gleichen Netzwerk ist. Der laufende Sender wird mit Name und Cover an das Gerät übergeben. AirPlay kann nur Safari; dafür bietet sich der Weg über Home Assistant an.

## Lokal testen

```bash
python3 -m http.server 8000
# http://localhost:8000 öffnen
```

## Repository-Struktur

```text
index.html            Seite
css/style.css         Gestaltung (dunkel, responsiv)
js/app.js             Oberfläche, Wiedergabe, Ausgabe-Steuerung
js/stations.js        Senderliste laden (mit Offline-Kopie)
js/metadata.js        Titel/Interpret (80s80s, ON Radio, ICY) und m3u-Auflösung
js/cover.js           Cover-Suche (iTunes) und Platzhalter
js/weather.js         Wetter (Open-Meteo)
js/cast.js            Google Cast
js/homeassistant.js   Home-Assistant-Media-Player
js/storage.js         Einstellungen und Favoriten (localStorage)
proxy/worker.js       Optionaler Metadaten-Proxy (Cloudflare Worker)
assets/               Icon und Platzhalter-Cover
```

## Datenschutz

Es gibt keinen eigenen Server und kein Tracking. Die Seite lädt nur die Daten der Radiosender, von iTunes (Cover) und von Open-Meteo (Wetter), dazu auf Wunsch deinen eigenen Proxy und dein eigenes Home Assistant. Einstellungen, Favoriten und Cache bleiben im Browser.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Senderlogos, Cover und Streams gehören den jeweiligen Rechteinhabern.
