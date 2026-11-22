// Wetter über Open-Meteo (kein Schlüssel, CORS erlaubt).
// Darstellung und Symbole wie im Projekt onradio-cover-bridge:
// Kopf (Ort + Symbol), „Aktuell“ mit Luftdruck und Tendenz, Karten „Heute“ und „Morgen“.

const CODES = {
  0: ["Sonnig", "sunny"], 1: ["Meist klar", "mostly-clear"], 2: ["Teilweise bewölkt", "partly-cloudy"],
  3: ["Bewölkt", "cloudy"], 45: ["Nebel", "fog"], 48: ["Raureifnebel", "fog"],
  51: ["Leichter Nieselregen", "drizzle"], 53: ["Nieselregen", "drizzle"], 55: ["Starker Nieselregen", "rain"],
  56: ["Leichter gefrierender Nieselregen", "freezing"], 57: ["Gefrierender Nieselregen", "freezing"],
  61: ["Leichter Regen", "drizzle"], 63: ["Regen", "rain"], 65: ["Starker Regen", "rain"],
  66: ["Leichter gefrierender Regen", "freezing"], 67: ["Gefrierender Regen", "freezing"],
  71: ["Leichter Schneefall", "snow"], 73: ["Schneefall", "snow"], 75: ["Starker Schneefall", "snow"],
  77: ["Schneegriesel", "snow"], 80: ["Leichte Schauer", "drizzle"], 81: ["Schauer", "rain"],
  82: ["Starke Schauer", "rain"], 85: ["Leichte Schneeschauer", "snow"], 86: ["Schneeschauer", "snow"],
  95: ["Gewitter", "thunder"], 96: ["Gewitter mit Hagel", "thunder"], 99: ["Starkes Gewitter", "thunder"],
};
const PRESSURE_TREND_DELTA_HPA = 1;
const TRENDS = {
  up: ["↑", "Luftdruck steigend"],
  down: ["↓", "Luftdruck fallend"],
  steady: ["→", "Luftdruck stabil"],
};

let geoCache = null;

function describe(code) {
  const [label, icon] = CODES[code] || ["Wetter", "unknown"];
  return { label, icon: `assets/weather-icons/${icon}.svg` };
}

const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const temp = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "--°" : `${Math.round(Number(v))}°`);

async function geocode(name) {
  if (geoCache?.query === name) return geoCache.result;
  const params = new URLSearchParams({ name, count: "1", format: "json", language: "de" });
  const data = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)).json();
  const hit = data.results?.[0];
  if (!hit) throw new Error(`Ort „${name}“ nicht gefunden`);
  const result = { name: hit.name, latitude: hit.latitude, longitude: hit.longitude };
  geoCache = { query: name, result };
  return result;
}

function pressureTrend(data) {
  // Vergleich mit dem Luftdruck vor drei Stunden (Open-Meteo hourly)
  const times = data.hourly?.time || [];
  const values = data.hourly?.surface_pressure || [];
  const nowKey = data.current?.time?.slice(0, 13);
  const i = times.findIndex((t) => t.slice(0, 13) === nowKey);
  if (i < 3 || values[i] == null || values[i - 3] == null) return null;
  const delta = Math.round(values[i]) - Math.round(values[i - 3]);
  if (delta >= PRESSURE_TREND_DELTA_HPA) return "up";
  if (delta <= -PRESSURE_TREND_DELTA_HPA) return "down";
  return "steady";
}

export async function fetchWeather(locationName) {
  const place = await geocode(locationName || "Falkensee");
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,surface_pressure,weather_code",
    hourly: "surface_pressure",
    past_hours: "4",
    forecast_hours: "1",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "2",
  });
  const data = await (await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)).json();
  if (data.error) throw new Error(data.reason || "Wetterdienst nicht erreichbar");
  return { place, data, trend: pressureTrend(data) };
}

export function renderWeather(container, { place, data, trend }) {
  const c = data.current || {};
  const now = describe(c.weather_code);
  const d = data.daily || {};
  const days = (d.time || []).slice(0, 2).map((_, i) => {
    const info = describe(d.weather_code[i]);
    const rain = d.precipitation_probability_max?.[i];
    return `<div class="wx-day">
      <div class="wx-day-top">
        <span class="wx-day-label">${i === 0 ? "Heute" : "Morgen"}</span>
        <img class="wx-icon wx-day-icon" src="${info.icon}" alt="${esc(info.label)}">
      </div>
      <p class="wx-day-condition">${esc(info.label)}</p>
      <p class="wx-day-temp">${temp(d.temperature_2m_max[i])} / ${temp(d.temperature_2m_min[i])}</p>
      <p class="wx-day-rain">Niederschlag: ${rain == null ? "-" : `${Math.round(rain)}%`}</p>
    </div>`;
  }).join("");
  const [trendSymbol, trendLabel] = TRENDS[trend] || ["", ""];
  const pressure = c.surface_pressure == null ? "-" : `${Math.round(c.surface_pressure)} hPa`;

  container.innerHTML = `
    <div class="wx-head">
      <div>
        <p class="wx-eyebrow">Wetter</p>
        <p class="wx-location">${esc(place.name)}</p>
      </div>
      <img class="wx-icon wx-head-icon" src="${now.icon}" alt="${esc(now.label)}">
    </div>
    <div class="wx-current">
      <div>
        <p class="wx-label">Aktuell</p>
        <p class="wx-temp">${temp(c.temperature_2m)}</p>
      </div>
      <div class="wx-current-side">
        <p class="wx-condition">${esc(now.label)}</p>
        <p class="wx-pressure">Luftdruck ${pressure}${trendSymbol
          ? ` <span class="wx-trend is-${trend}" title="${trendLabel}" aria-label="${trendLabel}">${trendSymbol}</span>` : ""}</p>
      </div>
    </div>
    <div class="wx-days">${days}</div>`;
}

/** Kompakte Wetterzeile für den Display-Modus: jetzt + Heute + Morgen. */
export function renderWeatherCompact(container, { place, data }) {
  const c = data.current || {};
  const now = describe(c.weather_code);
  const d = data.daily || {};
  const day = (i, label) => {
    if (!d.time?.[i]) return "";
    const info = describe(d.weather_code[i]);
    return `<div class="dmw-day"><img class="wx-icon" src="${info.icon}" alt="${esc(info.label)}">
      <span>${label}</span><b>${temp(d.temperature_2m_max[i])} / ${temp(d.temperature_2m_min[i])}</b></div>`;
  };
  container.innerHTML = `
    <div class="dmw-now"><img class="wx-icon" src="${now.icon}" alt="${esc(now.label)}">
      <b>${temp(c.temperature_2m)}</b><span>${esc(now.label)} · ${esc(place.name)}</span></div>
    ${day(0, "Heute")}${day(1, "Morgen")}`;
}
