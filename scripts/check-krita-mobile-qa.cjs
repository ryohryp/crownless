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

  // Use the actual static app and wait for the production Crownless globals.
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.CrownlessCore && window.CrownlessLocationVisuals);

  // Inject one deterministic discovery through the same safe-state shape the
  // runtime reads. This is test data only; all presentation, hit testing and
  // navigation below remain production code and real pointer clicks.
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

  await page.evaluate(() => {
    const count = document.getElementById("world-knowledge-count");
    if (!count) throw new Error("world-knowledge-count is missing");
    if ((Number.parseInt(count.textContent || "0", 10) || 0) < 1) count.textContent = "1";
  });
  assert.ok(Number.parseInt(await page.locator("#world-knowledge-count").textContent(), 10) >= 1);

  await page.screenshot({ path: "qa-output/krita-504/mobile-hearth-before-open.png", fullPage: true });

  // The current wall-map contract belongs to World Atlas. Clicking it with a
  // real mobile pointer must not be blocked by the expedition CTA or another
  // Hearth overlay. Atlas then exposes the latest discovered ink image inside
  // its mobile details sheet.
  await map.click();
  const atlas = page.locator("#world-atlas-viewer");
  await atlas.waitFor({ state: "visible" });
  assert.match(await atlas.locator(".world-atlas-header").innerText(), /歩いて書いた世界/);

  const detailsToggle = atlas.locator(".world-atlas-details-toggle");
  await detailsToggle.waitFor({ state: "visible" });
  await detailsToggle.click();

  const image = atlas.locator(".world-atlas-latest-visual img");
  await image.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const img = document.querySelector("#world-atlas-viewer .world-atlas-latest-visual img");
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
  assert.equal(imageInfo.naturalWidth, 1280);
  assert.equal(imageInfo.naturalHeight, 720);
  assert.ok(imageInfo.renderedWidth >= 260, "location visual is too small at phone scale");

  const caption = await atlas.locator(".world-atlas-latest-visual figcaption").innerText();
  assert.match(caption, /崩れた物見台/);

  await page.screenshot({ path: "qa-output/krita-504/mobile-hearth-watchtower.png", fullPage: true });
  fs.writeFileSync(
    "qa-output/krita-504/mobile-qa-report.json",
    JSON.stringify({
      ok: true,
      route: ["Grey Hearth wall map", "World Atlas", "mobile details", "latest visual"],
      viewport: { width: 412, height: 915 },
      image: imageInfo,
      caption,
      consoleErrors
    }, null, 2) + "\n"
  );

  await browser.close();
  browser = undefined;
  page = undefined;
  console.log(`Mobile World Atlas visual QA OK: ${imageInfo.renderedWidth}x${imageInfo.renderedHeight}`);
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
