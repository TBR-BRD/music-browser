// Cover-Suche über die iTunes Search API (öffentlich, kein Schlüssel, CORS erlaubt).
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

export async function findCover(artist, title) {
  const key = `${normalize(artist)}|${normalize(title)}`;
  if (!artist || !title) return null;
  if (memory.has(key)) return memory.get(key);

  // iTunes drosseln (max. ~1 Anfrage alle 1,5 s)
  const wait = 1500 - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    term: `${normalize(artist)} ${normalize(title)}`,
    media: "music",
    entity: "song",
    limit: "5",
    country: "DE",
  });

  let result = null;
  try {
    const response = await fetch(`https://itunes.apple.com/search?${params}`);
    if (response.ok) {
      const data = await response.json();
      const results = data.results || [];
      const wantArtist = normalize(artist);
      const best =
        results.find((r) => normalize(r.artistName).includes(wantArtist.split(" ")[0])) ||
        results[0];
      const artwork = best?.artworkUrl100 || best?.artworkUrl60;
      if (artwork) result = upsize(artwork);
    }
  } catch (error) {
    console.warn("[cover] iTunes:", error.message);
    return null; // Fehler nicht cachen
  }

  memory.set(key, result);
  persist();
  return result;
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
