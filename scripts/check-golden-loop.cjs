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

const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1")));
async function shot(page, name) {
  if (!process.env.GOLDEN_SCREENSHOT_DIR) return;
  await mkdir(process.env.GOLDEN_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(process.env.GOLDEN_SCREENSHOT_DIR, `${name}.png`) });
}
async function bounded(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.x >= -1 && box.x + box.width <= page.viewportSize().width + 1, JSON.stringify(box));
  assert.equal(await page.evaluate(() => scrollY), 0, "the underlying room must not scroll");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
async function ready(page) {
  await page.waitForFunction(() => window.CrownlessExpeditionPresentation?.isReady() && window.CrownlessWorldAtlasActionsPresentation && window.CrownlessWorldAtlasScouting);
}
async function prepare(page, strong) {
  await page.getByRole("button", { name: "仲間と道具へ →", exact: true }).click();
  if (strong) {
    await page.locator('input[name="companion"][value="ed"]').check();
    await page.locator('input[name="equipment"][value="shortbow"]').check();
    await page.locator('input[name="equipment"][value="old-knife"]').check();
  }
  await shot(page, `party-${page.viewportSize().width}-${strong}`);
  await page.getByRole("button", { name: "方針へ →", exact: true }).click();
  await page.locator(`input[name="policy"][value="${strong ? "standard" : "cautious"}"]`).check();
  await page.locator('input[name="objective"][value="explore"]').check();
  await shot(page, `policy-${page.viewportSize().width}-${strong}`);
  await page.getByRole("button", { name: "出発確認へ →", exact: true }).click();
  await bounded(page, ".expedition-review");
  await shot(page, `review-${page.viewportSize().width}-${strong}`);
}

