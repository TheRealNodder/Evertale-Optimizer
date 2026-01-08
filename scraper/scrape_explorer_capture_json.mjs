// scraper/scrape_explorer_capture_json.mjs
// Explorer capture (HTTP + WS) for Blazor/SignalR apps.
// Writes debug files even when we can't find a clean dataset yet.
//
// Outputs (always):
//   data/explorer.http.captures.json
//   data/explorer.ws.frames.json
//   data/_debug_explorer_rendered.html
//   data/_debug_explorer_screenshot.png
//
// Output (only if we find a dataset):
//   data/toolbox.items.json
//
// Control:
//   STRICT=1  -> exit 1 if no dataset found
//   STRICT=0  -> exit 0 (default) so workflow can upload artifacts

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

const OUT_HTTP = "data/explorer.http.captures.json";
const OUT_WS = "data/explorer.ws.frames.json";
const OUT_ITEMS = "data/toolbox.items.json";

function nowIso() { return new Date().toISOString(); }

async function ensureDataDir() {
  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  try {
    await fs.writeFile(path.join(outDir, "_debug_explorer_rendered.html"), await page.content(), "utf8");
  } catch {}
  try {
    await page.screenshot({ path: path.join(outDir, "_debug_explorer_screenshot.png"), fullPage: true });
  } catch {}
}

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function toAbsUrl(u) {
  if (!u) return null;
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return BASE + s;
  return s;
}

function isProbablyItem(obj) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hasName = keys.includes("name") || keys.includes("title") || keys.includes("displayname");
  const hasType = keys.includes("type") || keys.includes("category") || keys.includes("kind");
  const hasImg = keys.some(k => k.includes("image") || k.includes("icon") || k.includes("portrait"));
  const hasStats = keys.includes("atk") || keys.includes("hp") || keys.includes("spd") || keys.includes("cost") || keys.includes("element");
  return hasName && (hasType || hasImg || hasStats);
}

function findBigArrays(x, minLen = 50) {
  const res = [];
  const seen = new Set();

  function walk(v, p) {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);

    if (Array.isArray(v)) {
      if (v.length >= minLen) {
        const sample = v.slice(0, 200);
        const good = sample.filter(isProbablyItem).length;
        const score = good / Math.max(1, sample.length);
        res.push({ path: p, length: v.length, score, arr: v });
      }
      for (let i = 0; i < Math.min(20, v.length); i++) walk(v[i], `${p}[${i}]`);
      return;
    }

    for (const [k, vv] of Object.entries(v)) {
      walk(vv, p ? `${p}.${k}` : k);
    }
  }

  walk(x, "");
  res.sort((a, b) => (b.score - a.score) || (b.length - a.length));
  return res;
}

function normalizeItem(obj) {
  if (!obj || typeof obj !== "object") return null;
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

  const name = lower.name ?? lower.displayname ?? lower.title ?? null;
  if (!name) return null;

  const id = String(lower.id ?? lower.uid ?? lower.key ?? lower.unitid ?? name);

  const category =
    (lower.category ?? lower.type ?? lower.kind ?? "")
      .toString()
      .toLowerCase()
      .trim() || "unknown";

  const image =
    lower.image ?? lower.imageurl ?? lower.icon ?? lower.iconurl ?? lower.portrait ?? lower.portraiturl ?? null;

  return {
    id: norm(id),
    name: norm(name),
    category,
    element: lower.element ?? null,
    cost: lower.cost ?? null,
    atk: lower.atk ?? lower.attack ?? null,
    hp: lower.hp ?? lower.health ?? null,
    spd: lower.spd ?? lower.speed ?? null,
    image: image ? toAbsUrl(image) : null,
    url: EXPLORER_URL,
  };
}

