// scraper/scrape_viewer_characters_playwright.mjs
// Scrape JS-rendered /Viewer across all pages using Playwright (Blazor Server).
// Output: ../data/characters.viewer.full.json

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { load } from "cheerio";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_PATH = path.join(process.cwd(), "..", "data", "characters.viewer.full.json");

// --- parsing helpers ---
const PASSIVE_LIKE = /(Up Lv\d+|Resist Lv\d+|Mastery\b)/i;
const UI_JUNK = new Set([
  "Home", "Viewer", "Explorer", "Calculator", "Simulator", "Story Scripts", "Tools",
  "Character", "Weapon", "Accessory", "Boss",
  "Rarity:", "Elements:", "Card View", "Column:",
  "Rarity", "Element", "Cost", "Stats", "Leader Skill",
  "Active Skills", "Passive Skills", "Name", "ATK", "HP", "SPD",
  "ALL", "Image"
]);

function decodeHtmlEntities(str) {
  return String(str ?? "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function htmlToLines(html) {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]*>/g, "\n");
  const decoded = decodeHtmlEntities(noTags);
  return decoded
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function asIntMaybe(s) {
  const t = String(s ?? "").replaceAll(",", "");
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

function normalizeId(name, title) {
  return `${name}__${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isJunk(line) {
  if (!line) return true;
  if (UI_JUNK.has(line)) return true;
  if (line.startsWith("Page ")) return true;
  if (line.endsWith(" items")) return true;
  if (/^【\d+†Image】$/.test(line)) return true;
  return false;
}

function isValidUnitNameOrTitle(line) {
  if (!line) return false;
  if (UI_JUNK.has(line)) return false;
  if (line.startsWith("Page ")) return false;
  if (line.endsWith(" items")) return false;
  if (/^【\d+†Image】$/.test(line)) return false;
  if (PASSIVE_LIKE.test(line)) return false;
  if (asIntMaybe(line) != null) return false;
  return line.length >= 2;
}

function nextNonJunk(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length && isJunk(lines[i])) i++;
  return i;
}

function parseCharactersFromRenderedHtml(html) {
  const lines = htmlToLines(html);

  const start = lines.findIndex((l) => l === "Name");
  if (start === -1) return [];

  // stop before weapons section on Viewer
  const weaponIdx = lines.findIndex((l) => l === "Weapon:");
  const slice = weaponIdx !== -1 ? lines.slice(start, weaponIdx) : lines.slice(start);

  const units = [];
  const seen = new Set();

  let i = 0;
  for (let guard = 0; guard < 40000; guard++) {
    i = nextNonJunk(slice, i);
    if (i >= slice.length) break;

    const name = slice[i];
    const title = slice[i + 1];

    if (!isValidUnitNameOrTitle(name) || !isValidUnitNameOrTitle(title)) {
      i++;
      continue;
    }

    let statsPos = -1;
    let cost = null, atk = null, hp = null, spd = null;

    const searchFrom = i + 2;
    const searchTo = Math.min(slice.length - 4, i + 20);

    for (let j = searchFrom; j <= searchTo; j++) {
      const c = asIntMaybe(slice[j]);
      const a = asIntMaybe(slice[j + 1]);
      const h = asIntMaybe(slice[j + 2]);
      const s = asIntMaybe(slice[j + 3]);
      if (c != null && a != null && h != null && s != null) {
        cost = c; atk = a; hp = h; spd = s;
        statsPos = j;
        break;
      }
    }
    if (statsPos === -1) { i++; continue; }

    let k = nextNonJunk(slice, statsPos + 4);

    let leaderSkillName = null;
    let leaderSkillText = null;

    if (k < slice.length && isValidUnitNameOrTitle(slice[k])) {
      leaderSkillName = slice[k];
      k++;
    }
    k = nextNonJunk(slice, k);

    if (k < slice.length && slice[k].startsWith("Allied ")) {
      leaderSkillText = slice[k];
      k++;
    }
    k = nextNonJunk(slice, k);

    const activeSkills = [];
    while (k < slice.length && activeSkills.length < 6) {
      if (!isJunk(slice[k])) activeSkills.push(slice[k]);
      k++;
    }

    const passiveSkills = [];
    while (k < slice.length && passiveSkills.length < 4) {
      if (!isJunk(slice[k])) passiveSkills.push(slice[k]);
      k++;
    }

    const id = normalizeId(name, title);
    if (!seen.has(id)) {
      seen.add(id);
      units.push({
        id,
        name,
        title,
        cost,
        stats: { atk, hp, spd },
        leaderSkillName,
        leaderSkillText,
        activeSkills,
        passiveSkills,
        imageUrl: null
      });
    }

    i = k;
  }

  return units;
}

function extractImageUrlsFromRenderedHtml(html) {
  const $ = load(html);
  const urls = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    if (src.includes("favicon")) return;
    urls.push(src);
  });
  return urls;
}

function mergeDedupe(units) {
  const map = new Map();
  for (const u of units) {
    if (!u?.id) continue;
    if (!map.has(u.id)) map.set(u.id, u);
    else map.set(u.id, { ...map.get(u.id), ...u });
  }
  return [...map.values()];
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log(`Opening Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Let Blazor render initial content
  await page.waitForTimeout(2000);

  const all = [];
  let pageNum = 1;
  let stagnant = 0;
  let lastUnique = 0;

  while (pageNum <= 200) {
    await page.waitForTimeout(1200);

    const html = await page.content();
    const units = parseCharactersFromRenderedHtml(html);

    if (!units.length) {
      console.log(`Page ${pageNum}: parsed 0 units -> stopping`);
      break;
    }

    // Best-effort image assignment by index (optional)
    const imgs = extractImageUrlsFromRenderedHtml(html);
    if (imgs.length >= units.length) {
      for (let i = 0; i < units.length; i++) {
        units[i].imageUrl = units[i].imageUrl ?? imgs[i] ?? null;
      }
    }

    all.push(...units);
    const merged = mergeDedupe(all);

    console.log(`Page ${pageNum}: +${units.length} (unique ${merged.length})`);

    if (merged.length === lastUnique) stagnant++;
    else stagnant = 0;

    lastUnique = merged.length;
    if (stagnant >= 2) {
      console.log("No growth for 2 pages -> stopping");
      break;
    }

    const nextBtn = page.locator('button:has-text("Next")').first();
    if ((await nextBtn.count()) === 0) {
      console.log("No Next button found -> stopping");
      break;
    }

    const disabled = await nextBtn.isDisabled().catch(() => true);
    if (disabled) {
      console.log("Next is disabled -> last page reached");
      break;
    }

    await nextBtn.click();
    pageNum++;
  }

  const merged = mergeDedupe(all);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(
    OUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), source: VIEWER_URL, characters: merged }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${merged.length} characters -> data/characters.viewer.full.json`);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
