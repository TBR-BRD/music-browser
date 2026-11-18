import { load, save, loadSettings, saveSettings } from "./storage.js";
import { loadStations, groupsOf } from "./stations.js";
import { fetchNowPlaying, resolveAudioUrl, hasLiveMetadata, fetchStationLogo } from "./metadata.js";
import { findCover, stationPlaceholder, colorFor, initials } from "./cover.js";
import { fetchWeather, renderWeather } from "./weather.js";
import { initCast, isCasting, castStream, castSetVolume, castStop } from "./cast.js";
import { GROUP_LABELS, GROUP_ORDER_LAST } from "./config.js";
import { initInstall } from "./install.js";

const $ = (id) => document.getElementById(id);
const el = {
  audio: $("audio"), cover: $("cover"), stationName: $("stationName"),
  title: $("trackTitle"), artist: $("trackArtist"), status: $("status"),
  play: $("btnPlay"), prev: $("btnPrev"), next: $("btnNext"), fav: $("btnFav"),
  volume: $("volume"), list: $("stationList"), providers: $("providers"),
  providerTitle: $("providerTitle"), search: $("search"), info: $("stationInfo"),
  weather: $("weather"), clock: $("clock"), date: $("date"), view: $("btnView"),
  settings: $("settings"), settingsForm: $("settingsForm"),
};

const FAVS = "__favs";
const POLL_MS = 15000;
const VIEW_MODES = ["auto", "full", "mobile"];
const VIEW_LABELS = { auto: ["🔄", "Auto"], full: ["🖥️", "Voll"], mobile: ["📱", "Mobil"] };
const mobileQuery = window.matchMedia("(max-width: 860px)");

const state = {
  settings: loadSettings(),
  stations: [],
  groups: [],
  group: load("group", null),
  query: "",
  favorites: new Set(load("favorites", [])),
  current: null,
  playing: false,
  nowPlaying: null,
  pollTimer: null,
  playToken: 0,
  viewMode: VIEW_MODES.includes(load("viewMode", "auto")) ? load("viewMode", "auto") : "auto",
};

const label = (group) => (group === FAVS ? "★ Favoriten" : GROUP_LABELS[group] || group);

// ---------------------------------------------------------------- Ansicht & Theme

function applyView() {
  const mobile = state.viewMode === "mobile" || (state.viewMode === "auto" && mobileQuery.matches);
  document.body.classList.toggle("view-mobile", mobile);
  document.body.classList.toggle("view-full", !mobile);
  // Vollansicht: Anbieter links über den Sendern – Mobil: als Leiste in der Kopfzeile
  const browser = document.querySelector(".browser");
  const brand = document.querySelector(".topbar .brand");
  if (mobile && el.providers.parentElement !== brand.parentElement) brand.after(el.providers);
  if (!mobile && el.providers.parentElement !== browser) browser.prepend(el.providers);
  const [icon, text] = VIEW_LABELS[state.viewMode];
  el.view.innerHTML = `${icon}<span class="txt"> ${text}</span>`;
  el.view.title = state.viewMode === "auto"
    ? `Automatisch (gerade ${mobile ? "Mobil" : "Voll"}) – klicken zum Umschalten`
    : "Klicken zum Umschalten";
}

function cycleView() {
  state.viewMode = VIEW_MODES[(VIEW_MODES.indexOf(state.viewMode) + 1) % VIEW_MODES.length];
  save("viewMode", state.viewMode);
  applyView();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.querySelector('meta[name="theme-color"]')
    .setAttribute("content", state.settings.theme === "light" ? "#eef2fa" : "#080b14");
}

// ---------------------------------------------------------------- Anzeige

function setStatus(text) { el.status.textContent = text || ""; }

let coverRequest = 0;
function setCover(src) {
  // Nur die zuletzt angeforderte Grafik darf angezeigt werden (Ladezeiten sind unterschiedlich).
  const request = ++coverRequest;
  if (el.cover.getAttribute("src") === src) { el.cover.classList.remove("loading"); return; }
  el.cover.classList.add("loading");
  const img = new Image();
  img.onload = () => {
    if (request !== coverRequest) return;
    el.cover.src = src;
    el.cover.classList.remove("loading");
  };
  img.onerror = () => {
    if (request !== coverRequest) return;
    el.cover.src = stationPlaceholder(state.current || { name: "?" });
    el.cover.classList.remove("loading");
  };
  img.src = src;
}

/** Senderlogo des Anbieters, sonst das erzeugte Sender-Bild. */
async function showStationCover(station) {
  setCover(stationPlaceholder(station));
  const request = coverRequest;
  const logo = await fetchStationLogo(station);
  // Logo nur zeigen, wenn inzwischen kein Albumcover angefordert wurde
  if (logo && request === coverRequest && state.current?.id === station.id) setCover(logo);
}

