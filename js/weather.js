// Wetter über Open-Meteo (kein Schlüssel, CORS erlaubt) –
// gleiche Codes wie im GoogleTV-Musicplayer (WeatherRepository.kt).

const CODES = {
  0: ["Sonnig", "☀️"], 1: ["Meist klar", "🌤️"], 2: ["Teilweise bewölkt", "⛅"], 3: ["Bewölkt", "☁️"],
  45: ["Nebel", "🌫️"], 48: ["Raureifnebel", "🌫️"],
  51: ["Leichter Nieselregen", "🌦️"], 53: ["Nieselregen", "🌦️"], 55: ["Starker Nieselregen", "🌧️"],
  56: ["Leichter gefrierender Nieselregen", "🧊"], 57: ["Gefrierender Nieselregen", "🧊"],
  61: ["Leichter Regen", "🌦️"], 63: ["Regen", "🌧️"], 65: ["Starker Regen", "🌧️"],
  66: ["Leichter gefrierender Regen", "🧊"], 67: ["Gefrierender Regen", "🧊"],
  71: ["Leichter Schneefall", "🌨️"], 73: ["Schneefall", "🌨️"], 75: ["Starker Schneefall", "❄️"], 77: ["Schneegriesel", "🌨️"],
  80: ["Leichte Schauer", "🌦️"], 81: ["Schauer", "🌧️"], 82: ["Starke Schauer", "⛈️"],
  85: ["Leichte Schneeschauer", "🌨️"], 86: ["Schneeschauer", "🌨️"],
  95: ["Gewitter", "⛈️"], 96: ["Gewitter mit Hagel", "⛈️"], 99: ["Starkes Gewitter", "⛈️"],
};

const DAY = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
let geoCache = null;

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

export async function fetchWeather(locationName) {
  const place = await geocode(locationName || "Falkensee");
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "4",
  });
  const data = await (await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)).json();
  return { place, data };
}

export function renderWeather(container, { place, data }) {
  const c = data.current;
  const [label, icon] = CODES[c.weather_code] || ["", "🌡️"];
  const days = data.daily.time.slice(1).map((date, i) => {
    const idx = i + 1;
    const [dLabel, dIcon] = CODES[data.daily.weather_code[idx]] || ["", "🌡️"];
    return `<div class="day" title="${dLabel}">
      <div class="muted small">${DAY.format(new Date(date))}</div>
      <div class="icon">${dIcon}</div>
      <div>${Math.round(data.daily.temperature_2m_max[idx])}° <span class="muted">${Math.round(data.daily.temperature_2m_min[idx])}°</span></div>
      <div class="muted small">💧 ${data.daily.precipitation_probability_max[idx] ?? 0}%</div>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="now">
      <div class="icon">${icon}</div>
      <div>
        <div class="temp">${Math.round(c.temperature_2m)}°C</div>
        <div>${label}</div>
        <div class="muted small">${place.name} · gefühlt ${Math.round(c.apparent_temperature)}° · 💨 ${Math.round(c.wind_speed_10m)} km/h · 💧 ${c.relative_humidity_2m}%</div>
      </div>
    </div>
    ${days}`;
}
