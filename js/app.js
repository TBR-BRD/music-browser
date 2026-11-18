import { load, save, loadSettings, saveSettings } from "./storage.js";
import { loadStations, groupsOf, needsProxyForAudio } from "./stations.js";
import { fetchNowPlaying, resolveAudioUrl, metadataNeedsProxy } from "./metadata.js";
import { findCover, stationPlaceholder, colorFor, initials } from "./cover.js";
import { fetchWeather, renderWeather } from "./weather.js";
import { initCast, isCasting, castStream, castSetVolume, castStop } from "./cast.js";
import { haConfigured, haListPlayers, haPlay, haStop, haVolume } from "./homeassistant.js";

const $ = (id) => document.getElementById(id);
const el = {
  audio: $("audio"), cover: $("cover"), stationName: $("stationName"),
  title: $("trackTitle"), artist: $("trackArtist"), status: $("status"),
  play: $("btnPlay"), prev: $("btnPrev"), next: $("btnNext"), fav: $("btnFav"),
  volume: $("volume"), output: $("output"), list: $("stationList"), groups: $("groups"),
  search: $("search"), info: $("stationInfo"), weather: $("weather"), clock: $("clock"),
  settings: $("settings"), settingsForm: $("settingsForm"), nowPlaying: $("nowPlaying"),
  comingSoon: $("comingSoon"),
};

const ALL = "Alle";
const FAVS = "★ Favoriten";
const GROUP_LABELS = { "Other stations": "Weitere Sender" };
const POLL_MS = 15000;

const state = {
  settings: loadSettings(),
  stations: [],
  group: load("group", ALL),
  query: "",
  favorites: new Set(load("favorites", [])),
  current: null,
  playing: false,
  output: "browser",
  nowPlaying: null,
  pollTimer: null,
  playToken: 0,
};

// ---------------------------------------------------------------- Anzeige

function setStatus(text) { el.status.textContent = text || ""; }

function setCover(src) {
  if (el.cover.src === src) return;
  el.cover.classList.add("loading");
  const img = new Image();
  img.onload = () => { el.cover.src = src; el.cover.classList.remove("loading"); };
  img.onerror = () => { el.cover.src = stationPlaceholder(state.current || { name: "?" }); el.cover.classList.remove("loading"); };
  img.src = src;
}

function renderTrack() {
  const s = state.current;
  const np = state.nowPlaying;
  el.stationName.textContent = s ? s.name : "Sender wählen";
  el.title.textContent = np?.title || (s ? "Livestream" : "music-browser");
  el.artist.textContent = np?.artist || (s ? GROUP_LABELS[s.group] || s.group : "Radio · Cover · Wetter");
  document.title = np ? `${np.artist} – ${np.title} · ${s.name}` : s ? `${s.name} · music-browser` : "music-browser";
  el.fav.textContent = s && state.favorites.has(s.id) ? "★" : "☆";
  updateMediaSession();
}

function renderPlayButton() {
  el.play.textContent = state.playing ? "⏸" : "▶";
  el.play.title = state.playing ? "Stopp" : "Abspielen";
}

function visibleStations() {
  const q = state.query.trim().toLowerCase();
  return state.stations.filter((s) => {
    if (state.group === FAVS && !state.favorites.has(s.id)) return false;
    if (state.group !== ALL && state.group !== FAVS && s.group !== state.group) return false;
    return !q || s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q);
  });
}

function renderGroups() {
  const groups = [ALL, FAVS, ...groupsOf(state.stations)];
  if (!groups.includes(state.group)) state.group = ALL;
  el.groups.innerHTML = groups.map((g) =>
    `<button class="group-chip${g === state.group ? " active" : ""}" data-group="${g}" role="tab">${GROUP_LABELS[g] || g}</button>`
  ).join("");
}

