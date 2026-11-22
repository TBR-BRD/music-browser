// Display-Modus: reine Anzeige für iPad/Tablet als Radio-Display –
// großes Cover, Titel, Interpret, Uhr, Datum und Wetter, ohne Senderliste.
// Antippen blendet die Steuerung für ein paar Sekunden ein.
// Während der Modus läuft, bleibt der Bildschirm an (Screen Wake Lock),
// und wo der Browser es erlaubt, wird echtes Vollbild angefordert.

const HIDE_CONTROLS_MS = 4000;
let wakeLock = null;
let hideTimer = null;

const $ = (id) => document.getElementById(id);

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener?.("release", () => { wakeLock = null; });
    }
  } catch (error) {
    console.info("[display] Wake Lock nicht möglich:", error?.message || error);
  }
}

function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

function requestFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn || document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    const result = fn.call(el);
    result?.catch?.(() => {}); // iPhone/Chrome auf iOS: nicht erlaubt – egal
  } catch { /* ignorieren */ }
}

function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    try { fn?.call(document)?.catch?.(() => {}); } catch { /* ignorieren */ }
  }
}

export function isDisplayMode() {
  return document.body.classList.contains("display-mode");
}

function showControls() {
  const root = $("displayMode");
  root.classList.add("show-controls");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => root.classList.remove("show-controls"), HIDE_CONTROLS_MS);
}

export function enterDisplayMode() {
  const root = $("displayMode");
  root.hidden = false;
  document.body.classList.add("display-mode");
  requestFullscreen();
  requestWakeLock();
  showControls();
}

export function exitDisplayMode() {
  const root = $("displayMode");
  root.hidden = true;
  root.classList.remove("show-controls");
  document.body.classList.remove("display-mode");
  releaseWakeLock();
  exitFullscreen();
}

/** Text-Inhalte übernehmen (wird von app.js bei jeder Änderung aufgerufen). */
export function updateDisplay({ station, title, artist, playing }) {
  $("dmStation").textContent = station || "";
  $("dmTitle").textContent = title || "";
  $("dmArtist").textContent = artist || "";
  $("dmPlay").textContent = playing ? "⏸" : "▶";
}

export function updateDisplayClock(time, date) {
  $("dmClock").textContent = time;
  $("dmDate").textContent = date;
}

/**
 * @param {{ onPlay: () => void, onPrev: () => void, onNext: () => void }} actions
 */
export function initDisplay({ onPlay, onPrev, onNext }) {
  const root = $("displayMode");
  const cover = document.getElementById("cover");

  // Cover und unscharfer Hintergrund folgen dem großen Cover der Seite
  const syncCover = () => {
    const src = cover.getAttribute("src");
    $("dmCover").src = src;
    $("dmBg").style.backgroundImage = `url("${src.replace(/"/g, "%22")}")`;
  };
  new MutationObserver(syncCover).observe(cover, { attributes: true, attributeFilter: ["src"] });
  syncCover();

  $("btnDisplay").addEventListener("click", enterDisplayMode);
  root.addEventListener("click", (e) => {
    if (e.target.closest(".dm-controls button")) return;
    showControls();
  });
  $("dmPlay").addEventListener("click", () => { onPlay(); showControls(); });
  $("dmPrev").addEventListener("click", () => { onPrev(); showControls(); });
  $("dmNext").addEventListener("click", () => { onNext(); showControls(); });
  $("dmExit").addEventListener("click", exitDisplayMode);

  document.addEventListener("keydown", (e) => {
    if (!isDisplayMode()) return;
    if (e.key === "Escape") exitDisplayMode();
  });
  // Wake Lock geht beim Wechsel in den Hintergrund verloren – danach neu anfordern
  document.addEventListener("visibilitychange", () => {
    if (isDisplayMode() && document.visibilityState === "visible" && !wakeLock) requestWakeLock();
  });
}
