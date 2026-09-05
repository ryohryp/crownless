// Browser regression for the Atlas shell. Install Playwright in the QA/CI
// environment; the game itself has no new runtime dependency.
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile, mkdir } = require("node:fs/promises");
const { resolve, extname, sep } = require("node:path");
const { chromium } = require("playwright");

const root = resolve(__dirname, "..");
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const file = resolve(root, `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const path = file === root ? resolve(root, "index.html") : file;
    const bytes = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }).end(bytes);
  } catch { res.writeHead(404).end(); }
});

async function seedLocation(page) {
  // Simulate only the location provider. Use the real discovery persistence,
  // action/event handlers and expedition system throughout the interaction.
  await page.evaluate(() => {
    const kinds = ["dungeon", "event", "facility", "encounter", "event", "dungeon"];
    const features = [["woods"], ["settlement"], ["road_hub"], ["water"], ["sacred"], ["height"]];
    const discoveries = kinds.map((contentKind, i) => ({
      title: ["森の古砦", "空鐘の廃村", "街道の露店", "霧の渡し", "古い祈り場", "丘の物見台"][i],
      sourceRef: `node:${42600 + i}`, contentKind, features: features[i],
      mapOrigin: { latitude: 35.68, longitude: 139.77 },
      representativeCoordinate: { latitude: 35.68 + Math.cos(i * Math.PI / 3) * .003, longitude: 139.77 + Math.sin(i * Math.PI / 3) * .004 }
    }));
    window.CrownlessLocationDiscoveryRuntime = {
      state: "ready", discoveries,
      worldKnowledgeKey: d => `geo:${d.sourceRef}:${d.contentKind}:${d.features.join("+")}`,
      reload: async () => discoveries
    };
  });
}

async function bounded(page) {
  await page.waitForFunction(() => document.querySelector(".world-atlas-viewer").getBoundingClientRect().height <= innerHeight + 1);
  const geometry = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const folio = document.querySelector(".world-atlas-folio");
    const dock = rect(".world-atlas-dock");
    const map = rect(".world-atlas-map");
    return { height: innerHeight, width: innerWidth, folioScroll: folio.scrollHeight, folioHeight: folio.clientHeight,
      dockTop: dock.top, dockBottom: dock.bottom, mapHeight: map.height, right: rect(".world-atlas-viewer").right, scrollY };
  });
  assert.ok(geometry.folioScroll <= geometry.folioHeight + 1, JSON.stringify(geometry));
  assert.ok(geometry.dockBottom <= geometry.height + 1 && geometry.dockTop >= 0, JSON.stringify(geometry));
  assert.ok(geometry.mapHeight > 90, JSON.stringify(geometry));
  assert.ok(geometry.right <= geometry.width + 1, JSON.stringify(geometry));
  await page.mouse.move(4, 200);
  await page.mouse.wheel(0, 700);
  assert.equal(await page.evaluate(() => scrollY), geometry.scrollY, "Atlas must not scroll the page");
}

async function screenshot(page, name) {
  if (process.env.ATLAS_SCREENSHOT_DIR) {
    await mkdir(process.env.ATLAS_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: resolve(process.env.ATLAS_SCREENSHOT_DIR, `${name}.png`) });
  }
}

(async () => {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({ headless: true, ...(process.env.ATLAS_BROWSER_CHANNEL ? { channel: process.env.ATLAS_BROWSER_CHANNEL } : {}) });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1366, height: 900 }]) {
      const page = await browser.newPage({ viewport, timezoneId: "Asia/Tokyo" });
      await page.clock.setFixedTime(new Date("2026-09-05T00:00:00Z"));
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(() => window.CrownlessWorldAtlasActionsPresentation && window.CrownlessWorldAtlasScouting && window.CrownlessExpeditionPresentation?.isReady());
      await seedLocation(page);
      const compact = viewport.width <= 700 || (viewport.width <= 1000 && viewport.height <= 500);
      if (compact) {
        assert.ok(await page.locator(".world-atlas-home-entry").isVisible());
        assert.equal(await page.evaluate(() => scrollY), 0);
        await screenshot(page, `home-${viewport.width}`);
        await page.locator(".world-atlas-home-entry").click();
      } else await page.locator("#hearth-map-focus").click();
      await page.waitForSelector(".world-atlas-map--nearby");
      await bounded(page);
      await screenshot(page, `map-${viewport.width}`);
      await page.getByRole("button", { name: "世界Atlas", exact: true }).click();
      await page.waitForSelector(".world-atlas-map--world");
      await bounded(page);
      await page.getByRole("button", { name: "周辺探索図", exact: true }).click();
      await page.waitForSelector(".world-atlas-map--nearby");
      const initialHeight = await page.evaluate(() => document.body.scrollHeight);
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: "周辺を再調査", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector(".world-atlas-scan.scanning"));
        await bounded(page);
      }
      assert.equal(await page.evaluate(() => document.body.scrollHeight), initialHeight);
      const records = await page.evaluate(() => Object.values(CrownlessCore.loadSafeState().worldKnowledge.discoveries));
      assert.equal(records.filter(r => r.key.startsWith("geo:node:426")).length, 6);
      assert.ok(records.every(r => r.visits === 1));
      assert.doesNotMatch(JSON.stringify(records), /latitude|longitude|mapOrigin|representativeCoordinate/);

      if (viewport.height < 500) {
        if (compact) await page.locator(".world-atlas-details-toggle").click();
        await page.getByRole("combobox", { name: "地点を一覧から選ぶ" }).selectOption({ label: "空鐘の廃村" });
      } else await page.locator('.world-atlas-nearby-marker[aria-label^="空鐘の廃村"]').click();
      if (compact) {
        assert.equal(await page.locator(".world-atlas-details-toggle").getAttribute("aria-expanded"), "true");
        assert.ok(await page.locator(".world-atlas-details-close").evaluate(n => n === document.activeElement));
      }
      await page.waitForSelector('[data-atlas-action-kind="event"]');
      await bounded(page);
      await screenshot(page, `details-${viewport.width}`);
      await page.locator('[data-atlas-action-kind="event"]').click();
      await page.waitForSelector(".world-atlas-action-sheet");
      await page.locator(".world-atlas-event-choices button").first().click();
      assert.ok((await page.locator(".world-atlas-event-result").innerText()).length > 0);
      await screenshot(page, `result-${viewport.width}`);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".world-atlas-action-sheet").count(), 0);
      assert.equal(await page.locator("#world-atlas-viewer").count(), 1);
      assert.ok(await page.locator('[data-atlas-action-kind="event"]').evaluate(n => n === document.activeElement));
      if (compact) {
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".world-atlas-details-toggle").getAttribute("aria-expanded"), "false");
      }
      await page.locator(".world-atlas-close").focus();
      await page.keyboard.press("Shift+Tab");
      assert.ok(await page.evaluate(() => document.activeElement.closest("#world-atlas-viewer") !== null));

      // Chrome/keyboard-sized viewport changes keep the dock and inner scroll usable.
      if (compact) {
        await page.setViewportSize({ width: viewport.width, height: 380 });
        await bounded(page);
        await page.setViewportSize(viewport);
      }
      if (compact) await page.locator(".world-atlas-details-toggle").click();
      await page.getByRole("combobox", { name: "地点を一覧から選ぶ" }).selectOption({ label: "森の古砦" });
      await page.locator('[data-atlas-action-kind="expedition"]').focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector("form.expedition-prepare");
      assert.equal(await page.locator("#world-atlas-viewer").count(), 0);
      await page.locator('input[name="companion"]').first().check();
      if (viewport.width !== 390) await page.locator('input[name="instant"]').check();
      await page.locator(".expedition-dispatch").click();
      if (viewport.width === 390) {
        const active = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1")).activeExpedition);
        assert.ok(active);
        await page.reload();
        await page.waitForFunction(() => window.CrownlessExpeditionPresentation?.isReady());
        await page.evaluate(() => CrownlessExpeditionPresentation.open());
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1")).activeExpedition.id), active.id);
        await page.clock.setFixedTime(new Date(active.expectedReturnAt + 1));
        await page.evaluate(() => CrownlessExpeditionPresentation.open());
      }
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1"))?.completedReports?.length === 1);
      const state = await page.evaluate(() => localStorage.getItem("crownless.expedition-poc.v1"));
      await page.reload();
      await page.waitForFunction(() => window.CrownlessExpeditionPresentation?.isReady());
      await page.evaluate(() => CrownlessExpeditionPresentation.open());
      assert.equal(await page.evaluate(() => localStorage.getItem("crownless.expedition-poc.v1")), state, "Reopening a report must not apply rewards twice");
      assert.deepEqual(errors, []);
      console.log(`PASS ${viewport.width}x${viewport.height}: scan/repeat, selection, event/result, keyboard, dispatch/report/reload`);
      await page.close();
    }

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.CrownlessWorldAtlas);
    await page.evaluate(() => {
      window.CrownlessLocationDiscoveryRuntime = { state: "denied", discoveries: [], reload: async () => [] };
    });
    await page.locator(".world-atlas-home-entry").click();
    await page.waitForFunction(() => !document.querySelector(".world-atlas-scan.scanning"));
    await bounded(page);
    assert.match(await page.locator(".world-atlas-scan").innerText(), /位置情報を使えない/);
    await page.locator(".world-atlas-details-toggle").click();
    assert.equal(await page.locator(".world-atlas-place-picker").isVisible(), false);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    assert.ok(await page.locator(".world-atlas-home-entry").evaluate(n => n === document.activeElement));
    // A rejected provider must still leave a bounded, usable map and retry CTA.
    await page.evaluate(() => { CrownlessLocationDiscoveryRuntime.reload = async () => { throw new Error("offline"); }; });
    await page.locator(".world-atlas-home-entry").click();
    await page.getByRole("button", { name: "周辺を再調査", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".world-atlas-scan.scanning"));
    await bounded(page);
    assert.match(await page.locator(".world-atlas-scan").innerText(), /読み取れなかった/);
    console.log("PASS denied/empty/offline: bounded map, retry, focus restoration");
    await page.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
