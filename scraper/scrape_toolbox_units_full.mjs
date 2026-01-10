// scraper/scrape_toolbox_items_from_ws.mjs
// Toolbox-only: capture Viewer WS + HTTP JSON and extract a large items dataset.
// Never hard-fails if dataset is missing: writes [] and debug dumps.

import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { decode as msgpackDecode } from "@msgpack/msgpack";
import { chromium } from "playwright";

const BASE = "https://evertaletoolbox2.runasp.net";
const VIEWER_URL = `${BASE}/Viewer`;

const OUT_DIR = path.join(process.cwd(), "data");
const OUT_ITEMS = path.join(OUT_DIR, "toolbox.items.json");

const DBG_WS_FRAMES = path.join(OUT_DIR, "_debug_toolbox_ws_frames.json");
const DBG_WS_DECODED = path.join(OUT_DIR, "_debug_toolbox_ws_decoded.json");
const DBG_HTTP_JSON = path.join(OUT_DIR, "_debug_toolbox_http_json.json");

function nowIso() {
  return new Date().toISOString();
}

function decodeBase64ToU8(b64) {
  const buf = Buffer.from(b64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

// SignalR binary framing: length-prefixed messages using 7-bit varint.
// https://learn.microsoft.com/aspnet/core/signalr/messagepackhubprotocol
function tryParseVarint(u8, offset) {
  let num = 0;
  let shift = 0;
  let i = offset;
  while (i < u8.length) {
    const b = u8[i];
    num |= (b & 0x7f) << shift;
    i++;
    if ((b & 0x80) === 0) return { value: num, next: i };
    shift += 7;
    if (shift > 35) break;
  }
  return null;
}

function extractSignalRMessages(u8) {
  // returns list of Uint8Array msg bodies (msgpack bytes)
  const out = [];
  let i = 0;
  while (i < u8.length) {
    const v = tryParseVarint(u8, i);
    if (!v) break;
    const len = v.value;
    const start = v.next;
    const end = start + len;
    if (len <= 0 || end > u8.length) break;
    out.push(u8.slice(start, end));
    i = end;
  }
  return out;
}

function looksLikeItemObject(obj) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  // Keep loose: toolbox could have Id/Name/Image/Element/Type/etc.
  const hasId = keys.includes("id") || keys.includes("unitid") || keys.includes("uid");
  const hasName = keys.includes("name") || keys.includes("unitname") || keys.includes("title");
  const hasImg = keys.includes("image") || keys.includes("img") || keys.includes("icon");
  return (hasId && hasName) || (hasName && hasImg) || (hasId && hasImg);
}

function findLargestArrayCandidate(anyVal) {
  // Walk decoded structures and return the best candidate array of objects.
  let best = { count: 0, arr: null, path: "" };

  const seen = new Set();
  function walk(v, p) {
    if (!v) return;
    if (typeof v === "object") {
      if (seen.has(v)) return;
      seen.add(v);
    }

    if (Array.isArray(v)) {
      // Candidate if mostly objects and somewhat item-like
      if (v.length > best.count) {
        const objCount = v.filter(x => x && typeof x === "object" && !Array.isArray(x)).length;
        if (objCount >= Math.min(10, Math.floor(v.length * 0.5))) {
          // Try item-like sampling
          const sample = v.slice(0, 20);
          const itemish = sample.filter(looksLikeItemObject).length;
          if (itemish >= Math.min(3, sample.length)) {
            best = { count: v.length, arr: v, path: p };
          }
        }
      }
      // Walk elements lightly
      for (let i = 0; i < Math.min(v.length, 50); i++) walk(v[i], `${p}[${i}]`);
      return;
    }

    if (typeof v === "object") {
      for (const [k, vv] of Object.entries(v)) {
        walk(vv, p ? `${p}.${k}` : k);
      }
    }
  }

  walk(anyVal, "");
  return best;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const wsFrames = [];
  const httpJson = [];

  console.log(`Loading Toolbox page: ${VIEWER_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture HTTP JSON responses
  page.on("response", async (res) => {
    try {
      const ct = (res.headers()["content-type"] || "").toLowerCase();
      if (!ct.includes("application/json")) return;
      const url = res.url();
      const status = res.status();
      const text = await res.text();
      httpJson.push({ url, status, contentType: ct, body: text.slice(0, 2_000_000) });
    } catch {
      // ignore
    }
  });

  // Capture WS frames
  page.on("websocket", (ws) => {
    const wsUrl = ws.url();
    ws.on("framereceived", (frame) => {
      // frame.payload can be string or Buffer depending on Playwright version
      const isString = typeof frame.payload === "string";
      const payloadB64 = isString
        ? Buffer.from(frame.payload, "utf8").toString("base64")
        : Buffer.from(frame.payload).toString("base64");
      wsFrames.push({
        dir: "in",
        wsUrl,
        isString,
        len: isString ? frame.payload.length : frame.payload.byteLength,
        payloadB64,
      });
    });
    ws.on("framesent", (frame) => {
      const isString = typeof frame.payload === "string";
      const payloadB64 = isString
        ? Buffer.from(frame.payload, "utf8").toString("base64")
        : Buffer.from(frame.payload).toString("base64");
      wsFrames.push({
        dir: "out",
        wsUrl,
        isString,
        len: isString ? frame.payload.length : frame.payload.byteLength,
        payloadB64,
      });
    });
  });

  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });

  // Give the app time to connect and stream data
  await page.waitForTimeout(20_000);

  await browser.close();

  // Write raw debug captures
  await fs.writeFile(DBG_WS_FRAMES, JSON.stringify({
    generatedAt: nowIso(),
    viewerUrl: VIEWER_URL,
    frameCount: wsFrames.length,
    frames: wsFrames.slice(0, 500), // cap
  }, null, 2), "utf8");

  await fs.writeFile(DBG_HTTP_JSON, JSON.stringify({
    generatedAt: nowIso(),
    viewerUrl: VIEWER_URL,
    responses: httpJson.map(r => ({
      url: r.url,
      status: r.status,
      contentType: r.contentType,
      bodyPreview: r.body.slice(0, 5000),
    })),
  }, null, 2), "utf8");

  // Decode WS frames
  const decoded = [];
  let bestCandidate = { count: 0, arr: null, path: "", source: "" };

  for (let idx = 0; idx < wsFrames.length; idx++) {
    const f = wsFrames[idx];
    try {
      if (f.isString) {
        const s = Buffer.from(f.payloadB64, "base64").toString("utf8");
        // Sometimes JSON is embedded in text frames
        decoded.push({ idx, dir: f.dir, wsUrl: f.wsUrl, kind: "text", sample: s.slice(0, 500) });

        // naive JSON scan
        if (s.includes("{") && s.includes("}")) {
          const m = s.match(/\{[\s\S]*\}/);
          if (m) {
            try {
              const obj = JSON.parse(m[0]);
              const cand = findLargestArrayCandidate(obj);
              if (cand.count > bestCandidate.count) {
                bestCandidate = { ...cand, source: `ws-text[idx=${idx}]` };
              }
            } catch {
              // ignore
            }
          }
        }
        continue;
      }

      const u8 = decodeBase64ToU8(f.payloadB64);

      // SignalR messagepack: length-prefixed msgpack messages
      const msgs = extractSignalRMessages(u8);
      if (msgs.length === 0) {
        // Try decode whole buffer as msgpack anyway
        try {
          const obj = msgpackDecode(u8);
          decoded.push({ idx, dir: f.dir, wsUrl: f.wsUrl, kind: "msgpack-whole", summaryType: typeof obj });
          const cand = findLargestArrayCandidate(obj);
          if (cand.count > bestCandidate.count) {
            bestCandidate = { ...cand, source: `ws-msgpack-whole[idx=${idx}]` };
          }
        } catch {
          decoded.push({ idx, dir: f.dir, wsUrl: f.wsUrl, kind: "binary-unknown", bytes: u8.length });
        }
        continue;
      }

      for (let mi = 0; mi < msgs.length; mi++) {
        try {
          const obj = msgpackDecode(msgs[mi]);
          decoded.push({
            idx,
            dir: f.dir,
            wsUrl: f.wsUrl,
            kind: "signalr-msgpack",
            msgIndex: mi,
            type: Array.isArray(obj) ? "array" : typeof obj,
          });

          const cand = findLargestArrayCandidate(obj);
          if (cand.count > bestCandidate.count) {
            bestCandidate = { ...cand, source: `signalr-msgpack[idx=${idx},msg=${mi}]` };
          }
        } catch {
          // ignore individual decode errors
        }
      }
    } catch {
      // ignore frame errors
    }
  }

  await fs.writeFile(DBG_WS_DECODED, JSON.stringify({
    generatedAt: nowIso(),
    viewerUrl: VIEWER_URL,
    decodedCount: decoded.length,
    bestCandidate: {
      source: bestCandidate.source,
      count: bestCandidate.count,
      path: bestCandidate.path,
    },
    decodedSample: decoded.slice(0, 300),
  }, null, 2), "utf8");

  // Write toolbox.items.json (array or [])
  if (bestCandidate.arr && Array.isArray(bestCandidate.arr) && bestCandidate.count > 0) {
    await fs.writeFile(OUT_ITEMS, JSON.stringify(bestCandidate.arr, null, 2), "utf8");
    console.log(`[scrape_toolbox_items_from_ws] wrote ${bestCandidate.count} items -> ${OUT_ITEMS} (from ${bestCandidate.source}, path=${bestCandidate.path})`);
  } else {
    // Do NOT fail; normalize step should skip and keep last good catalog.
    await fs.writeFile(OUT_ITEMS, "[]\n", "utf8");
    console.warn(`[scrape_toolbox_items_from_ws] No items dataset found in WS. Wrote empty [] to ${OUT_ITEMS}. Check debug: ${DBG_WS_FRAMES}, ${DBG_WS_DECODED}, ${DBG_HTTP_JSON}`);
  }
}

run().catch(async (e) => {
  console.error(e);
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
    if (!fssync.existsSync(OUT_ITEMS)) {
      await fs.writeFile(OUT_ITEMS, "[]\n", "utf8");
    }
  } catch {}
  process.exit(1);
});