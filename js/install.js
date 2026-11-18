// Angebot „Auf dem Startbildschirm speichern“.
// Eine Webseite darf keine Lesezeichen selbst anlegen. Sie darf aber anbieten,
// sich als App zu installieren (Android/Chrome/Edge: ein Tipp genügt) bzw. auf
// iPhone/iPad erklären, wie es über „Teilen → Zum Home-Bildschirm“ geht.
// Das Angebot erscheint automatisch, wenn die Seite über den QR-Code geöffnet
// wurde (…?src=qr) oder auf einem Handy zum ersten Mal.
import { load, save } from "./storage.js";

const SNOOZE_DAYS = 30;
let deferredPrompt = null;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
const isMobile = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || isIos();

function snoozed() {
  const at = load("installDismissedAt", 0);
  return at && Date.now() - at < SNOOZE_DAYS * 864e5;
}

function render(banner) {
  const text = banner.querySelector(".install-text");
  const btn = banner.querySelector("#btnInstall");
  if (deferredPrompt) {
    text.innerHTML = "Speichere <b>Dein Music Browser</b> auf dem Startbildschirm – dann ist dein Radio nur einen Tipp entfernt.";
    btn.hidden = false;
  } else if (isIos()) {
    text.innerHTML = 'Auf dem Home-Bildschirm speichern: unten auf <b>Teilen</b> <span class="ios-share" aria-label="Teilen-Symbol">⬆︎</span> tippen und dann <b>„Zum Home-Bildschirm“</b> wählen.';
    btn.hidden = true;
  } else {
    text.innerHTML = 'Auf dem Startbildschirm speichern: im Browser-Menü <b>⋮</b> auf <b>„Zum Startbildschirm hinzufügen“</b> bzw. <b>„App installieren“</b> tippen.';
    btn.hidden = true;
  }
}

function show(banner) {
  render(banner);
  banner.hidden = false;
  requestAnimationFrame(() => banner.classList.add("open"));
}

function hide(banner, snooze) {
  banner.classList.remove("open");
  setTimeout(() => { banner.hidden = true; }, 300);
  if (snooze) save("installDismissedAt", Date.now());
}

export function initInstall() {
  const banner = document.getElementById("installBanner");
  if (!banner) return;

  // Kennung aus dem QR-Code merken und aus der Adresse entfernen,
  // damit gespeicherte Links sauber bleiben.
  const params = new URLSearchParams(location.search);
  const fromQr = params.get("src") === "qr";
  if (fromQr) {
    params.delete("src");
    const clean = location.pathname + (params.toString() ? `?${params}` : "") + location.hash;
    history.replaceState(null, "", clean);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // eigenes Angebot statt der Browser-Leiste
    deferredPrompt = event;
    if (!banner.hidden) render(banner);
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hide(banner, true);
  });

  banner.querySelector("#btnInstall").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    deferredPrompt = null;
    hide(banner, outcome !== "accepted");
  });
  banner.querySelector("#btnInstallLater").addEventListener("click", () => hide(banner, true));

  if (isStandalone()) return; // läuft schon als App
  if (!(fromQr || isMobile())) return;
  if (snoozed() && !fromQr) return;

  // kurz warten, ob der Browser die Ein-Tipp-Installation anbietet
  setTimeout(() => show(banner), isIos() ? 1200 : 2500);
}
