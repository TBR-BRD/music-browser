# Dein Music Browser

[🇩🇪 Deutsch](README.md) · 🇬🇧 English

Radio right in your browser: **around 290 stations** from 9 providers, with large album art, the current track, date, time and weather. Play in the browser window or via **Chromecast / Google Cast**.

The site is purely static and runs on **GitHub Pages**: no server of your own, reachable worldwide.

**▶ Live version: [tbr-brd.github.io/music-browser](https://tbr-brd.github.io/music-browser/)**

<br>
<a href="https://www.buymeacoffee.com/thoralf.brandt" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174">
</a>
<br>

## Features

- **Provider buttons at the top:** ON Radio, 80s80s, Sunshine Live, RADIO BOB!, HIT RADIO FFH, Absolut Radio, ENERGY, ANTENNE BAYERN, Eigene (own stations) and ★ Favoriten (favorites). Only the selected provider's stations are listed below.
- **Search** across all stations, including multiple words (e.g. "bob rock")
- **Favorites** via ☆ on the playing station
- **Large cover and current track** for 80s80s, HIT RADIO FFH and ENERGY, straight from their APIs, otherwise via the iTunes search
- **Date and time** at the top right, plus the **weather** (Open-Meteo, current conditions plus three days)
- **Two views:** full (desktop/TV) and mobile. They switch automatically by screen width; the 🔄/🖥️/📱 button cycles through auto, full and mobile.
- **Settings:** weather location and dark/light mode
- **Chromecast / Google Cast** in Chrome and Edge
- Media keys and lock-screen info (Media Session API); space bar = play/stop

## Station list

Stations are loaded live from [radiostations](https://github.com/TBR-BRD/radiostations), the shared catalog for this project, the [Google TV app](https://github.com/TBR-BRD/googletv-musicplayer) and the [Raspberry Pi](https://github.com/TBR-BRD/onradio-cover-bridge). Add a station there once and it shows up everywhere. The group "Other stations" is called **Eigene** here.

## Where are favorites and settings stored?

Only **in the browser** (`localStorage`), not on a server. They stay until you clear the site data. On another device or in another browser you start with empty favorites.

## Why do some stations show no track title?

A web page may only read data from other servers if the provider allows it (CORS). The Google TV app and the Raspberry Pi are standalone programs, so this restriction doesn't apply to them.

| Provider | Title and cover in the browser |
|---|---|
| 80s80s, HIT RADIO FFH, ENERGY | ✅ directly from their APIs |
| ON Radio, RADIO BOB!, Sunshine Live, Absolut Radio, ANTENNE BAYERN, Eigene | ❌ station name only; the stream still plays |

If you want titles there too, you can optionally run a small helper, e.g. the Cloudflare Worker in [`proxy/worker.js`](proxy/worker.js), and enter its address as `METADATA_PROXY` in `js/config.js`. It is not required.

## Hosting on GitHub Pages

1. Fork the repository or upload the files to your own repository.
2. **Settings → Pages**: source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. After a minute or two the site is live at `https://<name>.github.io/music-browser/`.

## Local testing

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Repository structure

```text
index.html          Page
css/style.css       Styling: dark/light, full and mobile views
js/app.js           UI, playback, view switching, settings
js/config.js        Group names, direct stream URLs, optional helper
js/stations.js      Load station list (with offline copy)
js/metadata.js      Title and artist (80s80s, FFH, ENERGY)
js/cover.js         Cover search (iTunes) and placeholders
js/weather.js       Weather (Open-Meteo)
js/cast.js          Google Cast
js/storage.js       Settings and favorites (localStorage)
proxy/worker.js     Optional metadata helper (Cloudflare Worker)
```

## Privacy

There is no server of its own and no tracking. The site only loads the stations' streams and titles, covers from iTunes and the weather from Open-Meteo. Settings and favorites stay in your browser.

## License

MIT, see [LICENSE](LICENSE). Station logos, cover art and streams belong to their respective rights holders.