function renderTrack() {
  const s = state.current;
  const np = state.nowPlaying;
  el.stationName.textContent = s ? s.name : "Sender wählen";
  el.title.textContent = np?.title || (s ? s.name : "Dein Music Browser");
  el.artist.textContent = np?.artist || (s ? (state.playing ? "Livestream" : label(s.group)) : "Radio · Cover · Wetter");
  document.title = np ? `${np.artist} – ${np.title} · ${s.name}` : s ? `${s.name} · Dein Music Browser` : "Dein Music Browser";
  el.fav.textContent = s && state.favorites.has(s.id) ? "★" : "☆";
  updateMediaSession();
}

function renderPlayButton() {
  el.play.textContent = state.playing ? "⏸" : "▶";
  el.play.title = state.playing ? "Stopp" : "Abspielen";
}

function stationsOfGroup(group) {
  if (group === FAVS) return state.stations.filter((s) => state.favorites.has(s.id));
  return state.stations.filter((s) => s.group === group);
}

function visibleStations() {
  const words = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    return state.stations.filter((s) => {
      const hay = `${s.name} ${label(s.group)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return stationsOfGroup(state.group);
}

function renderProviders() {
  const buttons = [...state.groups, FAVS];
  el.providers.innerHTML = buttons.map((g) =>
    `<button class="provider${g === state.group && !state.query ? " active" : ""}" data-group="${g}">${label(g)}</button>`
  ).join("");
}

function renderList() {
  const items = visibleStations();
  const searching = Boolean(state.query.trim());
  el.providerTitle.textContent = searching ? `Suche: ${items.length} Treffer` : `${label(state.group)} · ${items.length} Sender`;
  el.list.innerHTML = items.map((s) => `
    <li class="station${state.current?.id === s.id ? " active" : ""}" data-id="${s.id}">
      <span class="avatar" style="background:${colorFor(s.group || s.name)}">${initials(s.name)}</span>
      <span class="name">${s.name}${searching ? `<br><span class="group">${label(s.group)}</span>` : ""}</span>
      ${state.favorites.has(s.id) ? '<span class="fav" title="Favorit">★</span>' : ""}
    </li>`).join("")
    || `<li class="muted small">${state.group === FAVS && !searching
      ? "Noch keine Favoriten – beim laufenden Sender auf ☆ tippen."
      : "Keine Sender gefunden."}</li>`;
}

function selectGroup(group) {
  state.group = group;
  state.query = "";
  el.search.value = "";
  save("group", group);
  renderProviders();
  renderList();
  el.list.scrollTop = 0;
}

// ---------------------------------------------------------------- Wiedergabe

function stopPolling() { clearInterval(state.pollTimer); state.pollTimer = null; }

async function pollMetadata() {
  const station = state.current;
  if (!station || !hasLiveMetadata(station)) return;
  const np = await fetchNowPlaying(station);
  if (station !== state.current || !np) return;

  const changed = !state.nowPlaying || np.artist !== state.nowPlaying.artist || np.title !== state.nowPlaying.title;
  if (!changed) return;

  state.nowPlaying = { ...np };
  renderTrack();
  const coverUrl = np.coverUrl || (await findCover(np.artist, np.title));
  if (station !== state.current || state.nowPlaying?.title !== np.title) return;
  state.nowPlaying.coverUrl = coverUrl;
  if (coverUrl) setCover(coverUrl);
  else showStationCover(station);
  updateMediaSession();
}

function startPolling() {
  stopPolling();
  if (!state.current || !hasLiveMetadata(state.current)) return;
  pollMetadata();
  state.pollTimer = setInterval(pollMetadata, POLL_MS);
}

async function play(station) {
  const token = ++state.playToken;
  if (state.current?.id !== station.id) {
    state.nowPlaying = null;
    showStationCover(station);
  }
  state.current = station;
  save("lastStation", station.id);
  renderTrack();
  renderList();
  setStatus("Verbinde …");
  startPolling();

  let url;
  try {
    url = await resolveAudioUrl(station);
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
    } else {
      el.audio.src = url;
      el.audio.volume = el.volume.value / 100;
      await el.audio.play();
      setStatus(hasLiveMetadata(station) ? "" : "Für diesen Sender gibt es im Browser keine Titelinfos.");
    }
    state.playing = true;
  } catch (error) {
    if (token !== state.playToken) return;
    state.playing = false;
    setStatus(
      error.name === "NotAllowedError" ? "Zum Abspielen bitte ▶ tippen."
      : error.name === "NotSupportedError" ? "Stream konnte nicht geladen werden (Sender offline oder Format nicht unterstützt)."
      : `Fehler: ${error.message}`
    );
  }
  renderPlayButton();
  renderTrack();
}

function stop() {
  state.playToken++;
  state.playing = false;
  el.audio.pause();
  el.audio.removeAttribute("src");
  el.audio.load(); // Live-Stream wirklich trennen
  if (isCasting()) castStop();
  renderPlayButton();
  renderTrack();
  setStatus("");
}

function togglePlay() {
  if (state.playing) return stop();
  const station = state.current || visibleStations()[0] || state.stations[0];
  if (station) play(station);
}

function step(delta) {
  // innerhalb des Anbieters (bzw. der Favoriten) des laufenden Senders weiterschalten
  const list = state.current
    ? (state.group === FAVS && state.favorites.has(state.current.id) ? stationsOfGroup(FAVS) : stationsOfGroup(state.current.group))
    : visibleStations();
  if (!list.length) return;
  const i = list.findIndex((s) => s.id === state.current?.id);
  play(list[(i + delta + list.length) % list.length]);
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
}

function updateMediaSession() {
  if (!("mediaSession" in navigator) || !state.current) return;
  const np = state.nowPlaying;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: np?.title || state.current.name,
    artist: np?.artist || "",
    album: state.current.name,
    artwork: np?.coverUrl ? [{ src: np.coverUrl, sizes: "600x600", type: "image/jpeg" }] : [],
  });
}

// ---------------------------------------------------------------- Datum, Uhr, Wetter

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const DATE_SHORT = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" });

function tickClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  el.date.innerHTML = `<span class="long">${DATE_FMT.format(now)}</span><span class="short">${DATE_SHORT.format(now)}</span>`;
}

async function updateWeather() {
  try {
    renderWeather(el.weather, await fetchWeather(state.settings.weatherLocation));
  } catch (error) {
    el.weather.innerHTML = `<span class="muted small">Wetter: ${error.message}</span>`;
  }
}

// ---------------------------------------------------------------- Einstellungen

function openSettings() {
  const f = el.settingsForm.elements;
  f.weatherLocation.value = state.settings.weatherLocation;
  f.darkMode.checked = state.settings.theme === "dark";
  el.settings.showModal();
}

el.settings.addEventListener("close", () => {
  if (el.settings.returnValue !== "save") return;
  const f = el.settingsForm.elements;
  const before = state.settings;
  state.settings = {
    weatherLocation: f.weatherLocation.value.trim() || "Falkensee",
    theme: f.darkMode.checked ? "dark" : "light",
  };
  saveSettings(state.settings);
  applyTheme();
  if (before.weatherLocation !== state.settings.weatherLocation) updateWeather();
});

// ---------------------------------------------------------------- Events

el.providers.addEventListener("click", (e) => {
  const btn = e.target.closest(".provider");
  if (btn) selectGroup(btn.dataset.group);
});
el.list.addEventListener("click", (e) => {
  const li = e.target.closest(".station");
  const station = li && state.stations.find((s) => s.id === li.dataset.id);
  if (station) play(station);
});
el.search.addEventListener("input", () => { state.query = el.search.value; renderProviders(); renderList(); });
el.play.addEventListener("click", togglePlay);
el.prev.addEventListener("click", () => step(-1));
el.next.addEventListener("click", () => step(1));
el.fav.addEventListener("click", toggleFavorite);
el.volume.addEventListener("input", () => setVolume(el.volume.value / 100));
el.view.addEventListener("click", cycleView);
$("btnSettings").addEventListener("click", openSettings);
$("btnQr").addEventListener("click", () => $("qrDialog").showModal());
$("qrHint").addEventListener("click", () => $("qrDialog").showModal());
$("btnCopyLink").addEventListener("click", async (e) => {
  const url = "https://tbr-brd.github.io/music-browser/";
  try {
    await navigator.clipboard.writeText(url);
    e.target.textContent = "✓ Kopiert";
  } catch {
    e.target.textContent = url;
  }
  setTimeout(() => { e.target.textContent = "Link kopieren"; }, 2500);
});
// Höhe der Kopfzeile für die mitlaufende Senderliste
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty("--topbar-h", `${Math.ceil(entry.target.offsetHeight)}px`);
}).observe(document.querySelector(".topbar"));
mobileQuery.addEventListener("change", applyView);

el.audio.addEventListener("error", () => {
  if (state.playing && !isCasting()) {
    state.playing = false;
    renderPlayButton();
    setStatus("Stream konnte nicht geladen werden.");
  }
});
el.audio.addEventListener("waiting", () => state.playing && setStatus("Puffere …"));
el.audio.addEventListener("playing", () => {
  if (el.status.textContent === "Puffere …") setStatus("");
});

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
  initInstall();
  applyTheme();
  applyView();
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

  try {
    const { stations, source } = await loadStations();
    state.stations = stations;
    el.info.textContent = `${stations.length} Sender${source === "cache" ? " (Offline-Kopie)" : ""}`;
  } catch (error) {
    el.info.textContent = `Senderliste nicht ladbar: ${error.message}`;
  }

  const groups = groupsOf(state.stations);
  state.groups = [
    ...groups.filter((g) => !GROUP_ORDER_LAST.includes(g)),
    ...GROUP_ORDER_LAST.filter((g) => groups.includes(g)),
  ];
  if (state.group !== FAVS && !state.groups.includes(state.group)) state.group = state.groups[0];

  const last = state.stations.find((s) => s.id === load("lastStation", null));
  if (last) {
    state.current = last;
    showStationCover(last);
    renderTrack();
    startPolling(); // zeigt den aktuellen Titel schon vor dem Abspielen
  }
  renderProviders();
  renderList();
  renderPlayButton();
}

init();
