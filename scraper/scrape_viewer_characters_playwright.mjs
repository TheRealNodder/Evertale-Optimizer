// scraper/scrape_viewer_characters_playwright.mjs
// CI-safe extractor for Blazor Server Viewer via WebSocket (_blazor).
// The Viewer UI may not render DOM in GitHub Actions, but WS frames still arrive.
// We capture WS frames (text + binary) and extract rows from Blazor render content.
//
// Outputs:
//   data/toolbox.items.json            (always if we can extract >= 5 rows)
// Debug:
//   data/_debug_ws_frames.json         (top frames, with base64 for binary)
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

const OUT_ITEMS = "data/toolbox.items.json";
const OUT_WS_DEBUG = "data/_debug_ws_frames.json";

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}
function toAbsUrl(src) {
  if (!src) return null;
  const s = String(src);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `https://${DOMAIN_HINT}${s}`;
  return s;
}

async function ensureDataDir() {
  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  try {
    await fs.writeFile(path.join(outDir, "_debug_viewer_rendered.html"), await page.content(), "utf8");
  } catch {}
  try {
    await page.screenshot({ path: path.join(outDir, "_debug_viewer_screenshot.png"), fullPage: true });
  } catch {}
}

// Extract likely image paths from any text blob
function extractImagePaths(text) {
  const out = new Set();
  const re = /\/files\/images\/[a-z0-9/_-]+?\.(png|jpg|jpeg|webp)/gi;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[0]);
  return Array.from(out);
}

