// "Was läuft gerade?" – Portierung von NowPlayingRepository.kt / common.js
// für den Browser. Die Modi stammen aus stations.json:
//   80s80s_api   -> direkt (die API erlaubt CORS)
//   0nradio_json -> nur über den Proxy (kein CORS)
//   icy_stream   -> nur über den Proxy (Browser können ICY nicht lesen)

const ARTIST_KEYS = ["artist", "artist_name", "artistName", "interpret"];
const TITLE_KEYS = ["title", "song_title", "songTitle", "track"];
const CURRENT_KEYS = ["current", "now", "now_playing", "playing"];
const COVER_KEYS_80S = [
  "cover_art_url_xxl", "cover_art_url_xl", "cover_art_url_l",
  "cover_art_url_m", "cover_art_url_s", "cover_art_url_xs",
];

let api80sCache = { at: 0, url: "", data: null };

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

async function fetch80s80s(station) {
  const now = Date.now();
  if (!api80sCache.data || api80sCache.url !== station.metadataUrl || now - api80sCache.at > 10000) {
    api80sCache = { at: now, url: station.metadataUrl, data: await fetchJson(station.metadataUrl) };
  }
  const match = Object.values(api80sCache.data || {}).find(
    (entry) => entry && Number(entry.station_id) === Number(station.metadataStationId)
  );
  if (!match) return null;
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
  const streamTitle = fixEncoding(data?.streamTitle || "");
  if (!streamTitle) return null;
  return { ...splitStreamTitle(streamTitle, station), coverUrl: null };
}

/**
 * Liefert {artist, title, coverUrl} oder null, wenn für diesen Sender
 * (gerade) keine Titelinfo verfügbar ist.
 */
export async function fetchNowPlaying(station, { proxyUrl }) {
  try {
    switch (station.metadataMode) {
      case "80s80s_api": return await fetch80s80s(station);
      case "0nradio_json": return await fetchOnRadio(station, proxyUrl);
      case "icy_stream": return await fetchIcy(station, proxyUrl);
      default: return null;
    }
  } catch (error) {
    console.warn(`[metadata] ${station.id}:`, error.message);
    return null;
  }
}

export function metadataNeedsProxy(station) {
  return station.metadataMode === "0nradio_json" || station.metadataMode === "icy_stream";
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

export async function resolveAudioUrl(station, { proxyUrl }) {
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
  throw new Error(proxyUrl
    ? "Playlist konnte nicht gelesen werden."
    : "Dieser Sender liefert eine Playlist (m3u) – dafür wird der Proxy benötigt.");
}
