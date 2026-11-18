// Feste Einstellungen des music-browser.

/**
 * Optionaler Metadaten-Helfer (z. B. Cloudflare Worker aus proxy/worker.js).
 * Leer = nicht benutzt. Ohne Helfer zeigen 80s80s, HIT RADIO FFH und ENERGY
 * trotzdem Titel und Cover, weil deren Schnittstellen Browser-Zugriffe erlauben.
 */
export const METADATA_PROXY = "";

/** Anzeigenamen für Gruppen aus stations.json */
export const GROUP_LABELS = {
  "Other stations": "Eigene",
};

/** Reihenfolge der Anbieter-Buttons (unbekannte Gruppen werden davor einsortiert) */
export const GROUP_ORDER_LAST = ["Other stations"];

/**
 * Direkte Stream-Adressen für Sender, die in stations.json als m3u-Playlist
 * stehen. Browser können m3u nicht abspielen und die Playlists ohne CORS
 * nicht lesen – diese Adressen wurden im Browser als abspielbar geprüft.
 */
export const DIRECT_AUDIO = {
  "absolut-clubnight": "https://absolut-clubnight.live-sm.absolutradio.de/absolut-clubnight/stream/aacp?maxvbr=3",
  "absolut-80er": "https://absolut-80er.live-sm.absolutradio.de/absolut-80er/stream/mp3",
  "absolut-coffeemusic": "https://absolut-coffeemusic.live-sm.absolutradio.de/absolut-coffeemusic/stream/mp3",
  "absolut-hot": "https://absolut-hot.live-sm.absolutradio.de/absolut-hot/stream/mp3",
  "absolut-germany": "https://absolut-germany.live-sm.absolutradio.de/absolut-germany/stream/mp3",
  "absolut-top-2000er": "https://absolut-top.live-sm.absolutradio.de/absolut-top/stream/mp3",
  "absolut-relax": "https://absolut-relax.live-sm.absolutradio.de/absolut-relax/stream/mp3",
  "absolut-bella": "https://absolut-bella.live-sm.absolutradio.de/absolut-bella/stream/mp3",
  "absolut-classics": "https://absolut-oldieclassics.live-sm.absolutradio.de/absolut-oldieclassics/stream/mp3",
  "absolut-rock": "https://absolut-rock.live-sm.absolutradio.de/absolut-rock/stream/mp3",
  "absolut-musicxl": "https://absolut-musicxl.live-sm.absolutradio.de/absolut-musicxl/stream/mp3",
  "absolut-lovesongs": "https://absolut-lovesongs.live-sm.absolutradio.de/absolut-lovesongs/stream/mp3",
  "radio-fritz": "https://dispatcher.rndfnk.com/rbb/fritz/live/mp3/mid",
  "rbb888": "https://dispatcher.rndfnk.com/rbb/rbb888/live/mp3/mid",
};

export const BMC_URL = "https://www.buymeacoffee.com/thoralf.brandt";