(async () => {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({ headless: true, ...(process.env.GOLDEN_BROWSER_CHANNEL ? { channel: process.env.GOLDEN_BROWSER_CHANNEL } : {}) });
  const url = `http://127.0.0.1:${server.address().port}`;
  let overdueStorage;
  try {
    for (const width of [360, 390, 412, 1366]) {
      for (const strong of [true, false]) {
        const page = await browser.newPage({ viewport: { width, height: width > 700 ? 900 : 844 }, timezoneId: "Asia/Tokyo", reducedMotion: "reduce" });
        const errors = []; page.on("pageerror", error => errors.push(error.message));
        await page.route("https://**/*", route => route.abort());
        await page.clock.setFixedTime(new Date("2026-09-05T00:00:00Z"));
        await page.goto(url); await ready(page); await seedLocation(page);
        // The location provider alone is simulated; discovery, identity, save,
        // UI commands, elapsed resolution and report side effects are production.
        await page.locator(width <= 700 ? ".world-atlas-home-entry" : "#hearth-map-focus").click();
        await page.waitForFunction(() => !document.querySelector(".world-atlas-scan.scanning"));
        if (width <= 700) await page.locator(".world-atlas-details-toggle").click();
        await page.getByRole("combobox", { name: "地点を一覧から選ぶ" }).selectOption({ label: "森の古砦" });
        await page.locator('[data-atlas-action-kind="expedition"]').click();
        await page.waitForSelector("form.expedition-prepare");
        assert.equal(await page.locator("#world-atlas-viewer").count(), 0);
        await bounded(page, ".expedition-briefing");
        assert.match(await page.locator(".expedition-briefing").innerText(), /警戒.*獣.*狙い/);
        await shot(page, `discover-${width}-${strong}`);
        await prepare(page, strong);
        await page.locator("form button[type=submit]").click();
        const active = (await readState(page)).activeExpedition;
        assert.ok(active && active.expectedReturnAt > active.startedAt);
        assert.equal(active.inputs.destinationId, "world:geo:node:42600:dungeon:woods");
        if (width === 390 && strong) overdueStorage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
        await shot(page, `wait-${width}-${strong}`);
        await page.getByRole("button", { name: "灰炉で帰りを待つ →" }).click();
        assert.match(await page.locator(".hearth-journey-note").innerText(), /派遣中/);
        // Resolve while reopening an overdue save: all rule hooks must be ready.
        await page.clock.setFixedTime(new Date(active.expectedReturnAt + 1));
        await page.reload(); await ready(page);
        await page.locator(".hearth-journey-note").click();
        const after = await readState(page);
        const report = after.completedReports[0];
        assert.equal(report.expeditionId, active.id);
        assert.equal(report.outcome, strong ? "success" : "early-return");
        assert.ok(report.worldKnowledgeProgress, "geographic progress is applied even on overdue startup");
        assert.equal(report.dispatchSummary.equipment.length, strong ? 2 : 0);
        const sceneDeck = await page.evaluate(() => CrownlessExpeditionScenes.buildExpeditionScenes({ report: CrownlessExpeditionPresentation.getState().completedReports[0] }));
        assert.ok(new Set(sceneDeck.scenes.map(s => s.kind)).size >= 3);
        await bounded(page, ".expedition-adapt");
        await shot(page, `report-${width}-${strong}`);
        await page.locator(".expedition-kamishibai").scrollIntoViewIfNeeded();
        await shot(page, `scroll-${width}-${strong}`);
        const saved = await page.evaluate(() => localStorage.getItem("crownless.expedition-poc.v1"));
        const safe = await page.evaluate(() => JSON.stringify(CrownlessCore.loadSafeState().worldKnowledge));
        assert.doesNotMatch(saved + safe, /"(?:latitude|longitude|mapOrigin|representativeCoordinate|routeHistory)"/);
        await page.reload(); await ready(page);
        assert.equal(await page.evaluate(() => localStorage.getItem("crownless.expedition-poc.v1")), saved);
        assert.equal(await page.evaluate(() => JSON.stringify(CrownlessCore.loadSafeState().worldKnowledge)), safe);
        await shot(page, `hearth-${width}-${strong}`);
        await page.locator(".hearth-journey-note").click();
        const deckAfterReload = await page.evaluate(() => CrownlessExpeditionScenes.buildExpeditionScenes({ report: CrownlessExpeditionPresentation.getState().completedReports[0] }));
        assert.deepEqual(deckAfterReload, sceneDeck);
        if (strong) {
          assert.ok(report.followupDestinations?.length, "success must leave a playable next destination");
          await page.getByRole("button", { name: "変わった地図を見る →" }).click();
          if (width <= 700) await page.locator(".world-atlas-details-toggle").click();
          await page.locator(".world-atlas-return-trail button").first().click();
          assert.equal(await page.locator('input[name="destination"]:checked').inputValue(), report.followupDestinations[0].id);
        } else {
          assert.ok(report.injuries.length, "retreat leaves a recovery judgment");
          await page.getByRole("button", { name: "負傷者を休ませて次を準備する →" }).click();
          assert.ok((await readState(page)).companions.some(c => c.condition === "recovering"));
          assert.equal(await page.locator('input[name="destination"]:checked').inputValue(), report.destinationId);
        }
        await bounded(page, ".expedition-briefing");
        await shot(page, `adapt-${width}-${strong}`);
        // Focus cannot escape the modal; Escape returns to the room.
        await page.locator(".expedition-folio__close").focus();
        await page.keyboard.press("Shift+Tab");
        assert.ok(await page.evaluate(() => !!document.activeElement.closest("#expedition-folio")));
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".expedition-folio.is-open").count(), 0);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}: ${report.outcome}, ${report.loot.length} loot, ${report.discoveries.length} discoveries, ${report.injuries.length} injuries → next preparation`);
        await page.close();
      }
    }

    // Production WebLocationProvider path, with public geography and browser
    // permission emulated. No live location or upstream service is required.
    const geo = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { latitude: 35.68, longitude: 139.77 }, timezoneId: "Asia/Tokyo" });
    let requests = 0;
    await geo.route("https://**/*", route => route.abort());
    await geo.addInitScript(() => { window.CROWNLESS_GEOGRAPHY_API = `${location.origin}/api/geography`; });
    await geo.route("**/api/geography?*", route => {
      requests++;
      return route.fulfill({ json: { elements: [{ type: "way", id: 48200, center: { lat: 35.68, lon: 139.77 }, tags: { natural: "wood", name: "試験の森" } }] } });
    });
    await geo.goto(url); await ready(geo);
    assert.equal(requests, 0, "opening the Hearth never requests location");
    await geo.locator(".world-atlas-home-entry").click();
    await geo.waitForFunction(() => CrownlessLocationDiscoveryRuntime.state === "ready" && !document.querySelector(".world-atlas-scan.scanning"));
    assert.ok(requests > 0);
    await geo.locator(".world-atlas-details-toggle").click();
    await geo.locator('[data-atlas-action-kind="expedition"]').click();
    await prepare(geo, true);
    await geo.locator("form button[type=submit]").click();
    const geoActive = (await readState(geo)).activeExpedition;
    assert.ok(geoActive.inputs.destinationId.startsWith("world:geo:way:48200:"));
    await geo.clock.setFixedTime(new Date(geoActive.expectedReturnAt + 1));
    await geo.reload(); await ready(geo);
    assert.ok((await readState(geo)).completedReports.length === 1);
    assert.doesNotMatch(await geo.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))), /"(?:latitude|longitude|mapOrigin|representativeCoordinate|routeHistory)"/);
    console.log("PASS browser geolocation → real provider/translation → discovery → dispatch → overdue report, no raw-location persistence");
    await geo.close();

    // A missing rule must never resolve an overdue save with only part of the
    // ruleset, nor let a fast gate click enter transition-era combat.
    const blocked = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let rejectRule = true;
    await blocked.addInitScript(storage => { for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value); }, overdueStorage);
    await blocked.clock.setFixedTime(new Date("2026-09-06T00:00:00Z"));
    await blocked.route("**/src/expedition-forest-approach.js", route => rejectRule ? route.abort() : route.continue());
    await blocked.goto(url);
    await blocked.waitForFunction(() => document.querySelector("#start-expedition").textContent.includes("再読込"));
    assert.equal(await blocked.evaluate(() => !!window.CrownlessExpeditionPresentation), false);
    assert.equal(await blocked.evaluate(() => localStorage.getItem("crownless.expedition-poc.v1")), overdueStorage["crownless.expedition-poc.v1"]);
    rejectRule = false;
    await blocked.locator("#start-expedition").click();
    await ready(blocked);
    await blocked.waitForSelector(".expedition-adapt");
    const recovered = await readState(blocked);
    assert.equal(recovered.completedReports.length, 1);
    assert.ok(recovered.completedReports[0].worldKnowledgeProgress);
    assert.equal(await blocked.locator("#hub-screen.active").count(), 1);
    // Selecting another destination after a report is a command, with no
    // synthetic recovery click and no accidental automatic treatment.
    const beforeInvalid = JSON.stringify(recovered);
    assert.equal(await blocked.evaluate(() => CrownlessExpeditionPresentation.open({ view: "prepare", destinationId: "unearned:place" })), false);
    assert.equal(JSON.stringify(await readState(blocked)), beforeInvalid);
    console.log("PASS missing-rule startup fails closed, click retries, overdue report resolves once, unknown destination rejected");
    await blocked.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());

