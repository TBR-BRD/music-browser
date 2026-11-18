// „🔊 Lautsprecher“ – ein Button, der je nach Browser den passenden Weg nimmt:
//   1. AirPlay   – Safari und alle Browser auf iPhone/iPad (WebKit), Safari am Mac
//                  (AirPlay-Lautsprecher, Apple TV, HomePod, Sonos mit AirPlay 2 …)
//   2. Google Cast – Chrome/Edge am Computer (Chromecast, Nest, Cast-Lautsprecher)
//   3. Remote Playback – Chrome auf Android (Cast-Geräte über das System)
// Bluetooth-Lautsprecher verbindet man im Betriebssystem; der Ton folgt automatisch.
import { requestCastSession, castAvailable } from "./cast.js";

function hasAirPlay(audio) {
  return typeof audio.webkitShowPlaybackTargetPicker === "function" || "WebKitPlaybackTargetAvailabilityEvent" in window;
}

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
    try {
      if (hasAirPlay(audio) && typeof audio.webkitShowPlaybackTargetPicker === "function") {
        await ensurePlaying();
        audio.webkitShowPlaybackTargetPicker();
        return;
      }
      if (castAvailable()) {
        await requestCastSession(); // weitere Wiedergabe übernimmt app.js (Cast-Status)
        return;
      }
      if (hasRemotePlayback(audio)) {
        await ensurePlaying();
        await audio.remote.prompt();
        return;
      }
      onInfo(noDeviceHelp());
    } catch (error) {
      // Dialog abgebrochen oder kein Gerät gefunden -> Hilfe anzeigen
      console.info("[speakers]", error?.name, error?.message || error);
      onInfo(noDeviceHelp(true));
    }
  });
}

function noDeviceHelp(searched = false) {
  return `
    ${searched ? "<p><b>Kein Lautsprecher gefunden.</b> Gerät und Handy/Computer müssen im selben WLAN sein.</p>" : ""}
    <p><b>So geht's je nach Gerät:</b></p>
    <ul>
      <li><b>iPhone, iPad, Mac:</b> AirPlay – in Safari bzw. Chrome auf dem iPhone auf 🔊 tippen.</li>
      <li><b>Chromecast / Google Nest:</b> in Chrome oder Edge am Computer bzw. Chrome auf Android.</li>
      <li><b>Bluetooth-Lautsprecher:</b> einfach im System verbinden – der Ton folgt automatisch.</li>
      <li><b>Sonos:</b> Modelle mit AirPlay 2 über AirPlay; ältere Modelle über die Sonos-App.</li>
    </ul>`;
}
