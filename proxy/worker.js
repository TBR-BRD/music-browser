// music-browser – Metadaten-Proxy als Cloudflare Worker (kostenloser Plan reicht).
//
// Endpunkte (nur GET):
//   /icy?url=<stream>   liest den ICY-StreamTitle aus einem Radiostream (m3u/pls werden aufgelöst)
//   /raw?url=<url>      holt kleine Text-/JSON-Dateien (ON-Radio-JSON, m3u, pls) und setzt CORS
//
// Variablen (optional, Settings → Variables and Secrets):
//   ALLOWED_ORIGINS  kommagetrennt, z. B. "https://tbr-brd.github.io,https://music.lets-make.de"
//   Ohne Variable ist nur https://tbr-brd.github.io erlaubt.

const RAW_LIMIT = 256 * 1024;      // max. Bytes für /raw
const ICY_MAX_BLOCKS = 3;          // max. Metadatenblöcke, die gelesen werden
const ICY_TIMEOUT_MS = 9000;
const UA = "music-browser-proxy/1.0 (+https://github.com/TBR-BRD/music-browser)";

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "https://tbr-brd.github.io")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const originOk = allowed.includes("*") || allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? (origin || "*") : allowed[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, cors);

    const url = new URL(request.url);
    // Testseite: https://<worker>.workers.dev/ im Browser öffnen
    if (url.pathname === "/") {
      return json({ ok: true, service: "music-browser-proxy", endpoints: ["/icy?url=", "/raw?url="], allowedOrigins: allowed }, 200, cors);
    }
    if (!originOk) return json({ error: "origin not allowed" }, 403, cors);

    let target;
    try {
      target = validateTarget(url.searchParams.get("url"));
    } catch (error) {
      return json({ error: error.message }, 400, cors);
    }

    try {
      if (url.pathname === "/raw") return await handleRaw(target, cors);
      if (url.pathname === "/icy") return await handleIcy(target, cors);
      return json({ error: "unknown endpoint", endpoints: ["/icy?url=", "/raw?url="] }, 404, cors);
    } catch (error) {
      return json({ error: String(error.message || error) }, 502, cors);
    }
  },
};

function json(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors, ...extra },
  });
}

function validateTarget(value) {
  if (!value) throw new Error("parameter url fehlt");
  const target = new URL(value);
  if (!/^https?:$/.test(target.protocol)) throw new Error("nur http/https erlaubt");
  const host = target.hostname.toLowerCase();
  const isIp = /^[\d.]+$/.test(host) || host.includes(":");
  if (isIp || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    throw new Error("Ziel nicht erlaubt");
  }
  return target;
}

async function readLimited(response, limit) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error("Antwort zu groß"); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function handleRaw(target, cors) {
  const response = await fetch(target, { headers: { "User-Agent": UA }, redirect: "follow" });
  const type = response.headers.get("Content-Type") || "text/plain";
  if (/^audio\/(mpeg|aac|ogg)|^application\/ogg/i.test(type)) throw new Error("Audiostream – bitte /icy verwenden");
  const body = await readLimited(response, RAW_LIMIT);
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=10", ...cors },
  });
}

function parsePlaylist(text) {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const pls = line.match(/^File\d+=(.+)$/i);
    const candidate = pls ? pls[1].trim() : line;
    if (/^https?:\/\//i.test(candidate)) return candidate;
  }
  return null;
}

function decodeMeta(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b); // Latin-1
    return s;
  }
}

function extractTitle(bytes) {
  const text = decodeMeta(bytes).replace(/\0+$/, "");
  const match = text.match(/StreamTitle=['"](.*?)['"];/i);
  return match ? match[1].trim() : "";
}

async function handleIcy(target, cors) {
  // m3u/pls zuerst auflösen
  if (/\.(m3u|pls)(\?|$)/i.test(target.pathname + target.search)) {
    const list = await fetch(target, { headers: { "User-Agent": UA } });
    const resolved = parsePlaylist(new TextDecoder().decode(await readLimited(list, RAW_LIMIT)));
    if (!resolved) throw new Error("Playlist ohne Stream-URL");
    target = validateTarget(resolved);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ICY_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      headers: { "Icy-MetaData": "1", "User-Agent": UA, Accept: "*/*" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const metaint = parseInt(response.headers.get("icy-metaint") || "0", 10);
    const base = {
      icyName: response.headers.get("icy-name") || null,
      streamUrl: response.url || target.toString(),
    };
    if (!metaint || metaint > 1048576) {
      await response.body?.cancel();
      return json({ ...base, streamTitle: null, note: "kein icy-metaint" }, 200, cors, { "Cache-Control": "public, max-age=30" });
    }

    const reader = response.body.getReader();
    let phase = "audio", remaining = metaint, meta = null, metaPos = 0, blocks = 0;
    while (blocks < ICY_MAX_BLOCKS) {
      const { done, value } = await reader.read();
      if (done) break;
      let i = 0;
      while (i < value.length && blocks < ICY_MAX_BLOCKS) {
        if (phase === "audio") {
          const n = Math.min(remaining, value.length - i);
          i += n; remaining -= n;
          if (remaining === 0) phase = "len";
        } else if (phase === "len") {
          const len = value[i++] * 16;
          if (len === 0) { blocks++; phase = "audio"; remaining = metaint; }
          else { meta = new Uint8Array(len); metaPos = 0; phase = "meta"; }
        } else {
          const n = Math.min(meta.length - metaPos, value.length - i);
          meta.set(value.subarray(i, i + n), metaPos);
          metaPos += n; i += n;
          if (metaPos === meta.length) {
            blocks++;
            const title = extractTitle(meta);
            if (title) {
              await reader.cancel();
              return json({ ...base, streamTitle: title }, 200, cors, { "Cache-Control": "public, max-age=10" });
            }
            phase = "audio"; remaining = metaint;
          }
        }
      }
    }
    await reader.cancel();
    return json({ ...base, streamTitle: null }, 200, cors, { "Cache-Control": "public, max-age=10" });
  } finally {
    clearTimeout(timer);
  }
}
