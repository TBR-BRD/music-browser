// "Was läuft gerade?" – Portierung von NowPlayingRepository.kt / common.js
// für den Browser. Direkt im Browser (Anbieter erlauben CORS):
//   80s80s, RADIO BOB!, Sunshine Live -> Regiocast-API (mit Cover und Senderlogo)
//   FFH      -> ffh.de "getallsonginfo" (alle FFH-Kanäle in einer Anfrage)
//   ENERGY   -> api.nrjnet.de (mit Cover)
//   ON Radio -> Icecast-Status von s6.radionetz.de (7 der 18 Sender)
//   Beats Radio -> api.streamabc.net (mit Cover)
// Über den Helfer (METADATA_PROXY, Cloudflare Worker):
//   ANTENNE BAYERN -> antenne.de/api/metadata/now (alle Kanäle, mit Cover)
//   übrige ON-Sender -> ON-Radio-JSON
//   Eigene -> ICY-Titel aus dem Stream
// Absolut Radio: im Stream steht nur der Sendername -> Senderlogo als Cover
import { METADATA_PROXY, DIRECT_AUDIO, STATION_LOGOS, NO_METADATA_GROUPS, STREAMABC_CHANNELS } from "./config.js";

const FFH_URL =
  "https://www.ffh.de/update-onair-info?tx_ffhonair_pi2%5Baction%5D=getallsonginfo&tx_ffhonair_pi2%5Bcontroller%5D=Webradio&type=210";
const ENERGY_CONFIG_URL = "https://api.nrjnet.de/webradio/nrj-energy-de/config.json";

const ARTIST_KEYS = ["artist", "artist_name", "artistName", "interpret"];
const TITLE_KEYS = ["title", "song_title", "songTitle", "track"];
const CURRENT_KEYS = ["current", "now", "now_playing", "playing"];
const COVER_KEYS_80S = [
  "cover_art_url_xxl", "cover_art_url_xl", "cover_art_url_l",
  "cover_art_url_m", "cover_art_url_s", "cover_art_url_xs",
];


export function proxied(proxyUrl, endpoint, targetUrl) {
  const base = proxyUrl.replace(/\/+$/, "");
  return `${base}/${endpoint}?url=${encodeURIComponent(targetUrl)}`;
}

/** Repariert typische "Ã¤"-Doppelkodierungen. */
export function fixEncoding(text) {
  const value = String(text ?? "").trim();
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from([...value].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return value;
  }
}

function firstText(node, keys) {
  for (const key of keys) {
    const v = node?.[key];
    if (v !== undefined && v !== null && typeof v !== "object") {
      const t = String(v).trim();
      if (t && t !== "null") return t;
    }
  }
  return "";
}

function findTrackLikeNode(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTrackLikeNode(item);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    if (firstText(value, ARTIST_KEYS) && firstText(value, TITLE_KEYS)) return value;
    for (const key of Object.keys(value)) {
      const found = findTrackLikeNode(value[key]);
      if (found) return found;
    }
  }
  return null;
}

function splitStreamTitle(streamTitle, station) {
  for (const sep of [" - ", " – ", " — ", " | ", " ~ "]) {
    const i = streamTitle.indexOf(sep);
    if (i > 0) {
      const artist = streamTitle.slice(0, i).trim();
      const title = streamTitle.slice(i + sep.length).trim();
      if (artist && title) return { artist, title };
    }
  }
  return { artist: station.name, title: streamTitle };
}

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Regiocast-Sender: 80s80s, RADIO BOB!, Sunshine Live ----------
// Alle drei laufen auf derselben Plattform mit identischer, CORS-freundlicher
// Schnittstelle (/streams/api): pro Kanal Titel, Interpret, Cover und Senderlogo.
const REGIOCAST_APIS = {
  "streams.80s80s.de": "https://www.80s80s.de/streams/api",
  "streams.radiobob.de": "https://www.radiobob.de/streams/api",
  "stream.sunshine-live.de": "https://www.sunshine-live.de/streams/api",
};
const regiocastCache = new Map(); // api -> { at, data }
// Erkennung „Schnittstelle hängt“: Ändert sich bei KEINEM Kanal des Anbieters
// mehrere Minuten lang irgendein Titel, sind die Daten eingefroren (passiert
// beim Anbieter gelegentlich). Dann lieber Senderlogo statt falschem Cover.
const FROZEN_AFTER_MS = 7 * 60 * 1000;
const regiocastHealth = new Map(); // api -> { sig, since, firstSeen }

