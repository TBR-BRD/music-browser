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

  // Immer zuerst die eigene Auswahl: ältere AirPlay-1-Receiver (z. B. Denon AVR-X2000)
  // tauchen in der Safari-Liste zwar auf, lassen sich von dort aber nicht verbinden –
  // über das Kontrollzentrum (Systemton) klappt es dagegen.
  button.addEventListener("click", () => openChooser());

  function openChooser() {
    const dialog = document.getElementById("speakerHelp");
    const body = document.getElementById("speakerHelpBody");
    const canCast = castAvailable() || hasRemotePlayback(audio);
    const canAirPlay = typeof audio.webkitShowPlaybackTargetPicker === "function";
    body.innerHTML = chooserHtml(canCast, canAirPlay);
    body.querySelector("#btnAirPlay")?.addEventListener("click", async () => {
      dialog.close();
      try {
        await ensurePlaying();
        audio.webkitShowPlaybackTargetPicker();
      } catch (error) {
        console.info("[speakers]", error);
      }
    });
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
        onInfo(`<p><b>Kein Chromecast gefunden.</b> Gerät und Computer/Handy müssen im selben WLAN sein.</p>${airplayHelp(false)}`);
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

function airplayHelp(canAirPlay) {
  const systemWay = {
    mac: "oben rechts das <b>Kontrollzentrum</b> → <b>Ton</b> → Receiver wählen",
    ios: "Sender starten, <b>Kontrollzentrum</b> öffnen → in der Musik-Kachel auf das <b>AirPlay-Symbol</b> tippen → Receiver wählen",
  }[platform()];
  if (!systemWay) {
    return platform() === "android"
      ? `<p><b>AirPlay</b> gibt es nur auf Apple-Geräten. Denon-Receiver mit HEOS lassen sich über die <b>HEOS-App</b> oder per <b>Bluetooth</b> verbinden.</p>`
      : `<p><b>AirPlay</b> gibt es nur auf Apple-Geräten (iPhone, iPad, Mac). Unter Windows: Receiver per <b>Bluetooth</b> verbinden oder die Hersteller-App nutzen.</p>`;
  }
  return `<p><b>AirPlay über das System</b> – klappt mit allen AirPlay-Geräten, auch älteren Receivern (z. B. Denon AVR-X2000): ${systemWay}. Der Ton dieser Seite läuft dann dort.</p>
    ${canAirPlay ? "" : `<p class="muted small">${platform() === "mac" ? "Chrome und Edge haben am Mac keine eigene AirPlay-Liste – in Safari gibt es oben zusätzlich den Button „AirPlay-Geräte anzeigen“." : ""}</p>`}`;
}

function chooserHtml(canCast, canAirPlay) {
  return `
    ${canAirPlay ? `<p><button type="button" id="btnAirPlay" class="cast-search">📡 AirPlay-Geräte anzeigen</button></p>
      <p class="muted small">Für HomePod, Apple TV und AirPlay-2-Lautsprecher. Ältere Receiver erscheinen hier evtl. auch, verbinden sich aber nicht – dann den Weg über das System nehmen (unten).</p>` : ""}
    ${canCast ? `<p><button type="button" id="btnCastSearch" class="cast-search">📺 Chromecast / Google Nest suchen</button></p>` : ""}
    ${airplayHelp(canAirPlay)}
    <p><b>Bluetooth-Lautsprecher:</b> im System verbinden – der Ton folgt automatisch.</p>
    <p class="muted small">Gerät und Computer/Handy müssen im selben WLAN sein.</p>`;
}
