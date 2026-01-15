import fs from "fs";
import { chromium } from "playwright";

const OUT = "data/leader_skills.json";
const URL = "https://evertaletoolbox2.runasp.net/Viewer";

async function run() {
  console.log("[leader_skills] Launching browser…");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Give Blazor time to hydrate
  await page.waitForTimeout(4000);

  const results = [];

  let pageIndex = 1;
  while (true) {
    console.log(`[leader_skills] Page ${pageIndex}`);

    // Character images (clickable avatars)
    const avatars = await page.$$("table img");

    if (!avatars.length) {
      console.warn("No avatars found, stopping.");
      break;
    }

    for (let i = 0; i < avatars.length; i++) {
      try {
        await avatars[i].click({ timeout: 3000 });

        // Wait for modal
        const modal = await page.waitForSelector(
          ".modal-content, .mud-dialog, .blazor-modal",
          { timeout: 4000 }
        );

        const text = await modal.innerText();

        const match = text.match(/Leader Skill\s*:?\s*([\s\S]*?)(?:Stats:|Active Skills|Passive Skills)/i);

        if (match) {
          results.push({
            sourcePage: pageIndex,
            leaderSkill: match[1].trim()
          });
        }

        // Close modal (ESC is most reliable)
        await page.keyboard.press("Escape");
        await page.waitForTimeout(250);

      } catch (err) {
        console.warn(`Skipping character ${i + 1} on page ${pageIndex}`);
        try { await page.keyboard.press("Escape"); } catch {}
      }
    }

    // Next page button
    const nextBtn = await page.$("button:has-text('>')");
    if (!nextBtn) break;

    const disabled = await nextBtn.isDisabled();
    if (disabled) break;

    await nextBtn.click();
    await page.waitForTimeout(1200);
    pageIndex++;
  }

  await browser.close();

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: URL,
        leaderSkills: results
      },
      null,
      2
    )
  );

  console.log(`[leader_skills] Saved ${results.length} entries`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});