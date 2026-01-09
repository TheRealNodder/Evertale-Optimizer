// scraper/scrape_toolbox_items_from_ws.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

const DATA_DIR = path.resolve("data");
const OUT_ITEMS = path.join(DATA_DIR, "toolbox.items.json");

// Debug outputs
const DEBUG_WS = path.join(DATA_DIR, "_debug_ws_frames.json");
const DEBUG_DECODE = path.join(DATA_DIR, "_debug_ws_decoded.json");
const DEBUG_HTML = path.join(DATA_DIR, "_debug_viewer_rendered.html");
const DEBUG_PNG = path.join(DATA_DIR, "_debug_viewer_screenshot.png");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// SignalR binary messages are framed with VarInt length prefix.
// Parse varint (7-bit) length.
function readVarInt(buf, offset) {
  let result = 0;
  let shift = 0;
  let i = offset;

  while (i < buf.length) {
    const byte = buf[i];
    result |= (byte & 0x7f) << shift;
    i++;
    if ((byte & 0x80) === 0) return { value: result, next: i };
    shift += 7;
    if (shift > 35) break;
  }
  return null;
}

// Split a buffer stream into SignalR binary messages (length-prefixed)
function splitSignalRBinaryMessages(buffer) {
  const messages = [];
  let offset = 0;

  while (offset < buffer.length) {
    const lenInfo = readVarInt(buffer, offset);
    if (!lenInfo) break;
    const msgLen = lenInfo.value;
    const start = lenInfo.next;
    const end = start + msgLen;
    if (end > buffer.length) break;

    messages.push(buffer.subarray(start, end));
    offset = end;
  }

  return messages;
}

// Deep search: find the biggest array of objects/strings/numbers
function findLargestArray(root) {
  let best = { path: "", count: 0, value: null };

  function walk(v, p) {
    if (!v) return;
    if (Array.isArray(v)) {
      if (v.length > best.count) best = { path: p, count: v.length, value: v };
      // walk children a bit
      for (let i = 0; i < Math.min(50, v.length); i++) walk(v[i], `${p}[${i}]`);
      return;
    }
    if (typeof v === "object") {
      for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
    }
  }

  walk(root, "");
  return best;
}

async function run() {
  ensureDir(DATA_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });

  // CDP session for WS frames
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");

  const frames = [];
  const wsBuffersById = new Map(); // requestId -> Buffer chunks concatenated

  cdp.on("Network.webSocketFrameReceived", (ev) => {
    const { requestId, timestamp, response } = ev;
    const payloadData = response.payloadData;
    const opcode = response.opcode; // 2 = binary
    frames.push({ dir: "recv", requestId, timestamp, opcode, length: payloadData?.length ?? 0 });

    if (opcode === 2 && payloadData) {
      // CDP sends binary payload as base64 string
      const chunk = Buffer.from(payloadData, "base64");
      const prev = wsBuffersById.get(requestId);
      wsBuffersById.set(requestId, prev ? Buffer.concat([prev, chunk]) : chunk);
    }
  });

  cdp.on("Network.webSocketFrameSent", (ev) => {
    const { requestId, timestamp, response } = ev;
    frames.push({ dir: "sent", requestId, timestamp, opcode: response.opcode, length: response.payloadData?.length ?? 0 });
  });

  console.log(`Loading Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(5000);

  // Scroll a bit to trigger more data rendering/loading
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(4000);

  // Save debug HTML/screenshot
  try {
    const html = await page.content();
    fs.writeFileSync(DEBUG_HTML, html, "utf8");
  } catch {}
  try {
    await page.screenshot({ path: DEBUG_PNG, fullPage: true });
  } catch {}

  await browser.close();

  fs.writeFileSync(DEBUG_WS, JSON.stringify(frames, null, 2), "utf8");

  // Decode SignalR binary messages using MessagePackHubProtocol
  const protocol = new MessagePackHubProtocol();
  const decoded = [];
  let bestDataset = { count: 0, path: "", value: null, requestId: null };

  for (const [requestId, buf] of wsBuffersById.entries()) {
    // Split into messages
    const messages = splitSignalRBinaryMessages(buf);
    if (!messages.length) continue;

    for (const msgBuf of messages) {
      try {
        // parseMessages returns hub messages from a single binary payload
        const hubMsgs = protocol.parseMessages(msgBuf, null);
        for (const hm of hubMsgs) {
          decoded.push({ requestId, type: hm.type, target: hm.target ?? null });

          // Search within for largest array
          const largest = findLargestArray(hm);
          if (largest.count > bestDataset.count) {
            bestDataset = { count: largest.count, path: largest.path, value: largest.value, requestId };
          }
        }
      } catch {
        // Ignore decode failures (some frames are handshake/keepalive/etc)
      }
    }
  }

  fs.writeFileSync(DEBUG_DECODE, JSON.stringify({ decodedCount: decoded.length, bestDataset }, null, 2), "utf8");

  if (!bestDataset.value || bestDataset.count < 50) {
    throw new Error(
      `No large dataset found in WS frames (best count=${bestDataset.count}). Check data/_debug_ws_decoded.json and data/_debug_ws_frames.json`
    );
  }

  // Write the extracted dataset as toolbox.items.json
  const out = {
    generatedAt: new Date().toISOString(),
    source: VIEWER_URL,
    requestId: bestDataset.requestId,
    extractedPath: bestDataset.path,
    count: bestDataset.count,
    items: bestDataset.value
  };

  fs.writeFileSync(OUT_ITEMS, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote items -> ${OUT_ITEMS} (count=${bestDataset.count})`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
