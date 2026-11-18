// Senderliste aus dem Repo TBR-BRD/radiostations (Single Source of Truth).
// Lokale Kopie in localStorage als Offline-Fallback.
import { load, save } from "./storage.js";

export const STATIONS_URL =
  "https://raw.githubusercontent.com/TBR-BRD/radiostations/main/stations.json";

export async function loadStations() {
  try {
    const response = await fetch(STATIONS_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const stations = await response.json();
    if (!Array.isArray(stations) || !stations.length) throw new Error("leere Liste");
    save("stationsCache", stations);
    return { stations, source: "online" };
  } catch (error) {
    const cached = load("stationsCache", null);
    if (cached?.length) return { stations: cached, source: "cache" };
    throw error;
  }
}

/** Gruppen in der Reihenfolge, in der sie in der Liste zuerst auftauchen. */
export function groupsOf(stations) {
  const seen = [];
  for (const s of stations) if (!seen.includes(s.group)) seen.push(s.group);
  return seen;
}

/** Braucht der Sender den Proxy, um überhaupt abspielbar zu sein? */
export function needsProxyForAudio(station) {
  return station.audioMode === "m3u" || station.audioMode === "pls";
}
