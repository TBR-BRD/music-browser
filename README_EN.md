# music-browser

[🇩🇪 Deutsch](README.md) · 🇬🇧 English

Radio and music right in your browser: **253 stations** with large album art, the current track, a clock and the weather. You can play in the browser window, on **Chromecast / Google Cast speakers**, or on any **Home Assistant media player** (Sonos, Denon/HEOS, Echo …).

The site is purely static and runs on **GitHub Pages**: no server of your own, reachable worldwide.

<br>
<a href="https://www.buymeacoffee.com/thoralf.brandt" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174">
</a>
<br>

## Features

- Station list loaded live from [radiostations](https://github.com/TBR-BRD/radiostations), with an offline copy in the browser
- Groups (ON Radio, 80s80s, RADIO BOB!, FFH, ENERGY, Sunshine Live, Absolut …), search and favorites
- Large album art: straight from the 80s80s API, otherwise from the iTunes Search API (cached and throttled)
- Title and artist: 80s80s directly; ON Radio and ICY streams through the optional metadata proxy
- Weather from Open-Meteo, location configurable (default: Falkensee), current conditions plus three days
- Output: this browser, Google Cast (Chrome/Edge) or Home Assistant players
- Media keys and lock-screen info (Media Session API); space bar = play/stop
- Mobile-friendly
- Planned (phase 2): Spotify (Web Playback SDK, Spotify Connect) and Apple Music (MusicKit JS)

## Origin

The project combines three existing projects:

| Project | Taken over |
|---|---|
| [radiostations](https://github.com/TBR-BRD/radiostations) | Station catalog (`stations.json`) |
| [googletv-musicplayer](https://github.com/TBR-BRD/googletv-musicplayer) | Metadata logic (ICY, ON Radio JSON, 80s80s API), weather codes, output concept |
| [cover-music-player](https://github.com/TBR-BRD/cover-music-player) | Cover search, encoding fixes, player view |

## What works directly in the browser and what doesn't

A browser may only read data from another site if the provider allows it via CORS. Tested from an https page:

| Source | Directly in the browser |
|---|---|
| Audio streams (http streams too; Chrome upgrades them to https) | ✅ |
| `stations.json`, 80s80s API, iTunes, Open-Meteo | ✅ |
| ON Radio JSON (`0nradio.com`) | ❌ CORS, needs the proxy |
| ICY titles from the stream (RADIO BOB!, FFH, ENERGY, Sunshine Live …) | ❌ needs the proxy |
| m3u playlists (Absolut Radio, Fritz, rbb888) | ❌ needs the proxy |

**Without the proxy**, all direct streams play, and the 80s80s stations show title and cover. The other stations show "Livestream", and m3u stations are marked "Proxy".
**With the proxy**, all 253 stations get title and cover.

## Hosting on GitHub Pages

1. Create a new repository `music-browser` and upload all files.
2. **Settings → Pages → Build and deployment**: source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. After a minute or two the site is live at `https://tbr-brd.github.io/music-browser/`.
4. Optionally use your own domain, e.g. `music.lets-make.de`: add a CNAME record at your DNS provider pointing to `tbr-brd.github.io`, enter it under **Settings → Pages → Custom domain**, then enable "Enforce HTTPS".

## Metadata proxy (Cloudflare Worker, free)

The proxy lives in [`proxy/worker.js`](proxy/worker.js). It reads the current title from ICY streams, resolves m3u/pls playlists and passes the ON Radio JSON through with a CORS header. It only answers requests from your own site. Local addresses are blocked, and it reads only small amounts of data, never audio.

1. Sign up for free at [Cloudflare](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Worker**, name it e.g. `music-proxy`, then click **Deploy**.
3. **Edit code**: paste the contents of `proxy/worker.js` and click **Deploy**.
4. **Settings → Variables**: `ALLOWED_ORIGINS` = `https://tbr-brd.github.io` (with a custom domain, add `https://music.lets-make.de` separated by a comma).
5. In music-browser, open ⚙️ and enter the worker URL, e.g. `https://music-proxy.YOURNAME.workers.dev`.

The free plan allows 100,000 requests per day. Polling every 15 seconds uses about 5,800 per hour of continuous listening.

## Home Assistant as output

1. Home Assistant must be reachable over **https** (e.g. Nabu Casa); otherwise Chrome blocks the requests.
2. Allow the site in `configuration.yaml` and restart Home Assistant:

   ```yaml
   http:
     cors_allowed_origins:
       - https://tbr-brd.github.io
   ```

3. Create a **Long-Lived Access Token** in your profile.
4. In music-browser, open ⚙️, enter the URL and token, and click **Verbindung testen** (test connection). All media players then appear under "Ausgabe" (output).

The token is stored only in this browser's `localStorage` and is sent nowhere except to your Home Assistant.

## Chromecast / Google Cast

The Cast icon next to "Ausgabe" appears automatically in Chrome and Edge as soon as a Cast device is on the same network. The current station is handed to the device with name and cover. AirPlay is Safari-only; use the Home Assistant route for that.

## Local testing

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Repository structure

```text
index.html            Page
css/style.css         Styling (dark, responsive)
js/app.js             UI, playback, output control
js/stations.js        Load station list (with offline copy)
js/metadata.js        Title/artist (80s80s, ON Radio, ICY) and m3u resolving
js/cover.js           Cover search (iTunes) and placeholders
js/weather.js         Weather (Open-Meteo)
js/cast.js            Google Cast
js/homeassistant.js   Home Assistant media players
js/storage.js         Settings and favorites (localStorage)
proxy/worker.js       Optional metadata proxy (Cloudflare Worker)
assets/               Icon and placeholder cover
```

## Privacy

There is no server of its own and no tracking. The site loads only data from the radio stations, from iTunes (covers) and from Open-Meteo (weather), plus your own proxy and Home Assistant if you configure them. Settings, favorites and caches stay in the browser.

## License

MIT, see [LICENSE](LICENSE). Station logos, cover art and streams belong to their respective rights holders.