function trackFreshness(api, data) {
  const sig = Object.values(data || {})
    .map((e) => `${e?.station_id}:${e?.artist_name}:${e?.song_title}`)
    .join("|");
  const now = Date.now();
  const h = regiocastHealth.get(api);
  if (!h || h.sig !== sig) {
    regiocastHealth.set(api, { sig, since: now });
    return true;
  }
  return now - h.since < FROZEN_AFTER_MS;
}

function regiocastApi(station) {
  try {
    return REGIOCAST_APIS[new URL(station.audioUrl).hostname] || null;
  } catch {
    return null;
  }
}

function streamMount(url) {
  try {
    return new URL(url, "https://x.invalid/").pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

async function regiocastEntry(station) {
  const api = regiocastApi(station);
  if (!api) return null;
  const cached = regiocastCache.get(api);
  let data = cached?.data;
  if (!data || Date.now() - cached.at > 10000) {
    data = await fetchJson(`${api}?_=${Date.now()}`);
    regiocastCache.set(api, { at: Date.now(), data, fresh: trackFreshness(api, data) });
  }
  const entries = Object.values(data || {}).filter((e) => e && typeof e === "object");
  const mount = streamMount(station.audioUrl);
  return (
    entries.find((e) => streamMount(e.url_high) === mount || streamMount(e.url_low) === mount) ||
    (station.metadataStationId != null
      ? entries.find((e) => Number(e.station_id) === Number(station.metadataStationId))
      : null) ||
    null
  );
}

async function fetchRegiocast(station) {
  const match = await regiocastEntry(station);
  if (!match) return null;
  if (regiocastCache.get(regiocastApi(station))?.fresh === false) return { stale: true };
  const artist = fixEncoding(firstText(match, ["artist_name", "artist", "artistName"]));
  const title = fixEncoding(firstText(match, ["song_title", "title", "songTitle"]));
  if (!artist || !title) return null;
  let coverUrl = null;
  if (match.covers && typeof match.covers === "object") {
    for (const key of COVER_KEYS_80S) {
      if (match.covers[key]) { coverUrl = String(match.covers[key]).trim(); break; }
    }
  }
  return { artist, title, coverUrl };
}

/** Senderlogo (falls der Anbieter eins liefert), z. B. für die Anzeige ohne Titel. */
export async function fetchStationLogo(station) {
  if (STATION_LOGOS[station.id]) return STATION_LOGOS[station.id];
  try {
    const entry = await regiocastEntry(station);
    return entry?.stream_logo || null;
  } catch {
    return null;
  }
}

// ---------- ON Radio (radionetz, Icecast) ----------
// Der radionetz-Server s6 gibt seine Icecast-Statusseite für Browser frei.
// Dort laufen u. a. ON Hits, Charts, Oldies, Chillout, Relax, Pop und Dance.
// Die übrigen ON-Sender liegen auf Servern ohne diese Freigabe.
const RADIONETZ_STATUS = "https://s6.radionetz.de/status-json.xsl";
let radionetzCache = { at: 0, titles: null }; // mount -> "Artist - Title"

async function radionetzTitles() {
  if (!radionetzCache.titles || Date.now() - radionetzCache.at > 10000) {
    const data = await fetchJson(RADIONETZ_STATUS);
    const titles = new Map();
    for (const src of [].concat(data?.icestats?.source || [])) {
      try {
        titles.set(new URL(src.listenurl).pathname, String(src.title || "").trim());
      } catch { /* ignorieren */ }
    }
    radionetzCache = { at: Date.now(), titles };
  }
  return radionetzCache.titles;
}

function radionetzMount(station) {
  try {
    const url = new URL(station.audioUrl);
    return url.hostname.endsWith(".radionetz.de") ? url.pathname : null;
  } catch {
    return null;
  }
}

async function fetchRadionetz(station) {
  const titles = await radionetzTitles();
  const raw = fixEncoding(titles.get(radionetzMount(station)) || "");
  if (!raw) return null;
  return { ...splitStreamTitle(raw, station), coverUrl: null };
}

// ---------- ANTENNE BAYERN (über den Helfer) ----------
const ANTENNE_NOW = "https://www.antenne.de/api/metadata/now";
let antenneCache = { at: 0, byMount: null };

function antenneMount(station) {
  try {
    const url = new URL(station.audioUrl);
    return /(^|\.)antenne\.de$/.test(url.hostname) ? url.pathname.split("/").filter(Boolean)[0] : null;
  } catch {
    return null;
  }
}

async function fetchAntenne(station, proxyUrl) {
  if (!proxyUrl) return null;
  if (!antenneCache.byMount || Date.now() - antenneCache.at > 10000) {
    const data = await fetchJson(proxied(proxyUrl, "raw", ANTENNE_NOW));
    antenneCache = { at: Date.now(), byMount: new Map((data?.data || []).map((d) => [d.mountpoint, d])) };
  }
  const d = antenneCache.byMount.get(antenneMount(station));
  if (!d || d.class !== "Music") return null;
  const artist = fixEncoding(d.artist);
  const title = fixEncoding(d.title);
  if (!artist || !title) return null;
  const c = d.cover;
  const coverUrl = c?.baseurl && c?.filename ? `${c.baseurl}600x600/${c.filename}.jpg` : null;
  return { artist, title, coverUrl };
}

// ---------- streamABC (Beats Radio) ----------
async function fetchStreamAbc(station) {
  const key = STREAMABC_CHANNELS[station.id];
  const data = await fetchJson(`https://api.streamabc.net/metadata/channel/${key}.json?_=${Date.now()}`);
  const artist = fixEncoding(data?.artist);
  const title = fixEncoding(data?.song || data?.title);
  if (!artist || !title) return null;
  // Cover-URL enthält ein Senderlogo als Ersatz („default=…“), falls es kein Albumcover gibt
  const coverUrl = data?.images?.large?.url || data?.cover || null;
  return { artist, title, coverUrl };
}

// ---------- HIT RADIO FFH ----------
let ffhCache = { at: 0, data: null };

function ffhKeys(station) {
  // http://mp3.ffh.de/ffhchannels/hq80er.mp3 -> ffh80er / ffhplus80er / ffh80erlive
  const m = station.audioUrl.match(/mp3\.ffh\.de\/([^/]+)\/hq([a-z0-9]+)\.mp3/i);
  if (!m) return [];
  const [, folder, name] = m;
  if (folder === "radioffh") return ["ffh"];
  if (folder === "ffhplus") return [`ffhplus${name}`, `ffh${name}`];
  return [`ffh${name}`, `ffhplus${name}`, `ffh${name}live`];
}

async function fetchFfh(station) {
  const now = Date.now();
  if (!ffhCache.data || now - ffhCache.at > 10000) {
    ffhCache = { at: now, data: await fetchJson(FFH_URL) };
  }
  const all = Object.assign({}, ...(ffhCache.data || []));
  const entry = ffhKeys(station).map((k) => all[k]).find(Boolean);
  if (!entry || entry.isStatic) return null;
  const artist = fixEncoding(entry.artist);
  const title = fixEncoding(entry.title);
  return artist && title ? { artist, title, coverUrl: null } : null;
}

// ---------- ENERGY ----------
let energyChannels = null;

async function energyCurrentUrl(station) {
  if (!energyChannels) {
    const config = await fetchJson(ENERGY_CONFIG_URL);
    energyChannels = new Map();
    for (const ch of Object.values(config.channels || {})) {
      if (ch.streamonkeyMountName && ch.currentUrl) energyChannels.set(ch.streamonkeyMountName, ch.currentUrl);
    }
  }
  const mount = station.audioUrl.match(/streamonkey\.net\/([^?/]+)/)?.[1];
  return mount ? energyChannels.get(mount) : null;
}

async function fetchEnergy(station) {
  const url = await energyCurrentUrl(station);
  if (!url) return null;
  const data = await fetchJson(url);
  const artist = fixEncoding(data.artist);
  const title = fixEncoding(data.title);
  if (!title) return null;
  const images = data.images || {};
  const coverUrl = data.hasCover ? images["600x600"] || images["200x200"] || null : null;
  // Ohne Interpret läuft eine Moderation/Sendung (z. B. „ENERGY mit Vivi“) – mit Sendungsbild
  if (!artist) return { artist: station.name, title, coverUrl };
  return { artist: titleCase(artist), title: titleCase(title), coverUrl };
}

/** ENERGY liefert oft GROSSBUCHSTABEN – lesbarer machen. */
function titleCase(text) {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s(\-/&.])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

// ---------- ON Radio / ICY (nur mit Helfer) ----------
async function fetchOnRadio(station, proxyUrl) {
  if (!proxyUrl) return null;
  const payload = await fetchJson(proxied(proxyUrl, "raw", station.metadataUrl));
  let current = null;
  for (const key of CURRENT_KEYS) {
    current = payload?.items?.[key] || payload?.[key];
    if (current && typeof current === "object") break;
    current = null;
  }
  current = current || findTrackLikeNode(payload);
  if (!current) return null;
  const artist = fixEncoding(firstText(current, ARTIST_KEYS));
  const title = fixEncoding(firstText(current, TITLE_KEYS));
  return artist && title ? { artist, title, coverUrl: null } : null;
}

async function fetchIcy(station, proxyUrl) {
  if (!proxyUrl) return null;
  const data = await fetchJson(proxied(proxyUrl, "icy", station.metadataUrl || station.audioUrl), 12000);
  const streamTitle = fixEncoding(data?.streamTitle || "").trim();
  if (!streamTitle) return null;
  // Viele Sender schicken nur ihren Namen bzw. einen Slogan – das ist kein Titel.
  const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  if ([data?.icyName, station.name].some((n) => n && norm(n) === norm(streamTitle))) return null;
  if (/livestream|webradio|\bon air\b/i.test(streamTitle) && !/ - /.test(streamTitle)) return null;
  // rbb-Format: "Livin' On A Prayer" von Bon Jovi
  const von = streamTitle.match(/^["„“](.+?)["“”]\s+von\s+(.+)$/i);
  if (von) return { artist: titleCase(von[2].trim()), title: titleCase(von[1].trim()), coverUrl: null };
  const { artist, title } = splitStreamTitle(streamTitle, station);
  return { artist: artist === station.name ? artist : titleCase(artist), title: titleCase(title), coverUrl: null };
}

/**
 * Liefert {artist, title, coverUrl}, null (keine Titelinfo) oder
 * {stale: true}, wenn die Schnittstelle des Anbieters gerade eingefroren ist.
 */
export async function fetchNowPlaying(station) {
  const proxyUrl = METADATA_PROXY;
  try {
    if (station.group === "HIT RADIO FFH") return await fetchFfh(station);
    if (station.group === "ENERGY") return await fetchEnergy(station);
    if (NO_METADATA_GROUPS.includes(station.group)) return null;
    if (STREAMABC_CHANNELS[station.id]) return await fetchStreamAbc(station);
    if (regiocastApi(station)) return await fetchRegiocast(station);
    if (antenneMount(station)) return await fetchAntenne(station, proxyUrl);
    if (radionetzMount(station)) {
      const np = await fetchRadionetz(station);
      if (np || !proxyUrl) return np;
      // sonst weiter über den Helfer (ON-Radio-JSON)
    }
    switch (station.metadataMode) {
      case "0nradio_json": return await fetchOnRadio(station, proxyUrl);
      case "icy_stream": return await fetchIcy(station, proxyUrl);
      default: return null;
    }
  } catch (error) {
    console.warn(`[metadata] ${station.id}:`, error.message);
    return null;
  }
}

/** Liefert dieser Sender im Browser Titel und Cover? */
export function hasLiveMetadata(station) {
  if (NO_METADATA_GROUPS.includes(station.group)) return false;
  if (STREAMABC_CHANNELS[station.id]) return true;
  if (METADATA_PROXY) return true;
  if (["HIT RADIO FFH", "ENERGY"].includes(station.group)) return true;
  if (regiocastApi(station)) return true;
  const mount = radionetzMount(station);
  if (mount) return !radionetzCache.titles || radionetzCache.titles.has(mount);
  return Boolean(METADATA_PROXY);
}

// ---------- Audio-URL auflösen (m3u / pls) ----------

const resolvedCache = new Map();

function parsePlaylist(text) {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const pls = line.match(/^File\d+=(.+)$/i);
    const candidate = pls ? pls[1].trim() : line;
    if (/^https?:\/\//i.test(candidate)) return candidate;
  }
  return null;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveAudioUrl(station) {
  const proxyUrl = METADATA_PROXY;
  if (DIRECT_AUDIO[station.id]) return DIRECT_AUDIO[station.id];
  if (station.audioMode !== "m3u" && station.audioMode !== "pls") return station.audioUrl;
  if (resolvedCache.has(station.id)) return resolvedCache.get(station.id);

  const attempts = [station.audioUrl];
  if (proxyUrl) attempts.push(proxied(proxyUrl, "raw", station.audioUrl));
  for (const url of attempts) {
    try {
      const resolved = parsePlaylist(await fetchText(url));
      if (resolved) {
        resolvedCache.set(station.id, resolved);
        return resolved;
      }
    } catch {
      /* nächster Versuch */
    }
  }
  throw new Error("Dieser Sender liefert nur eine Playlist (m3u), die der Browser nicht lesen darf.");
}
