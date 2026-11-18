// Kleiner Wrapper um localStorage – wirft nie (privater Modus, Speicher voll …).
const PREFIX = "music-browser:";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignorieren */
  }
}

export const DEFAULT_SETTINGS = {
  weatherLocation: "Falkensee",
  theme: "dark", // "dark" | "light"
};

export function loadSettings() {
  const stored = load("settings", {});
  return {
    weatherLocation: stored.weatherLocation || DEFAULT_SETTINGS.weatherLocation,
    theme: stored.theme === "light" ? "light" : "dark",
  };
}

export function saveSettings(settings) {
  save("settings", settings);
}
