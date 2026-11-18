// Feste Einstellungen des music-browser.

/**
 * Metadaten-Helfer (Cloudflare Worker aus proxy/worker.js) für Anbieter, die
 * fremde Webseiten sperren: ANTENNE BAYERN, übrige ON-Sender, Eigene.
 * Leer lassen = ohne Helfer (80s80s, BOB, Sunshine, FFH, ENERGY gehen trotzdem).
 */
export const METADATA_PROXY = "https://music-proxy.cloudflare-radio.workers.dev";

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

/** Senderlogos als Cover, wenn der Anbieter keine Titel liefert (Absolut Radio). */
const ABSOLUT_LOGO = (file) => `https://cms.antenne-deutschland.de/api/media/file/${file}`;
export const STATION_LOGOS = {
  "absolut-hot": ABSOLUT_LOGO("hot-1.webp"),
  "absolut-germany": ABSOLUT_LOGO("germany-1.webp"),
  "absolut-top-2000er": ABSOLUT_LOGO("top-1.webp"),
  "absolut-relax": ABSOLUT_LOGO("relax-1.webp"),
  "absolut-bella": ABSOLUT_LOGO("bella-1.webp"),
  "absolut-classics": ABSOLUT_LOGO("AbsolutClassics_Logo_Kreis-960x960.webp"),
  "absolut-coffeemusic": ABSOLUT_LOGO("coffeemusic-1.webp"),
  "absolut-lovesongs": ABSOLUT_LOGO("lovesongs-1.webp"),
  "absolut-musicxl": ABSOLUT_LOGO("musicxl-1.webp"),
  "absolut-80er": ABSOLUT_LOGO("80er-1.webp"),
  "absolut-clubnight": ABSOLUT_LOGO("clubnight-1.webp"),
  "absolut-rock": ABSOLUT_LOGO("rock-1.webp"),
};

/** Gruppen ohne brauchbare Titel im Stream (dort nur Sendername) – nicht abfragen. */
export const NO_METADATA_GROUPS = ["Absolut Radio"];

/**
 * streamABC-Kanäle (Klassik Radio / Beats Radio): Titel, Interpret und Cover
 * kommen von https://api.streamabc.net/metadata/channel/<key>.json (CORS erlaubt).
 */
export const STREAMABC_CHANNELS = {
  "beats-radio": "klr_3xcmcf19meu_83wq",
  "beats-radio-nu-disco": "klr_qohdzgv3jpl_mzy9",
  "beats-radio-chillout-beats": "klr_jk3tmcvoltq_szz1",
};
