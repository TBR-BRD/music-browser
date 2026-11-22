// Cover-Suche über die iTunes Search API (öffentlich, kein Schlüssel, CORS erlaubt),
// ersatzweise MusicBrainz + Cover Art Archive.
// Ergebnisse werden im Speicher und begrenzt in localStorage zwischengespeichert.
import { load, save } from "./storage.js";

const MAX_CACHE = 400;
const memory = new Map(Object.entries(load("coverCache", {})));
let lastRequestAt = 0;

function persist() {
  const entries = [...memory.entries()].slice(-MAX_CACHE);
  save("coverCache", Object.fromEntries(entries));
}

function upsize(url, size = 600) {
  return url.replace(/\/(\d+)x(\d+)(bb)?\.(jpg|jpeg|png|webp)$/i, `/${size}x${size}bb.$4`);
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(feat\.?|ft\.?|featuring)\b.*$/, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const MISS_TTL = 6 * 60 * 60 * 1000; // „kein Cover gefunden“ nur 6 h merken

export async function findCover(artist, title) {
  const key = `${normalize(artist)}|${normalize(title)}`;
  if (!artist || !title) return null;
  if (memory.has(key)) {
    const hit = memory.get(key);
    if (typeof hit === "string") return hit;
    if (hit && Date.now() - hit.miss < MISS_TTL) return null;
    // alte Einträge ohne Zeitstempel oder abgelaufen → neu suchen
  }

  let result = null;
  let failed = false;
  try {
    result = await searchItunes(artist, title);
  } catch (error) {
    console.warn("[cover] iTunes:", error.message);
    failed = true;
  }
  if (!result) {
    // Ersatz wie im onradio-cover-bridge: MusicBrainz + Cover Art Archive
    try {
      result = await searchMusicBrainz(artist, title);
      failed = false;
    } catch (error) {
      console.warn("[cover] MusicBrainz:", error.message);
    }
  }
  if (failed && !result) return null; // Netz-/Drosselfehler nicht merken

  memory.set(key, result || { miss: Date.now() });
  persist();
  return result;
}

async function throttle() {
  // iTunes drosseln (max. ~1 Anfrage alle 1,5 s)
  const wait = 1500 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function getJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchItunes(artist, title) {
  await throttle();
  const params = new URLSearchParams({
    term: `${normalize(artist)} ${normalize(title)}`,
    media: "music",
    entity: "song",
    limit: "5",
    country: "DE",
  });
  const data = await getJson(`https://itunes.apple.com/search?${params}`);
  const results = data.results || [];
  const wantArtist = normalize(artist);
  const best =
    results.find((r) => normalize(r.artistName).includes(wantArtist.split(" ")[0])) ||
    results[0];
  const artwork = best?.artworkUrl100 || best?.artworkUrl60;
  return artwork ? upsize(artwork) : null;
}

let lastMbAt = 0;
async function searchMusicBrainz(artist, title) {
  const wait = 1100 - (Date.now() - lastMbAt); // MusicBrainz: max. 1 Anfrage/s
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastMbAt = Date.now();
  const esc = (t) => String(t).replace(/["\\]/g, " ");
  const mainArtist = String(artist).split(/,|&| feat\.?| ft\.?| x /i)[0].trim();
  const query = `recording:"${esc(String(title).replace(/\(.*?\)/g, "").trim())}" AND artist:"${esc(mainArtist)}"`;
  const params = new URLSearchParams({ query, fmt: "json", limit: "5" });
  const data = await getJson(`https://musicbrainz.org/ws/2/recording/?${params}`);
  for (const rec of data.recordings || []) {
    if ((rec.score ?? 0) < 85) continue;
    const releases = (rec.releases || []).slice().sort((a, b) =>
      (a["release-group"]?.["primary-type"] === "Album" ? 0 : 1) - (b["release-group"]?.["primary-type"] === "Album" ? 0 : 1));
    for (const rel of releases.slice(0, 3)) {
      const url = `https://coverartarchive.org/release/${rel.id}/front-500`;
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (head.ok) return head.url || url;
      } catch { /* nächstes Release */ }
    }
  }
  return null;
}

const PALETTE = ["#ff8a3d", "#6c8cff", "#2bb3a3", "#d65db1", "#f5b83d", "#59c36a", "#e5534b", "#8b6cff"];

export function colorFor(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name) {
  const words = String(name).replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}

/** Platzhalter-Cover als SVG-Data-URL mit Sendernamen. */
export function stationPlaceholder(station) {
  const color = colorFor(station.group || station.name);
  const name = String(station.name).replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#14161c"/></linearGradient></defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <text x="300" y="300" font-family="system-ui,sans-serif" font-size="150" font-weight="700"
      fill="rgba(255,255,255,.92)" text-anchor="middle" dominant-baseline="central">${initials(name)}</text>
    <text x="300" y="470" font-family="system-ui,sans-serif" font-size="36"
      fill="rgba(255,255,255,.75)" text-anchor="middle">${name}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