function renderList() {
  const items = visibleStations();
  const hasProxy = Boolean(state.settings.proxyUrl);
  el.list.innerHTML = items.map((s) => {
    const badge = !hasProxy && needsProxyForAudio(s) ? `<span class="badge" title="Benötigt den Proxy">Proxy</span>` : "";
    return `<li class="station${state.current?.id === s.id ? " active" : ""}" data-id="${s.id}">
      <span class="avatar" style="background:${colorFor(s.group || s.name)}">${initials(s.name)}</span>
      <span class="name">${s.name}</span>${badge}
      ${state.favorites.has(s.id) ? '<span class="fav">★</span>' : ""}
    </li>`;
  }).join("") || `<li class="muted small">Keine Sender gefunden.</li>`;
}

// ---------------------------------------------------------------- Wiedergabe

function stopPolling() { clearInterval(state.pollTimer); state.pollTimer = null; }

async function pollMetadata() {
  const station = state.current;
  if (!station) return;
  const np = await fetchNowPlaying(station, state.settings);
  if (station !== state.current) return;

  if (!np) {
    if (metadataNeedsProxy(station) && !state.settings.proxyUrl) {
      setStatus("Titel & Cover für diesen Sender brauchen den Metadaten-Proxy (⚙️ Einstellungen).");
    }
    if (!state.nowPlaying) setCover(stationPlaceholder(station));
    return;
  }
  if (el.status.textContent.startsWith("Titel & Cover")) setStatus("");
  const changed = !state.nowPlaying || np.artist !== state.nowPlaying.artist || np.title !== state.nowPlaying.title;
  if (!changed) return;

  state.nowPlaying = { ...np };
  renderTrack();
  const coverUrl = np.coverUrl || (await findCover(np.artist, np.title));
  if (station !== state.current || state.nowPlaying.title !== np.title) return;
  state.nowPlaying.coverUrl = coverUrl;
  setCover(coverUrl || stationPlaceholder(station));
  updateMediaSession();
}

function startPolling() {
  stopPolling();
  pollMetadata();
  state.pollTimer = setInterval(pollMetadata, POLL_MS);
}

async function play(station) {
  const token = ++state.playToken;
  const switched = state.current?.id !== station.id;
  state.current = station;
  if (switched) {
    state.nowPlaying = null;
    setCover(stationPlaceholder(station));
  }
  save("lastStation", station.id);
  renderTrack();
  renderList();
  setStatus("Verbinde …");

  let url;
  try {
    url = await resolveAudioUrl(station, state.settings);
  } catch (error) {
    if (token !== state.playToken) return;
    state.playing = false;
    renderPlayButton();
    setStatus(error.message);
    return;
  }
  if (token !== state.playToken) return;

  try {
    if (isCasting()) {
      el.audio.pause();
      await castStream({ url, station: station.name, ...(state.nowPlaying || {}) });
      setStatus("Läuft auf Chromecast");
    } else if (state.output.startsWith("ha:")) {
      el.audio.pause();
      await haPlay(state.settings, state.output.slice(3), url);
      setStatus(`Läuft auf ${el.output.selectedOptions[0]?.textContent.trim()}`);
    } else {
      el.audio.src = url;
      el.audio.volume = el.volume.value / 100;
      await el.audio.play();
      setStatus("");
    }
    state.playing = true;
  } catch (error) {
    if (token !== state.playToken) return;
    state.playing = false;
    setStatus(
      error.name === "NotAllowedError" ? "Zum Abspielen bitte ▶ klicken."
      : error.name === "NotSupportedError" ? "Stream konnte nicht geladen werden (Sender offline oder Format nicht unterstützt)."
      : `Fehler: ${error.message}`
    );
  }
  renderPlayButton();
  startPolling();
}

async function stop() {
  state.playToken++;
  state.playing = false;
  el.audio.pause();
  el.audio.removeAttribute("src");
  el.audio.load(); // Live-Stream wirklich trennen
  if (isCasting()) castStop();
  if (state.output.startsWith("ha:")) {
    haStop(state.settings, state.output.slice(3)).catch((e) => setStatus(e.message));
  }
  renderPlayButton();
  setStatus("");
}

function togglePlay() {
  if (state.playing) return stop();
  const station = state.current || visibleStations()[0] || state.stations[0];
  if (station) play(station);
}

function step(delta) {
  const list = visibleStations();
  if (!list.length) return;
  const i = list.findIndex((s) => s.id === state.current?.id);
  const next = list[(i + delta + list.length) % list.length];
  play(next);
}