async function run() {
  await ensureDataDir();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  // --- Capture WS frames too (Explorer may still use SignalR)
  const wsFrames = [];
  page.on("websocket", (ws) => {
    ws.on("framereceived", (evt) => {
      const payload = evt.payload;
      if (typeof payload === "string") {
        wsFrames.push({ dir: "recv", ws: ws.url(), type: "text", len: payload.length, head: payload.slice(0, 1600) });
      } else if (Buffer.isBuffer(payload)) {
        wsFrames.push({ dir: "recv", ws: ws.url(), type: "binary", len: payload.length, base64: payload.toString("base64") });
      }
    });
    ws.on("framesent", (evt) => {
      const payload = evt.payload;
      if (typeof payload === "string") {
        wsFrames.push({ dir: "sent", ws: ws.url(), type: "text", len: payload.length, head: payload.slice(0, 1600) });
      } else if (Buffer.isBuffer(payload)) {
        wsFrames.push({ dir: "sent", ws: ws.url(), type: "binary", len: payload.length, base64: payload.toString("base64") });
      }
    });
  });

  // --- Capture HTTP responses (NOT only JSON)
  const httpCaps = [];
  const inMemoryBodies = []; // keep parsed bodies for picking best array

  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.startsWith(BASE)) return;

      const headers = resp.headers();
      const ct = (headers["content-type"] || "").toLowerCase();
      const status = resp.status();

      // Only store “interesting” types (but broader than JSON)
      const interesting =
        ct.includes("application/json") ||
        ct.includes("text/plain") ||
        ct.includes("application/octet-stream") ||
        ct.includes("application/x-msgpack") ||
        ct.includes("application/msgpack");

      if (!interesting) return;

      const buf = await resp.body();
      const size = buf?.length ?? 0;

      // create a light preview
      let previewText = null;
      let parsedJson = null;

      // Try UTF-8 decode; if it looks like JSON, parse it
      try {
        const txt = buf.toString("utf8");
        previewText = txt.slice(0, 3000);

        const t = txt.trim();
        if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
          try { parsedJson = JSON.parse(t); } catch {}
        }
      } catch {}

      // Store capture
      httpCaps.push({
        url,
        status,
        contentType: ct,
        size,
        previewText,
        isJsonParsed: !!parsedJson,
        topKeys: parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)
          ? Object.keys(parsedJson).slice(0, 50)
          : null,
        arrayLen: Array.isArray(parsedJson) ? parsedJson.length : null,
        // store binary base64 only for medium-small (avoid giant artifacts)
        base64: (!previewText && size > 0 && size <= 2_000_000) ? buf.toString("base64") : null,
      });

      if (parsedJson) {
        inMemoryBodies.push({ url, size, parsed: parsedJson });
      }
    } catch {
      // ignore
    }
  });

  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  await page.goto(EXPLORER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let scripts connect/load
  await page.waitForTimeout(20000);

  // Try basic interactions that often trigger data loads
  // (safe: all wrapped in try/catch so it won't crash if selectors don't exist)
  const tryClicks = [
    /units?/i,
    /characters?/i,
    /weapons?/i,
    /accessories?/i,
    /enemies?/i,
    /boss/i,
    /monster/i,
  ];

  for (const re of tryClicks) {
    try {
      const loc = page.getByRole("button", { name: re });
      if (await loc.count()) {
        await loc.first().click({ timeout: 3000 });
        await page.waitForTimeout(1500);
      }
    } catch {}
    try {
      const loc = page.getByRole("link", { name: re });
      if (await loc.count()) {
        await loc.first().click({ timeout: 3000 });
        await page.waitForTimeout(1500);
      }
    } catch {}
  }

  // Scroll to trigger lazy loads
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(5000);

  await saveDebug(page);
  await browser.close();

  // Sort & write HTTP captures (top by size)
  httpCaps.sort((a, b) => (b.size - a.size));

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_HTTP),
    JSON.stringify({ scrapedAt: nowIso(), count: httpCaps.length, captures: httpCaps }, null, 2),
    "utf8"
  );

  // Sort & write WS frames (top by len)
  wsFrames.sort((a, b) => (b.len - a.len));
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_WS),
    JSON.stringify({ scrapedAt: nowIso(), count: wsFrames.length, frames: wsFrames.slice(0, 200) }, null, 2),
    "utf8"
  );

  console.log(`Wrote HTTP captures -> ${OUT_HTTP} (${httpCaps.length})`);
  console.log(`Wrote WS frames     -> ${OUT_WS} (${wsFrames.length})`);

  // Try to pick dataset from any parsed JSON bodies
  let best = null;
  for (const b of inMemoryBodies) {
    const arrays = findBigArrays(b.parsed, 50);
    if (!arrays.length) continue;
    const top = arrays[0];
    const cand = { url: b.url, size: b.size, path: top.path, length: top.length, score: top.score, arr: top.arr };
    if (!best ||
        cand.score > best.score ||
        (cand.score === best.score && cand.length > best.length) ||
        (cand.score === best.score && cand.length === best.length && cand.size > best.size)) {
      best = cand;
    }
  }

  if (!best) {
    const strict = process.env.STRICT === "1";
    console.log("No usable JSON dataset found yet (likely data is coming via WS or binary).");
    if (strict) throw new Error("No usable JSON dataset found on Explorer. See debug outputs.");
    return;
  }

  const normalized = best.arr.map(normalizeItem).filter(Boolean);
  if (normalized.length < 20) {
    const strict = process.env.STRICT === "1";
    console.log(`Candidate found but normalized too small (${normalized.length}).`);
    if (strict) throw new Error("Found dataset but could not normalize enough items.");
    return;
  }

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify({
      source: EXPLORER_URL,
      scrapedAt: nowIso(),
      picked: { url: best.url, path: best.path, length: best.length, score: best.score, size: best.size },
      count: normalized.length,
      items: normalized,
    }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${normalized.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});