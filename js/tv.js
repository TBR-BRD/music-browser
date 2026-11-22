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

export const isTv = (station) => station?.kind === "tv3q";

export async function startTv(station, container) {
  stopTv(container);
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
  if (container) container.replaceChildren();
}
