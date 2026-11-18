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
  proxyUrl: "",
  haUrl: "",
  haToken: "",
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load("settings", {}) };
}

export function saveSettings(settings) {
  save("settings", settings);
}
