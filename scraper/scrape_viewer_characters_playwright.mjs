// scraper/scrape_viewer_characters_playwright.mjs
// Capture Viewer data from HTTP + SignalR WebSocket frames (Blazor Server).
//
// Outputs:
//   data/viewer.raw.responses.json    (HTTP response summaries)
//   data/viewer.raw.ws.json           (WS frame summaries + samples)
//   data/viewer.toolbox.full.json     (normalized items if large payload found)
// Debug:
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const htmlPath = path.join(outDir, "_debug_viewer_rendered.html");
  const pngPath = path.join(outDir, "_debug_viewer_screenshot.png");

  try {
    const html = await page.content();
    await fs.writeFile(htmlPath, html, "utf8");
    console.log(`Saved debug HTML: ${htmlPath}`);
  } catch {}

  try {
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`Saved debug screenshot: ${pngPath}`);
  } catch {}
}

function scoreList(obj) {
  if (!obj) return { score: 0, count: 0, shape: "none" };
  if (Array.isArray(obj)) return { score: obj.length, count: obj.length, shape: "array" };
  if (typeof obj === "object") {
    const keys = ["items", "data", "results", "records", "rows", "value"];
    for (const k of keys) {
      if (Array.isArray(obj[k])) return { score: obj[k].length, count: obj[k].length, shape: `obj.${k}` };
    }
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) return { score: v.length * 0.9, count: v.length, shape: `obj.${k}` };
    }
  }
  return { score: 0, count: 0, shape: "object" };
}

function extractList(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  const keys = ["items", "data", "results", "records", "rows", "value"];
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k];
  if (typeof obj === "object") for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
  return [];
}

function normalizeRecord(r) {
  if (!r) return null;

  if (typeof r === "string") {
    const name = normText(r);
    return name ? { id: name, name, type: null, element: null, raw: r } : null;
  }

  if (typeof r !== "object") return null;

  const lower = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));

  const name =
    lower.name ??
    lower.unitname ??
    lower.displayname ??
    lower.title ??
    lower.charactername ??
    null;

  if (!name) return null;

  const id = lower.id ?? lower.unitid ?? lower.uid ?? name;
  const type = lower.type ?? lower.category ?? lower.kind ?? lower.group ?? null;
  const element = lower.element ?? lower.attr ?? lower.attribute ?? null;

  return {
    id: String(id),
    name: String(name),
    type: type ? String(type) : null,
    element: element ? String(element) : null,
    raw: r,
  };
}

// SignalR JSON protocol: messages often separated by ASCII 0x1E (record separator)
function splitSignalRFrames(text) {
  return text
    .split("\u001e")
    .map(s => s.trim())
    .filter(Boolean);
}

