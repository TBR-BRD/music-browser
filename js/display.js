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

// Live-TV: Der Player bleibt in der Seite (Umhängen würde das Video stoppen)
// und wird im Display-Modus genau über die Cover-Fläche gelegt.
let tvWatch = null;
function placeTv() {
  const tv = $("tvPlayer");
  if (!tv) return;
  const active = isDisplayMode() && document.body.classList.contains("tv-mode");
  document.body.classList.toggle("dm-tv", active);
  if (!active) {
    clearInterval(tvWatch); tvWatch = null;
    tv.removeAttribute("style");
    return;
  }
  // iPad/iOS melden Größenänderungen (Drehen, Vollbild, Leisten) teils verspätet –
  // deshalb solange der Modus läuft regelmäßig nachmessen.
  if (!tvWatch) tvWatch = setInterval(placeTv, 400);
  const r = $("dmCover").getBoundingClientRect();
  if (!r.width) return;
  const h = r.width * 9 / 16;
  const next = {
    position: "fixed", zIndex: "60", left: `${Math.round(r.left)}px`, top: `${Math.round(r.top + (r.height - h) / 2)}px`,
    width: `${Math.round(r.width)}px`, height: `${Math.round(h)}px`, aspectRatio: "auto", margin: "0",
  };
  for (const [k, v] of Object.entries(next)) if (tv.style[k] !== v) tv.style[k] = v;
}

export function enterDisplayMode() {
  const root = $("displayMode");
  root.hidden = false;
  document.body.classList.add("display-mode");
  requestFullscreen();
  requestWakeLock();
  showControls();
  requestAnimationFrame(placeTv);
}

export function exitDisplayMode() {
  const root = $("displayMode");
  root.hidden = true;
  root.classList.remove("show-controls");
  document.body.classList.remove("display-mode");
  releaseWakeLock();
  exitFullscreen();
  placeTv();
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
  // TV-Player nachführen: Senderwechsel, Drehen, Vollbild, Fenstergröße
  new MutationObserver(() => requestAnimationFrame(placeTv)).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", () => requestAnimationFrame(placeTv));
  window.addEventListener("orientationchange", () => setTimeout(placeTv, 300));
  window.visualViewport?.addEventListener("resize", () => requestAnimationFrame(placeTv));
  if ("ResizeObserver" in window) new ResizeObserver(() => placeTv()).observe($("dmCover"));
  document.addEventListener("fullscreenchange", () => setTimeout(placeTv, 100));
  document.addEventListener("webkitfullscreenchange", () => setTimeout(placeTv, 100));
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
