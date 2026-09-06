const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

let browser;
let page;
fs.mkdirSync("qa-output/krita-504", { recursive: true });

(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  // The app is static; waiting for DOMContentLoaded plus the real Crownless
  // globals is both sufficient and more deterministic than networkidle, which
  // can be held open by unrelated page activity.
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.CrownlessCore && window.CrownlessLocationVisuals);

  await page.evaluate(() => {
    const core = window.CrownlessCore;
    const originalLoad = core.loadSafeState.bind(core);
    core.loadSafeState = () => {
      const state = originalLoad() || {};
      const worldKnowledge = state.worldKnowledge || {};
      return {
        ...state,
        worldKnowledge: {
          ...worldKnowledge,
          discoveries: {
            ...(worldKnowledge.discoveries || {}),
            "qa-issue-504-watchtower": {
              id: "qa-issue-504-watchtower",
              name: "崩れた物見台",
              baseTitle: "崩れた物見台",
              contentKind: "dungeon",
              terrain: ["height"],
              firstDiscoveredAt: Date.now() + 1000
            }
          }
        }
      };
    };

    const mutationTarget = document.getElementById("world-knowledge-count") || document.getElementById("secured-count");
    if (!mutationTarget) throw new Error("No Hearth mutation target found");
    mutationTarget.textContent = String((Number.parseInt(mutationTarget.textContent || "0", 10) || 0) + 1);
  });

  const map = page.locator("#hearth-map-focus");
  await map.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#hearth-map-focus")?.classList.contains("has-location-visual"));
  assert.equal(await map.getAttribute("data-location-visual"), "ruined-watchtower");

  // The injected saved-state discovery and the visible Hearth counter must
  // describe the same state. The production click path intentionally reads
  // the rendered discovery count as well as the resolved visual. Keep this
  // coherent immediately before the real pointer click; do not bypass hit
  // testing with element.click(), because #504 must catch mobile overlays.
  await page.evaluate(() => {
    const count = document.getElementById("world-knowledge-count");
    if (!count) throw new Error("world-knowledge-count is missing");
    if ((Number.parseInt(count.textContent || "0", 10) || 0) < 1) count.textContent = "1";
  });
  assert.ok(Number.parseInt(await page.locator("#world-knowledge-count").textContent(), 10) >= 1);

  await page.screenshot({ path: "qa-output/krita-504/mobile-hearth-before-open.png", fullPage: true });
  await map.click();
  const viewer = page.locator("#hearth-location-visual-viewer");
  await viewer.waitFor({ state: "visible" });
  const image = viewer.locator("img");
  await image.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const img = document.querySelector("#hearth-location-visual-viewer img");
    return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  });

  const imageInfo = await image.evaluate((img) => ({
    src: img.getAttribute("src"),
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    renderedWidth: Math.round(img.getBoundingClientRect().width),
    renderedHeight: Math.round(img.getBoundingClientRect().height)
  }));
  assert.equal(imageInfo.src, "assets/locations/ruined-watchtower.png");
  assert.ok(imageInfo.renderedWidth >= 280, "location visual is too small at phone scale");

  await page.screenshot({ path: "qa-output/krita-504/mobile-hearth-watchtower.png", fullPage: true });
  fs.writeFileSync(
    "qa-output/krita-504/mobile-qa-report.json",
    JSON.stringify({
      ok: true,
      viewport: { width: 412, height: 915 },
      image: imageInfo,
      consoleErrors
    }, null, 2) + "\n"
  );

  await browser.close();
  browser = undefined;
  page = undefined;
  console.log(`Mobile Hearth QA OK: ${imageInfo.renderedWidth}x${imageInfo.renderedHeight}`);
})().catch(async (error) => {
  console.error(error);
  if (page) {
    await page.screenshot({ path: "qa-output/krita-504/mobile-hearth-failure.png", fullPage: true }).catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = undefined;
  }
  process.exitCode = 1;
});