function tryParseJson(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, err: e?.message || String(e) };
  }
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const page = await browser.newPage({
    viewport: { width: 1500, height: 950 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  page.setDefaultTimeout(120000);

  // ---- HTTP capture ----
  const httpCaptures = [];
  const MAX_HTTP = 120;

  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.includes(DOMAIN_HINT)) return;
      if (httpCaptures.length >= MAX_HTTP) return;

      const status = resp.status();
      const ct = (resp.headers()["content-type"] || "").toLowerCase();

      // store summary; only read body for 2xx
      if (status < 200 || status >= 300) {
        httpCaptures.push({ url, status, contentType: ct, note: "non-2xx" });
        return;
      }

      const buf = await resp.body().catch(() => null);
      const size = buf ? buf.length : 0;

      // decode up to 200KB for sniffing
      const sampleBuf = buf ? buf.subarray(0, Math.min(size, 200000)) : null;
      const text = sampleBuf ? sampleBuf.toString("utf8") : "";

      let parseOk = false;
      let count = 0;
      let score = 0;
      let shape = "unparsed";
      let parseErr = null;

      const looksJson = /^\s*[{[]/.test(text);
      if (looksJson || ct.includes("json")) {
        const p = tryParseJson(text);
        if (p.ok) {
          parseOk = true;
          const sc = scoreList(p.value);
          count = sc.count;
          score = sc.score;
          shape = sc.shape;
        } else {
          parseErr = p.err;
        }
      }

      httpCaptures.push({
        url,
        status,
        contentType: ct,
        size,
        looksJson,
        parseOk,
        parseErr,
        shape,
        count,
        score,
        sampleHead: text.slice(0, 1200),
      });
    } catch {}
  });

  // ---- WebSocket capture ----
  const wsCaptures = [];
  const MAX_WS_FRAMES = 400;

  page.on("websocket", (ws) => {
    const wsUrl = ws.url();

    const pushFrame = (direction, payload) => {
      try {
        if (wsCaptures.length >= MAX_WS_FRAMES) return;

        const text =
          typeof payload === "string"
            ? payload
            : Buffer.isBuffer(payload)
            ? payload.toString("utf8")
            : String(payload);

        // SignalR messages may contain multiple JSON messages separated by RS
        const parts = splitSignalRFrames(text);

        // parse any JSON parts
        let best = { score: 0, count: 0, shape: "none" };
        let anyParsed = false;

        for (const part of parts) {
          const p = tryParseJson(part);
          if (!p.ok) continue;
          anyParsed = true;

          // SignalR invocation often looks like { type:1, target:"...", arguments:[...] }
          // We check the whole object and also arguments[] for big arrays.
          const sc1 = scoreList(p.value);
          if (sc1.score > best.score) best = sc1;

          if (p.value && typeof p.value === "object" && Array.isArray(p.value.arguments)) {
            for (const arg of p.value.arguments) {
              const sc2 = scoreList(arg);
              if (sc2.score > best.score) best = sc2;
              // also 1-level deep arrays inside arg
              if (arg && typeof arg === "object") {
                for (const v of Object.values(arg)) {
                  const sc3 = scoreList(v);
                  if (sc3.score > best.score) best = sc3;
                }
              }
            }
          }
        }

        wsCaptures.push({
          wsUrl,
          direction,
          length: text.length,
          parts: parts.length,
          anyParsed,
          best,
          sampleHead: text.slice(0, 1200),
        });
      } catch {}
    };

    ws.on("framereceived", (evt) => pushFrame("recv", evt.payload));
    ws.on("framesent", (evt) => pushFrame("sent", evt.payload));
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let SignalR connect and deliver data
  await page.waitForTimeout(12000);

  // Trigger UI activity (helps cause invocations)
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(700);
  }

  await page.waitForTimeout(4000);

  await saveDebug(page);
  await browser.close();

  // Write raw logs
  const httpPath = path.join(outDir, "viewer.raw.responses.json");
  const wsPath = path.join(outDir, "viewer.raw.ws.json");

  await fs.writeFile(httpPath, JSON.stringify({ scrapedAt: new Date().toISOString(), captures: httpCaptures }, null, 2), "utf8");
  await fs.writeFile(wsPath, JSON.stringify({ scrapedAt: new Date().toISOString(), frames: wsCaptures }, null, 2), "utf8");

  console.log(`Wrote HTTP capture log -> ${httpPath} (captures=${httpCaptures.length})`);
  console.log(`Wrote WS capture log   -> ${wsPath} (frames=${wsCaptures.length})`);

  // Pick best WS frame by best.score
  const bestWs = [...wsCaptures]
    .filter(f => f.anyParsed)
    .sort((a, b) => (b.best?.score || 0) - (a.best?.score || 0))[0];

  // If WS isn't giving us big arrays, fall back to best HTTP parsed
  const bestHttp = [...httpCaptures]
    .filter(c => c.parseOk)
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  const bestScore = Math.max(bestWs?.best?.score || 0, bestHttp?.score || 0);

  if (bestScore < 50) {
    throw new Error(
      "Still no large list found in HTTP or WebSocket frames. Open data/viewer.raw.ws.json and data/viewer.raw.responses.json and look for entries with the biggest 'best.score' or large 'length/size'."
    );
  }

  // We can’t “refetch” WS frames, but we *can* at least surface that there IS a big frame.
  // Next step (once we confirm which SignalR target/arguments contains the list) is to parse and normalize those arguments.
  // For now we create a placeholder toolbox.full with the best frame metadata so pipeline continues.
  const outPath = path.join(outDir, "viewer.toolbox.full.json");

  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        source: VIEWER_URL,
        scrapedAt: new Date().toISOString(),
        note: "This file will be filled with normalized items once we identify the correct SignalR invocation argument containing the full dataset.",
        bestWS: bestWs || null,
        bestHTTP: bestHttp || null,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote placeholder dataset (needs WS argument extraction) -> ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});