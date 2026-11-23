// Live-TV über den offiziellen 3Q-Player des Senders (z. B. DELUXE MUSIC).
// Der Player bringt Bild, Ton, Steuerung und ggf. Werbung des Senders selbst mit.
const PLAYER_JS = "https://player.3qsdn.com/js3q.latest.js";
let loading = null;
let player = null;

function loadPlayerScript() {
  if (window.js3q) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PLAYER_JS;
      s.async = true;
      s.onload = () => (window.js3q ? resolve() : reject(new Error("Player nicht verfügbar")));
      s.onerror = () => { loading = null; reject(new Error("Player konnte nicht geladen werden")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

const HLS_JS = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";
let hlsLoading = null;
let hls = null;

function loadHlsJs() {
  if (window.Hls) return Promise.resolve();
  if (!hlsLoading) {
    hlsLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = HLS_JS;
      s.async = true;
      s.onload = () => (window.Hls ? resolve() : reject(new Error("Videoplayer nicht verfügbar")));
      s.onerror = () => { hlsLoading = null; reject(new Error("Videoplayer konnte nicht geladen werden")); };
      document.head.appendChild(s);
    });
  }
  return hlsLoading;
}

export const isTv = (station) => station?.kind === "tv3q" || station?.kind === "hls";

/** Offizielle HLS-Livestreams (ARD, ZDF & Co.): Safari spielt sie direkt, sonst hls.js. */
async function startHls(station, container) {
  const video = document.createElement("video");
  Object.assign(video, { controls: true, autoplay: true, playsInline: true });
  video.setAttribute("playsinline", "");
  video.setAttribute("x-webkit-airplay", "allow");
  video.style.cssText = "width:100%;height:100%;background:#000;display:block";
  container.appendChild(video);
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = station.streamUrl;
  } else {
    await loadHlsJs();
    if (!window.Hls.isSupported()) throw new Error("Dieser Browser kann den Videostream nicht abspielen.");
    hls = new window.Hls({ lowLatencyMode: false, capLevelToPlayerSize: true });
    hls.loadSource(station.streamUrl);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.ERROR, (_e, data) => {
      if (data?.fatal) console.warn("[tv] HLS-Fehler:", data.type, data.details);
    });
  }
  try {
    await video.play();
  } catch (error) {
    if (error?.name !== "NotAllowedError") throw error; // Autoplay mit Ton blockiert → ▶ im Bild
  }
}

export async function startTv(station, container) {
  stopTv(container);
  if (station.kind === "hls") return startHls(station, container);
  await loadPlayerScript();
  const target = document.createElement("div");
  target.id = `tv3q-${Date.now()}`;
  container.appendChild(target);
  player = new window.js3q({
    dataid: station.dataId,
    container: target.id,
    autoplay: true,
    muted: false,
    ads: false,
  });
  return player;
}

export function stopTv(container) {
  try { player?.pause?.(); } catch { /* egal */ }
  try { player?.destroy?.(); } catch { /* egal */ }
  player = null;
  try { hls?.destroy(); } catch { /* egal */ }
  hls = null;
  if (container) {
    container.querySelectorAll("video").forEach((v) => { v.pause(); v.removeAttribute("src"); v.load(); });
    container.replaceChildren();
  }
}
