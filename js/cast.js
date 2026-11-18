// Google Cast (Chromecast, Nest, Cast-fähige Lautsprecher/TVs) – nur in Chrome/Edge.
// Nutzt den Standard-Receiver von Google, kein eigener Receiver nötig.

const SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const listeners = new Set();
let ready = false;

export function initCast(onStateChange) {
  if (onStateChange) listeners.add(onStateChange);
  if (document.querySelector(`script[src^="${SDK_URL.split("?")[0]}"]`)) return;

  window.__onGCastApiAvailable = (isAvailable) => {
    if (!isAvailable || !window.cast?.framework) return;
    const context = cast.framework.CastContext.getInstance();
    context.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    ready = true;
    context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (event) => {
      const connected =
        event.sessionState === cast.framework.SessionState.SESSION_STARTED ||
        event.sessionState === cast.framework.SessionState.SESSION_RESUMED;
      const name = context.getCurrentSession()?.getCastDevice()?.friendlyName || "";
      listeners.forEach((fn) => fn({ connected, name }));
    });
  };

  const script = document.createElement("script");
  script.src = SDK_URL;
  script.async = true;
  document.head.appendChild(script);
}

function session() {
  if (!ready) return null;
  return cast.framework.CastContext.getInstance().getCurrentSession();
}

/** Ist Google Cast nutzbar und mindestens ein Gerät im Netz? */
export function castAvailable() {
  if (!ready) return false;
  const state = cast.framework.CastContext.getInstance().getCastState();
  return state !== cast.framework.CastState.NO_DEVICES_AVAILABLE;
}

/** Öffnet den Cast-Gerätedialog von Chrome. */
export function requestCastSession() {
  return cast.framework.CastContext.getInstance().requestSession();
}

export function isCasting() {
  return Boolean(session());
}

function contentTypeFor(url) {
  if (/aac/i.test(url)) return "audio/aac";
  if (/ogg/i.test(url)) return "audio/ogg";
  return "audio/mpeg";
}

export async function castStream({ url, station, artist, title, coverUrl }) {
  const s = session();
  if (!s) throw new Error("Keine Cast-Verbindung");
  const media = new chrome.cast.media.MediaInfo(url, contentTypeFor(url));
  media.streamType = chrome.cast.media.StreamType.LIVE;
  const meta = new chrome.cast.media.MusicTrackMediaMetadata();
  meta.title = title || station;
  meta.artist = artist || "";
  meta.albumName = station;
  if (coverUrl && /^https:/.test(coverUrl)) meta.images = [new chrome.cast.Image(coverUrl)];
  media.metadata = meta;
  await s.loadMedia(new chrome.cast.media.LoadRequest(media));
}

export function castSetVolume(level) {
  const s = session();
  if (s) s.setVolume(Math.max(0, Math.min(1, level)));
}

export function castStop() {
  const media = session()?.getMediaSession();
  if (media) media.stop(new chrome.cast.media.StopRequest(), () => {}, () => {});
}

export function castDeviceName() {
  return session()?.getCastDevice()?.friendlyName || "";
}