// Extract rows from render content by finding sequences that look like:
// Name + Rarity + Element + Cost + ATK + HP + SPD + Weapon + LeaderSkill + ActiveSkills + PassiveSkills
//
// We can’t perfectly parse without schema, but we can do a good-enough reconstruction:
// - find header and split by it
// - then for each chunk, grab first tokens as name/rarity/element and numbers for stats
function extractRowsFromText(text) {
  const rows = [];

  // Normalize
  const t = text.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return rows;

  // Remove the header if present
  const header = "Name Rarity Element Cost ATK HP SPD Weapon Leader Skill Active Skills Passive Skills";
  const idxHeader = t.indexOf(header);
  const body = idxHeader >= 0 ? t.slice(idxHeader + header.length) : t;

  // Split on patterns that often indicate a new unit name.
  // We detect a new row when we see " <Rarity> <Cost,...> <Element> " etc is too hard,
  // so we instead split by occurrences of double-spaced capitalized sequences is unreliable.
  //
  // Better: use image paths as anchors. In the Viewer, each row typically includes an image path.
  const imagePaths = extractImagePaths(t);
  if (imagePaths.length === 0) {
    // fallback: chunk by common " Lv" patterns is messy, just return none
    return rows;
  }

  // For each image path, try to extract nearby text window around it
  for (const p of imagePaths) {
    const pos = t.indexOf(p);
    if (pos === -1) continue;

    const window = t.slice(Math.max(0, pos - 700), Math.min(t.length, pos + 1400));

    // Try to find a likely "name" before the image path.
    // Many render batches include the name close to the row.
    // Heuristic: take first 8-12 words before first number sequence.
    const before = window.slice(0, window.indexOf(p)).trim();
    const candidate = before.slice(-350); // last part before image
    const words = candidate.split(" ").filter(Boolean);

    // Build a name by taking last 3..10 words that are not purely numeric/stat labels
    const bad = new Set(["HP", "ATK", "DEF", "SPD", "TU", "LUK", "Cost", "Rarity", "Element"]);
    const filtered = words.filter(w => !bad.has(w) && !/^\d+[,\d]*$/.test(w));

    let name = filtered.slice(-10).join(" ").trim();
    // Clean if name includes obvious stat tokens
    name = name.split(/\b(HP|ATK|DEF|SPD|TU)\b/i)[0].trim();

    // Extract element (Light/Storm/Fire/Water/Earth/Dark) nearby
    const elementMatch = window.match(/\b(Light|Storm|Fire|Water|Earth|Dark)\b/i);
    const element = elementMatch ? elementMatch[1] : null;

    // Extract first 3 big numbers for cost/atk/hp/spd (cost may not be numeric though)
    const nums = window.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/g) || [];
    // Many rows show: Cost, ATK, HP, SPD -> we’ll take first 4 numbers
    const cost = nums[0] ?? null;
    const atk = nums[1] ?? null;
    const hp = nums[2] ?? null;
    const spd = nums[3] ?? null;

    rows.push({
      name: norm(name) || null,
      element: element ? norm(element) : null,
      cost: cost ? norm(cost) : null,
      atk: atk ? norm(atk) : null,
      hp: hp ? norm(hp) : null,
      spd: spd ? norm(spd) : null,
      image: toAbsUrl(p),
      url: VIEWER_URL,
    });
  }

  // Dedup by name+image
  const dedup = new Map();
  for (const r of rows) {
    if (!r.name) continue;
    // skip header junk
    if (r.name.toLowerCase().startsWith("name rarity element")) continue;

    const key = `${r.name}::${r.image || ""}`;
    if (!dedup.has(key)) dedup.set(key, r);
  }

  return Array.from(dedup.values());
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

  const frames = [];
  const MAX_FRAMES = 25;

  function storeFrame(f) {
    frames.push(f);
    frames.sort((a, b) => (b.len || 0) - (a.len || 0));
    if (frames.length > MAX_FRAMES) frames.length = MAX_FRAMES;
  }

  page.on("websocket", (ws) => {
    ws.on("framereceived", (evt) => {
      const payload = evt.payload;

      if (typeof payload === "string") {
        storeFrame({
          ws: ws.url(),
          type: "text",
          len: payload.length,
          head: payload.slice(0, 1200),
        });
      } else if (Buffer.isBuffer(payload)) {
        storeFrame({
          ws: ws.url(),
          type: "binary",
          len: payload.length,
          base64: payload.toString("base64"),
        });
      } else {
        // unknown type
        const s = String(payload);
        storeFrame({
          ws: ws.url(),
          type: "unknown",
          len: s.length,
          head: s.slice(0, 1200),
        });
      }
    });
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let it connect and stream
  await page.waitForTimeout(20000);

  // Scroll to trigger more rendering traffic
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(800);
  }

  await page.waitForTimeout(6000);

  await saveDebug(page);
  await browser.close();

  // Save WS frames debug
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_WS_DEBUG),
    JSON.stringify({ scrapedAt: new Date().toISOString(), frames }, null, 2),
    "utf8"
  );
  console.log(`Wrote WS debug -> ${OUT_WS_DEBUG}`);

  // Build a big text blob from stored frames (text + decoded binary-as-utf8 where possible)
  let bigText = "";
  for (const f of frames) {
    if (f.type === "text" && f.head) bigText += " " + f.head;
    if (f.type === "binary" && f.base64) {
      // Try to interpret as utf8 (some frames contain readable strings even if binary)
      try {
        const buf = Buffer.from(f.base64, "base64");
        const asText = buf.toString("utf8");
        // Only keep if it has image paths or the header words
        if (asText.includes("/files/images/") || asText.includes("Name Rarity Element")) {
          bigText += " " + asText;
        }
      } catch {}
    }
  }

  const rows = extractRowsFromText(bigText);

  if (rows.length < 5) {
    throw new Error(
      `Could not extract enough rows from WS frames (rows=${rows.length}). Open data/_debug_ws_frames.json and look for a binary frame that contains '/files/images/'.`
    );
  }

  // Convert to toolbox.items.json format
  const items = rows.map((r) => ({
    id: r.name,
    name: r.name,
    category: "characters",
    element: r.element,
    cost: r.cost,
    atk: r.atk,
    hp: r.hp,
    spd: r.spd,
    image: r.image,
    url: r.url,
  }));

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify(
      {
        source: VIEWER_URL,
        scrapedAt: new Date().toISOString(),
        count: items.length,
        items,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${items.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});