function toggleFavorite() {
  const s = state.current;
  if (!s) return;
  state.favorites.has(s.id) ? state.favorites.delete(s.id) : state.favorites.add(s.id);
  save("favorites", [...state.favorites]);
  renderTrack();
  renderList();
}

function setVolume(level) {
  save("volume", level);
  el.audio.volume = level;
  if (isCasting()) castSetVolume(level);
  if (state.output.startsWith("ha:")) {
    clearTimeout(setVolume.timer);
    setVolume.timer = setTimeout(() => haVolume(state.settings, state.output.slice(3), level).catch(() => {}), 300);
  }
}

function updateMediaSession() {
  if (!("mediaSession" in navigator) || !state.current) return;
  const np = state.nowPlaying;
  const artwork = np?.coverUrl ? [{ src: np.coverUrl, sizes: "600x600", type: "image/jpeg" }] : [];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: np?.title || state.current.name,
    artist: np?.artist || "",
    album: state.current.name,
    artwork,
  });
}

// ---------------------------------------------------------------- Ausgabe

async function refreshOutputs() {
  const previous = state.output;
  el.output.innerHTML = `<option value="browser">🔊 Dieser Browser</option>`;
  if (haConfigured(state.settings)) {
    try {
      const players = await haListPlayers(state.settings);
      if (players.length) {
        const group = document.createElement("optgroup");
        group.label = "Home Assistant";
        for (const p of players) group.append(new Option(`🏠 ${p.name}`, `ha:${p.id}`));
        el.output.append(group);
      }
    } catch (error) {
      setStatus(`Home Assistant nicht erreichbar: ${error.message}`);
    }
  }
  const stillThere = [...el.output.options].some((o) => o.value === previous);
  state.output = stillThere ? previous : "browser";
  el.output.value = state.output;
}

async function changeOutput(value) {
  const wasPlaying = state.playing;
  if (wasPlaying) await stop();
  state.output = value;
  save("output", value);
  if (wasPlaying && state.current) play(state.current);
}

// ---------------------------------------------------------------- Wetter & Uhr

async function updateWeather() {
  try {
    renderWeather(el.weather, await fetchWeather(state.settings.weatherLocation));
  } catch (error) {
    el.weather.innerHTML = `<span class="muted small">Wetter: ${error.message}</span>`;
  }
}

