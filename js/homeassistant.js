// Home Assistant als Ausgabe: spielt die Stream-URL auf einem media_player
// (Sonos, Denon/HEOS, Echo, Chromecast, DLNA …) über die REST-API.
//
// Voraussetzungen in configuration.yaml:
//   http:
//     cors_allowed_origins:
//       - https://tbr-brd.github.io
// und Home Assistant per https erreichbar (z. B. Nabu Casa), sonst blockiert
// Chrome die Anfragen von der https-Seite (Mixed Content).

function base(settings) {
  return settings.haUrl.replace(/\/+$/, "");
}

async function call(settings, path, { method = "GET", body } = {}) {
  const response = await fetch(`${base(settings)}/api/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${settings.haToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Home Assistant: HTTP ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function haConfigured(settings) {
  return Boolean(settings.haUrl && settings.haToken);
}

export async function haListPlayers(settings) {
  const states = await call(settings, "states");
  return states
    .filter((s) => s.entity_id.startsWith("media_player."))
    .filter((s) => s.state !== "unavailable")
    .map((s) => ({ id: s.entity_id, name: s.attributes.friendly_name || s.entity_id }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export async function haPlay(settings, entityId, url) {
  await call(settings, "services/media_player/play_media", {
    method: "POST",
    body: { entity_id: entityId, media_content_id: url, media_content_type: "music" },
  });
}

export async function haStop(settings, entityId) {
  await call(settings, "services/media_player/media_stop", {
    method: "POST",
    body: { entity_id: entityId },
  });
}

export async function haVolume(settings, entityId, level) {
  await call(settings, "services/media_player/volume_set", {
    method: "POST",
    body: { entity_id: entityId, volume_level: Math.max(0, Math.min(1, level)) },
  });
}
