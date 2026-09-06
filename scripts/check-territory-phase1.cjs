// Mobile browser regression for #503/#509 Territory Phase 1.
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
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
  await page.evaluate(() => {
    const kinds = ["dungeon", "event", "facility", "encounter", "event", "dungeon"];
    const features = [["woods"], ["settlement"], ["road_hub"], ["water"], ["sacred"], ["height"]];
    const discoveries = kinds.map((contentKind, i) => ({
      title: ["森の古砦", "空鐘の廃村", "街道の露店", "霧の渡し", "古い祈り場", "丘の物見台"][i],
      sourceRef: `node:${50900 + i}`,
      contentKind,
      features: features[i],
      mapOrigin: { latitude: 35.68, longitude: 139.77 },
      representativeCoordinate: { latitude: 35.68 + Math.cos(i * Math.PI / 3) * .003, longitude: 139.77 + Math.sin(i * Math.PI / 3) * .004 }
    }));
    window.CrownlessLocationDiscoveryRuntime = {
      state: "ready",
      discoveries,
      worldKnowledgeKey: d => `geo:${d.sourceRef}:${d.contentKind}:${d.features.join("+")}`,
      reload: async () => discoveries,
    };
  });
}

async function openFreshNearbyAtlas(page) {
  await page.locator(".world-atlas-home-entry").click();
  await page.getByRole("button", { name: "周辺を再調査", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".world-atlas-scan.scanning"));
  await page.locator(".world-atlas-close").click();
  await page.locator(".world-atlas-home-entry").click();
  await page.waitForSelector(".world-atlas-map--nearby");
  await page.waitForSelector('[data-territory-key][data-territory-owner="npc"], [data-territory-key][data-territory-owner="player"]');
}

async function selectNearbyPlace(page, name) {
  const marker = page.locator(`.world-atlas-nearby-marker[aria-label^="${name}"]`);
  if (await marker.count()) {
    await marker.click();
  } else {
    await page.locator(".world-atlas-details-toggle").click();
    await page.getByRole("combobox", { name: "地点を一覧から選ぶ" }).selectOption({ label: name });
  }
  await page.waitForSelector(".territory-panel");
}

(async () => {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, timezoneId: "Asia/Tokyo" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try {
    await page.clock.setFixedTime(new Date("2026-09-06T11:30:00Z"));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.CrownlessTerritoryPhase1 && window.CrownlessWorldAtlasActionsPresentation && window.CrownlessExpeditionPresentation?.isReady());
    await seedLocation(page);
    await openFreshNearbyAtlas(page);

    assert.equal(await page.locator(".world-atlas-nearby-marker[data-territory-key]").count(), 3, "Phase 1 must stay bounded to exactly three territory locations");
    assert.ok(await page.locator('.world-atlas-nearby-marker[data-territory-owner="npc"]').count() >= 2, "at least two territory locations begin under NPC control");

    // Terrain affinity makes the height dungeon the deterministic foothold.
    await selectNearbyPlace(page, "丘の物見台");
    let territoryPanel = page.locator(".territory-panel");
    assert.match(await territoryPanel.innerText(), /NPC支配.*足場/);
    assert.match(await territoryPanel.innerText(), /未偵察/);
    assert.ok(await territoryPanel.getByRole("button", { name: "偵察する — 守りと危険を知る", exact: true }).isVisible());
    assert.ok(await territoryPanel.getByRole("button", { name: "偵察せず攻略の準備へ →", exact: true }).isVisible());

    await territoryPanel.getByRole("button", { name: "偵察する — 守りと危険を知る", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".territory-panel")?.textContent.includes("偵察済み"));
    territoryPanel = page.locator(".territory-panel");
    assert.match(await territoryPanel.innerText(), /崩|collapse|足場/);

    await territoryPanel.getByRole("button", { name: "攻略の準備へ →", exact: true }).click();
    await page.waitForSelector("form.expedition-prepare");
    assert.match(await page.locator(".territory-prepare-note").innerText(), /攻略目標: 丘の物見台/);
    assert.match(await page.locator(".territory-prepare-note").innerText(), /成功した帰還だけが支配を変える/);

    await page.getByRole("button", { name: "仲間と道具へ →", exact: true }).click();
    await page.locator('input[name="companion"][value="ed"]').check();
    await page.locator('input[name="equipment"][value="old-knife"]').check();
    await page.locator('input[name="equipment"][value="shortbow"]').check();
    await page.getByRole("button", { name: "方針へ →", exact: true }).click();
    await page.locator('input[name="policy"][value="standard"]').check();
    await page.getByRole("button", { name: "出発確認へ →", exact: true }).click();
    await page.locator('input[name="instant"]').check();
    await page.locator("form button[type=submit]").click();

    await page.waitForFunction(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1"))?.completedReports?.length >= 1);
    await page.waitForSelector(".expedition-report-summary");
    const report = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1")).completedReports[0]);
    assert.equal(report.outcome, "success", "the fixed QA loadout should successfully contest the foothold");
    assert.equal(report.territoryOutcome?.controlled, true);
    await page.waitForSelector(".territory-report-note");
    assert.match(await page.locator(".territory-report-note").innerText(), /地点を取った/);

    const territoryStateBeforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless.territory.phase1.v1")));
    assert.equal(territoryStateBeforeReload.controlledKeys.length, 1);

    // Reloading/reopening the completed report must not apply control a second time.
    await page.reload();
    await page.waitForFunction(() => window.CrownlessTerritoryPhase1 && window.CrownlessExpeditionPresentation?.isReady());
    await page.evaluate(() => CrownlessExpeditionPresentation.open());
    const territoryStateAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless.territory.phase1.v1")));
    assert.deepEqual(territoryStateAfterReload.controlledKeys, territoryStateBeforeReload.controlledKeys);
    await page.locator(".expedition-folio__close").click();

    // The mocked nearby runtime is page-local and disappears on reload, so
    // restore the same coarse discovery set before evaluating the Atlas reward surface.
    await seedLocation(page);
    await openFreshNearbyAtlas(page);
    await page.waitForSelector('[data-territory-owner="player"]');
    assert.equal(await page.locator('[data-territory-owner="player"]').count(), 1);
    await selectNearbyPlace(page, "丘の物見台");
    territoryPanel = page.locator(".territory-panel");
    assert.match(await territoryPanel.innerText(), /灰炉支配/);
    const nextButton = territoryPanel.getByRole("button", { name: "次は「街道の露店」を狙う →", exact: true });
    assert.ok(await nextButton.isVisible());
    await nextButton.click();
    await page.waitForFunction(() => document.querySelector(".territory-panel")?.textContent.includes("所要時間が35%短くなる"));
    territoryPanel = page.locator(".territory-panel");
    assert.match(await territoryPanel.innerText(), /35%短くなる/);

    await territoryPanel.getByRole("button", { name: "偵察せず攻略の準備へ →", exact: true }).click();
    await page.waitForSelector("form.expedition-prepare");
    assert.match(await page.locator(".territory-prepare-note").innerText(), /所要時間 -35%/);

    assert.deepEqual(errors, []);
    console.log("PASS 412x915: Discover → Scout → Prepare → Contest → Report → Control → next territory");
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });