// scraper/scrape_leader_skills_playwright.mjs
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const OUT = "data/leader_skills.json";
const DEBUG_HTML = "data/_debug_leaderskills_rendered.html";
const DEBUG_PNG = "data/_debug_leaderskills.png";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

// Tuning
const NAV_TIMEOUT_MS = 180000;
const ACTION_TIMEOUT_MS = 30000;
const PAGE_WAIT_MS = 250; // small settle delay between actions
const MAX_PAGES = 300; // safety cap

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeDebug(page, html) {
  ensureDir("data");
  fs.writeFileSync(DEBUG_HTML, html ?? "", "utf8");
}

async function screenshotDebug(page) {
  ensureDir("data");
  await page.screenshot({ path: DEBUG_PNG, fullPage: true });
}

function normalizeWhitespace(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

async function main() {
  ensureDir("data");

  // Seed file so workflow can always find it
  if (!fs.existsSync(OUT)) {
    fs.writeFileSync(
      OUT,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: VIEWER_URL,
          leaderSkills: [],
        },
        null,
        2
      ),
      "utf8"
    );
  }

  const browser = await chromium.launch({
    headless: true,
    // If you want to see it locally set headless:false
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);

  console.log(`[leader_skills] Loading: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

  // Blazor often needs a moment after DOMContentLoaded
  await page.waitForTimeout(1500);

  // Dump rendered HTML for debugging regardless (useful when it fails on Actions)
  const initialHtml = await page.content();
  writeDebug(page, initialHtml);
  await screenshotDebug(page);

  // ---- Find a "grid-like" area by looking for lots of repeated rows/images ----
  // The character list has many portrait images. We’ll target images that sit inside the listing.
  //
  // This selector strategy:
  //  - find all images on page
  //  - then filter to those with reasonably-sized bounding boxes (portraits)
  //  - and that are inside a repeated-row container (heuristic: closest table/div grid)
  //
  // We’ll re-locate per page to handle virtualization/pagination.
  async function getClickablePortraitHandles() {
    // Try a few common structures first (works if page uses <table> or role=grid)
    const candidates = [
      // Most likely: images inside a table/grid
      "table img",
      "[role='grid'] img",
      ".table img",
      ".grid img",
      ".k-grid img",
      // Fallback: any img (we'll filter by size)
      "img",
    ];

    for (const sel of candidates) {
      const handles = await page.$$(sel);
      if (handles.length === 0) continue;

      // Filter by visible + portrait-ish size
      const filtered = [];
      for (const h of handles) {
        const box = await h.boundingBox();
        if (!box) continue;
        if (box.width < 35 || box.height < 35) continue;
        if (box.width > 140 || box.height > 140) continue;
        filtered.push(h);
      }
      if (filtered.length >= 10) return filtered;
    }
    return [];
  }

  // Extract row “name” from the row containing the clicked portrait
  async function extractNameFromContext(portraitHandle) {
    try {
      const row = await portraitHandle.evaluateHandle((img) => {
        // walk up a few levels - rows are usually <tr> or some container div
        let n = img;
        for (let i = 0; i < 6 && n; i++) {
          if (n.tagName?.toLowerCase() === "tr") return n;
          n = n.parentElement;
        }
        return img.closest("tr") || img.closest("div");
      });

      const text = await row.evaluate((el) => (el?.innerText ? el.innerText : ""));
      // Typically first line is name; keep it conservative
      const lines = (text || "").split("\n").map((x) => x.trim()).filter(Boolean);
      if (lines.length === 0) return null;

      // Heuristic: character name usually appears early and is not "SSR", not numbers-only
      for (const line of lines.slice(0, 8)) {
        if (!line) continue;
        if (/^(SSR|SR|R|UR)$/i.test(line)) continue;
        if (/^\d[\d,]*$/.test(line)) continue;
        if (line.length >= 2 && line.length <= 40) return line;
      }
      return lines[0] ?? null;
    } catch {
      return null;
    }
  }

  async function openModalFromPortrait(portraitHandle) {
    // click the portrait; sometimes needs force due to overlays
    await portraitHandle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(50);
    await portraitHandle.click({ force: true });
  }

  async function readLeaderSkillFromModal() {
    // Modal/dialog patterns vary. We’ll look for any visible overlay containing “Leader Skill”
    const modalCandidates = [
      "[role='dialog']",
      ".modal",
      ".modal-dialog",
      ".blazored-modal",
      ".k-window",
      "div:has-text('Leader Skill')",
    ];

    // Wait for something that contains "Leader Skill"
    const leaderLabel = page.locator("text=/Leader\\s*Skill/i").first();
    await leaderLabel.waitFor({ state: "visible", timeout: 15000 });

    // From the label, capture nearby text
    const skillText = await leaderLabel.evaluate((el) => {
      // Attempt: get the nearest container and its text
      const container =
        el.closest("div") ||
        el.closest("section") ||
        el.closest("article") ||
        el.parentElement;

      const txt = container ? container.innerText : el.innerText;
      return txt || "";
    });

    // skillText likely includes "Leader Skill:" label; extract the sentence after it
    const flat = (skillText || "").replace(/\r/g, "\n");
    const lines = flat.split("\n").map((x) => x.trim()).filter(Boolean);

    // Find the line that contains "Leader Skill" then return the next meaningful line
    for (let i = 0; i < lines.length; i++) {
      if (/leader\s*skill/i.test(lines[i])) {
        // Sometimes "Leader Skill:" and the text are on same line
        const sameLine = lines[i].replace(/.*leader\s*skill\s*:?\s*/i, "").trim();
        if (sameLine) return normalizeWhitespace(sameLine);

        // Otherwise next line is the description
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j] && !/^(stats|power|hp|atk|attack|speed|level)\b/i.test(lines[j])) {
            return normalizeWhitespace(lines[j]);
          }
        }
      }
    }

    return null;
  }

  async function closeModal() {
    // Try ESC first (fast)
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(100);

    // If still present, try common close buttons
    const closeButtons = [
      "button:has-text('Close')",
      "button[aria-label='Close']",
      ".modal button.close",
      ".modal .btn-close",
      ".k-window-actions .k-window-action",
      "button:has-text('×')",
      "button:has-text('X')",
      "text=×",
    ];
    for (const sel of closeButtons) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(120);
        break;
      }
    }
  }

  async function goToNextPage() {
    // Based on your screenshot: there is a pager with a ">" button
    // We’ll try a few selectors for next:
    const nextSelectors = [
      "button:has-text('>')",
      "a:has-text('>')",
      "button[aria-label*='Next']",
      "a[aria-label*='Next']",
      ".pagination button:has-text('>')",
      ".pagination a:has-text('>')",
    ];

    for (const sel of nextSelectors) {
      const next = page.locator(sel).first();
      if (!(await next.isVisible().catch(() => false))) continue;

      // If disabled, stop
      const disabled =
        (await next.getAttribute("disabled").catch(() => null)) !== null ||
        (await next.getAttribute("aria-disabled").catch(() => null)) === "true" ||
        (await next.evaluate((el) => el.classList.contains("disabled")).catch(() => false));

      if (disabled) return false;

      await next.click({ force: true });
      await page.waitForTimeout(1200); // allow Blazor rerender
      return true;
    }

    // If we can’t find next, assume single page
    return false;
  }

  // Collect results
  const results = [];
  const seenKey = new Set();

  for (let pageIdx = 1; pageIdx <= MAX_PAGES; pageIdx++) {
    await page.waitForTimeout(PAGE_WAIT_MS);

    // Refresh debug each page (helps diagnose later)
    const html = await page.content();
    writeDebug(page, html);
    await screenshotDebug(page);

    const portraits = await getClickablePortraitHandles();
    if (portraits.length < 5) {
      console.log(`[leader_skills] Page ${pageIdx}: not enough portraits found (${portraits.length}). Stopping.`);
      break;
    }

    console.log(`[leader_skills] Page ${pageIdx}: found ${portraits.length} portrait candidates`);

    for (let i = 0; i < portraits.length; i++) {
      const h = portraits[i];

      // Key off row name if possible; otherwise skip duplicates by index+page
      const name = await extractNameFromContext(h);
      const key = `${pageIdx}:${name ?? "unknown"}:${i}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);

      try {
        await openModalFromPortrait(h);

        const leaderSkill = await readLeaderSkillFromModal();
        await closeModal();

        if (name && leaderSkill) {
          results.push({
            name,
            leaderSkill,
          });
          console.log(`  ✓ ${name}: ${leaderSkill}`);
        } else {
          // still close modal attempt already done
          if (name) console.log(`  - ${name}: (no leader skill found)`);
        }

        // keep actions quick but stable
        await page.waitForTimeout(80);
      } catch (e) {
        console.warn(`[leader_skills] Failed entry on page ${pageIdx} idx ${i}: ${e?.message ?? e}`);
        await closeModal().catch(() => {});
        await page.waitForTimeout(150);
      }
    }

    const hasNext = await goToNextPage();
    if (!hasNext) {
      console.log("[leader_skills] No next page detected. Done.");
      break;
    }
  }

  // De-dup by name (last wins)
  const byName = new Map();
  for (const r of results) {
    if (!r?.name || !r?.leaderSkill) continue;
    byName.set(r.name, r.leaderSkill);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: VIEWER_URL,
    count: byName.size,
    leaderSkills: Array.from(byName.entries()).map(([name, leaderSkill]) => ({
      name,
      leaderSkill,
    })),
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log(`[leader_skills] Wrote ${OUT} (${out.count} skills)`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});