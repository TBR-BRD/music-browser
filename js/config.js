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
export const GROUP_ORDER_LAST = ["TV", "Deluxe Music TV", "Other stations"];

/**
 * Live-TV-Sender mit offiziellem Web-Player (3Q) von deluxemusic.de.
 * Deluxe Rap und Deluxe Lounge zeigen dort nur Trailer und fehlen deshalb.
 */
const tv = (id, name, dataId) => ({
  id, name, group: "Deluxe Music TV", kind: "tv3q", dataId, homepageUrl: "https://deluxemusic.de/",
});
export const TV_STATIONS = [
  tv("deluxe-music-tv", "DELUXE MUSIC", "d0ef730d-6e72-11ea-bce2-0cc47a188158"),
  tv("schlager-deluxe-tv", "Schlager Deluxe", "457232aa-6181-11eb-b839-0cc47a188158"),
  tv("deluxe-dance-tv", "Deluxe Dance by Kontor", "4b652322-a2f4-11ed-a3c0-3cecef385192"),
];

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


/**
 * Deutsche TV-Sender (öffentlich-rechtlich) mit ihren offiziellen, frei
 * zugänglichen HLS-Livestreams. Viele sind auf Deutschland beschränkt (Geo-IP).
 * Private Sender (RTL, Sat.1, ProSieben …) gibt es nicht frei als Stream.
 */
const hlsTv = (id, name, streamUrl) => ({ id: `tv-${id}`, name, group: "TV", kind: "hls", streamUrl });
export const GERMAN_TV = [
  hlsTv("daserste", "Das Erste", "https://daserste-live.ard-mcdn.de/daserste/live/hls/de/master.m3u8"),
  hlsTv("zdf", "ZDF", "https://zdf-hls-15.akamaized.net/hls/live/2016498/de/high/master.m3u8"),
  hlsTv("3sat", "3sat", "https://zdf-hls-18.akamaized.net/hls/live/2016501/dach/high/master.m3u8"),
  hlsTv("arte", "ARTE", "https://artesimulcast.akamaized.net/hls/live/2030993/artelive_de/index.m3u8"),
  hlsTv("zdfneo", "ZDFneo", "https://zdf-hls-16.akamaized.net/hls/live/2016499/de/high/master.m3u8"),
  hlsTv("zdfinfo", "ZDFinfo", "https://zdf-hls-17.akamaized.net/hls/live/2016500/de/high/master.m3u8"),
  hlsTv("phoenix", "phoenix", "https://zdf-hls-19.akamaized.net/hls/live/2016502/de/high/master.m3u8"),
  hlsTv("tagesschau24", "tagesschau24", "https://tagesschau.akamaized.net/hls/live/2020115/tagesschau/tagesschau_1/master.m3u8"),
  hlsTv("ardalpha", "ARD alpha", "https://mcdn.br.de/br/fs/ard_alpha/hls/de/master.m3u8"),
  hlsTv("kika", "KiKA", "https://kikageohls.akamaized.net/hls/live/2022693/livetvkika_de/master.m3u8"),
  hlsTv("rbb-berlin", "rbb Berlin", "https://rbb-hls-berlin.akamaized.net/hls/live/2017824/rbb_berlin/index.m3u8"),
  hlsTv("rbb-brandenburg", "rbb Brandenburg", "https://rbb-hls-brandenburg.akamaized.net/hls/live/2017825/rbb_brandenburg/master.m3u8"),
  hlsTv("br-sued", "BR Fernsehen Süd", "https://mcdn.br.de/br/fs/bfs_sued/hls/de/master.m3u8"),
  hlsTv("br-nord", "BR Fernsehen Nord", "https://mcdn.br.de/br/fs/bfs_nord/hls/de/master.m3u8"),
  hlsTv("hr", "hr-fernsehen", "https://hrhls.akamaized.net/hls/live/2024525/hrhls/index.m3u8"),
  hlsTv("mdr-sachsen", "MDR Sachsen", "https://mdrtvsnhls.akamaized.net/hls/live/2016928/mdrtvsn/index.m3u8"),
  hlsTv("mdr-sachsen-anhalt", "MDR Sachsen-Anhalt", "https://mdrtvsahls.akamaized.net/hls/live/2016879/mdrtvsa/index.m3u8"),
  hlsTv("mdr-thueringen", "MDR Thüringen", "https://mdrtvthhls.akamaized.net/hls/live/2016880/mdrtvth/index.m3u8"),
  hlsTv("ndr-hh", "NDR Hamburg", "https://mcdn.ndr.de/ndr/hls/ndr_fs/ndr_hh/master.m3u8"),
  hlsTv("ndr-mv", "NDR Mecklenburg-Vorpommern", "https://mcdn.ndr.de/ndr/hls/ndr_fs/ndr_mv/master.m3u8"),
  hlsTv("ndr-nds", "NDR Niedersachsen", "https://mcdn.ndr.de/ndr/hls/ndr_fs/ndr_nds/master.m3u8"),
  hlsTv("ndr-sh", "NDR Schleswig-Holstein", "https://mcdn.ndr.de/ndr/hls/ndr_fs/ndr_sh/master.m3u8"),
  hlsTv("radiobremen", "Radio Bremen", "https://rbhlslive.akamaized.net/hls/live/2020435/rbfs/master.m3u8"),
  hlsTv("sr", "SR Fernsehen", "https://srfs.akamaized.net/hls/live/689649/srfsgeo/index.m3u8"),
  hlsTv("swr-bw", "SWR Baden-Württemberg", "https://swrbwd-hls.akamaized.net/hls/live/2018672/swrbwd/master.m3u8"),
  hlsTv("swr-rp", "SWR Rheinland-Pfalz", "https://swrrpd-hls.akamaized.net/hls/live/2018676/swrrpd/master.m3u8"),
  hlsTv("wdr", "WDR Fernsehen", "https://wdr-live.ard-mcdn.de/wdr/live/hls/de/master.m3u8"),
];