function tickClock() {
  el.clock.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------- Quellen (Radio / Spotify / Apple)

const COMING = {
  spotify: `<h2>Spotify – Phase 2</h2>
    <p>Geplant über das <b>Spotify Web Playback SDK</b> (Wiedergabe direkt in diesem Tab) und die Web API
    (Übergabe an Spotify-Connect-Lautsprecher). Voraussetzungen: Spotify Premium und eine eigene App im
    Spotify-Developer-Dashboard. Im Development Mode sind seit 2026 höchstens fünf freigeschaltete Nutzer erlaubt –
    für dich und die Familie reicht das.</p>`,
  apple: `<h2>Apple Music – Phase 2</h2>
    <p>Geplant über <b>MusicKit JS</b>. Voraussetzungen: Apple-Developer-Account (für den Developer-Token)
    und ein Apple-Music-Abo der Hörer.</p>`,
};

function selectSource(source) {
  document.querySelectorAll(".source").forEach((b) => b.classList.toggle("active", b.dataset.source === source));
  const isRadio = source === "radio";
  el.nowPlaying.hidden = !isRadio;
  el.comingSoon.hidden = isRadio;
  el.comingSoon.innerHTML = COMING[source] || "";
}

// ---------------------------------------------------------------- Einstellungen

function openSettings() {
  const f = el.settingsForm.elements;
  for (const key of Object.keys(state.settings)) if (f[key]) f[key].value = state.settings[key];
  $("haTestResult").textContent = "";
  el.settings.showModal();
}

function readSettingsForm() {
  const f = el.settingsForm.elements;
  return {
    weatherLocation: f.weatherLocation.value.trim() || "Falkensee",
    proxyUrl: f.proxyUrl.value.trim(),
    haUrl: f.haUrl.value.trim(),
    haToken: f.haToken.value.trim(),
  };
}

async function testHa() {
  const out = $("haTestResult");
  out.textContent = "teste …";
  try {
    const players = await haListPlayers(readSettingsForm());
    out.textContent = `✅ ${players.length} Media-Player gefunden`;
  } catch (error) {
    out.textContent = `❌ ${error.message} (CORS/https prüfen)`;
  }
}

el.settings.addEventListener("close", async () => {
  if (el.settings.returnValue !== "save") return;
  const before = state.settings;
  state.settings = readSettingsForm();
  saveSettings(state.settings);
  if (before.weatherLocation !== state.settings.weatherLocation) updateWeather();
  if (before.haUrl !== state.settings.haUrl || before.haToken !== state.settings.haToken) refreshOutputs();
  renderList();
  if (state.current) pollMetadata();
});

// ---------------------------------------------------------------- Events

el.list.addEventListener("click", (e) => {
  const li = e.target.closest(".station");
  const station = li && state.stations.find((s) => s.id === li.dataset.id);
  if (station) play(station);
});
el.groups.addEventListener("click", (e) => {
  const chip = e.target.closest(".group-chip");
  if (!chip) return;
  state.group = chip.dataset.group;
  save("group", state.group);
  renderGroups();
  renderList();
});
el.search.addEventListener("input", () => { state.query = el.search.value; renderList(); });
el.play.addEventListener("click", togglePlay);
el.prev.addEventListener("click", () => step(-1));
el.next.addEventListener("click", () => step(1));
el.fav.addEventListener("click", toggleFavorite);
el.volume.addEventListener("input", () => setVolume(el.volume.value / 100));
el.output.addEventListener("change", () => changeOutput(el.output.value));
$("btnSettings").addEventListener("click", openSettings);
$("btnHaTest").addEventListener("click", testHa);
document.querySelectorAll(".source").forEach((b) => b.addEventListener("click", () => selectSource(b.dataset.source)));

el.audio.addEventListener("error", () => {
  if (state.playing && !isCasting() && state.output === "browser") {
    state.playing = false;
    renderPlayButton();
    setStatus("Stream konnte nicht geladen werden.");
  }
});
el.audio.addEventListener("waiting", () => state.playing && setStatus("Puffere …"));
el.audio.addEventListener("playing", () => setStatus(""));

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea") || el.settings.open) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "ArrowRight" && e.altKey) step(1);
  if (e.code === "ArrowLeft" && e.altKey) step(-1);
});

if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => !state.playing && togglePlay());
  navigator.mediaSession.setActionHandler("pause", () => state.playing && togglePlay());
  navigator.mediaSession.setActionHandler("stop", () => state.playing && stop());
  navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
  navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
}

// ---------------------------------------------------------------- Start

async function init() {
  tickClock();
  setInterval(tickClock, 1000);
  updateWeather();
  setInterval(updateWeather, 15 * 60 * 1000);

  const volume = load("volume", 0.7);
  el.volume.value = Math.round(volume * 100);
  el.audio.volume = volume;

  initCast(({ connected, name }) => {
    setStatus(connected ? `Verbunden mit ${name}` : "");
    if (connected && state.playing && state.current) play(state.current);
    else if (!connected && state.playing) stop();
  });

  state.output = load("output", "browser");
  await refreshOutputs();

  try {
    const { stations, source } = await loadStations();
    state.stations = stations;
    el.info.textContent = `${stations.length} Sender${source === "cache" ? " (Offline-Kopie)" : ""} · Quelle: TBR-BRD/radiostations`;
  } catch (error) {
    el.info.textContent = `Senderliste nicht ladbar: ${error.message}`;
  }

  renderGroups();
  const last = state.stations.find((s) => s.id === load("lastStation", null));
  if (last) {
    state.current = last;
    setCover(stationPlaceholder(last));
    renderTrack();
    startPolling(); // zeigt den aktuellen Titel schon vor dem Abspielen
  }
  renderList();
  renderPlayButton();
}

init();
