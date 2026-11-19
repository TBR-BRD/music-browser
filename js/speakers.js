// „🔊 Lautsprecher“ – ein Button, der je nach Browser den passenden Weg nimmt:
//   1. AirPlay   – Safari und alle Browser auf iPhone/iPad (WebKit), Safari am Mac
//                  (AirPlay-Lautsprecher, Apple TV, HomePod, Sonos mit AirPlay 2 …)
//   2. Google Cast – Chrome/Edge am Computer (Chromecast, Nest, Cast-Lautsprecher)
//   3. Remote Playback – Chrome auf Android (Cast-Geräte über das System)
// Bluetooth-Lautsprecher verbindet man im Betriebssystem; der Ton folgt automatisch.
import { requestCastSession, castAvailable } from "./cast.js";

function hasRemotePlayback(audio) {
  return Boolean(audio.remote && typeof audio.remote.prompt === "function");
}

/**
 * @param {HTMLAudioElement} audio
 * @param {{ ensurePlaying: () => Promise<void>, onInfo: (html: string) => void, onState: (text: string) => void }} hooks
 */
export function initSpeakers(audio, { ensurePlaying, onInfo, onState }) {
  const button = document.getElementById("btnSpeakers");
  if (!button) return;
  audio.setAttribute("x-webkit-airplay", "allow");

  // AirPlay: Anzeige, ob gerade auf einem Lautsprecher abgespielt wird
  audio.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", () => {
    const wireless = audio.webkitCurrentPlaybackTargetIsWireless;
    button.classList.toggle("active", Boolean(wireless));
    onState(wireless ? "Läuft über AirPlay" : "");
  });
  // Remote Playback (Android)
  if (audio.remote) {
    audio.remote.onconnect = () => { button.classList.add("active"); onState("Läuft auf dem Lautsprecher"); };
    audio.remote.ondisconnect = () => { button.classList.remove("active"); onState(""); };
  }

  button.addEventListener("click", async () => {
    // 1. Browser mit eingebauter AirPlay-Auswahl (Safari, iPhone/iPad): direkt öffnen
    if (typeof audio.webkitShowPlaybackTargetPicker === "function") {
      try {
        await ensurePlaying();
        audio.webkitShowPlaybackTargetPicker();
      } catch (error) {
        console.info("[speakers]", error);
        openChooser();
      }
      return;
    }
    // 2. sonst eigene Auswahl: Chromecast + Anleitung für AirPlay/Bluetooth
    openChooser();
  });

  function openChooser() {
    const dialog = document.getElementById("speakerHelp");
    const body = document.getElementById("speakerHelpBody");
    const canCast = castAvailable() || hasRemotePlayback(audio);
    body.innerHTML = chooserHtml(canCast);
    body.querySelector("#btnCastSearch")?.addEventListener("click", async () => {
      dialog.close();
      try {
        if (castAvailable()) {
          await requestCastSession(); // weitere Wiedergabe übernimmt app.js (Cast-Status)
        } else {
          await ensurePlaying();
          await audio.remote.prompt();
        }
      } catch (error) {
        console.info("[speakers]", error?.name, error?.message || error);
        onInfo(`<p><b>Kein Chromecast gefunden.</b> Gerät und Computer/Handy müssen im selben WLAN sein.</p>${airplayHelp()}`);
      }
    });
    dialog.showModal();
  }
}

function platform() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function airplayHelp() {
  switch (platform()) {
    case "mac":
      return `<p><b>AirPlay (z. B. Denon, HomePod, Apple TV):</b> Chrome und Edge können AirPlay auf dem Mac nicht selbst ansprechen. Zwei Wege:</p>
        <ol>
          <li><b>Ganzen Mac-Ton umleiten:</b> oben rechts das <b>Kontrollzentrum</b> öffnen → <b>Ton</b> → deinen AirPlay-Receiver (z. B. Denon) wählen. Der Ton dieser Seite läuft dann dort.</li>
          <li>Diese Seite in <b>Safari</b> öffnen – dort zeigt 🔊 die AirPlay-Geräte direkt an.</li>
        </ol>`;
    case "ios":
      return `<p><b>AirPlay (z. B. Denon, HomePod, Apple TV):</b> Sender starten, dann das <b>Kontrollzentrum</b> öffnen, in der Musik-Kachel auf das <b>AirPlay-Symbol</b> tippen und den Receiver wählen.</p>`;
    case "android":
      return `<p><b>AirPlay</b> gibt es nur auf Apple-Geräten. Denon-Receiver mit HEOS lassen sich über die <b>HEOS-App</b> oder per <b>Bluetooth</b> verbinden.</p>`;
    default:
      return `<p><b>AirPlay</b> gibt es nur auf Apple-Geräten (iPhone, iPad, Mac). Unter Windows: Receiver per <b>Bluetooth</b> verbinden oder die Hersteller-App nutzen.</p>`;
  }
}

function chooserHtml(canCast) {
  return `
    ${canCast ? `<p><button type="button" id="btnCastSearch" class="cast-search">📺 Chromecast / Google Nest suchen</button></p>` : ""}
    ${airplayHelp()}
    <p><b>Bluetooth-Lautsprecher:</b> im System verbinden – der Ton folgt automatisch.</p>
    <p class="muted small">Gerät und Computer/Handy müssen im selben WLAN sein.</p>`;
}
