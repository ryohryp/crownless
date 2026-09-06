// Mobile browser regression for #512 Territory reward surface + Territory Build MVP.
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
      sourceRef: `node:${51200 + i}`,
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
  await page.waitForSelector(".territory-atlas-summary");
}

async function selectNearbyPlace(page, name) {
  const marker = page.locator(`.world-atlas-nearby-marker[aria-label^="${name}"]`);
  if (await marker.count()) await marker.click();
  else {
    await page.locator(".world-atlas-details-toggle").click();
    await page.getByRole("combobox", { name: "地点を一覧から選ぶ" }).selectOption({ label: name });
  }
  await page.waitForSelector(".territory-panel");
}

async function contestSelectedPlace(page) {
  let panel = page.locator(".territory-panel");
  const scout = panel.getByRole("button", { name: "偵察する — 守りと危険を知る", exact: true });
  if (await scout.count()) await scout.click();
  panel = page.locator(".territory-panel");
  await panel.getByRole("button", { name: "攻略の準備へ →", exact: true }).click();
  await page.waitForSelector("form.expedition-prepare");
  await page.getByRole("button", { name: "仲間と道具へ →", exact: true }).click();
  await page.locator('input[name="companion"][value="ed"]').check();
  await page.locator('input[name="equipment"][value="old-knife"]').check();
  await page.locator('input[name="equipment"][value="shortbow"]').check();
  await page.getByRole("button", { name: "方針へ →", exact: true }).click();
  await page.locator('input[name="policy"][value="standard"]').check();
  await page.getByRole("button", { name: "出発確認へ →", exact: true }).click();
  await page.locator('input[name="instant"]').check();
  await page.locator("form button[type=submit]").click();
  await page.waitForSelector(".territory-report-note");
}

(async () => {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, timezoneId: "Asia/Tokyo" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try {
    await page.clock.setFixedTime(new Date("2026-09-06T12:00:00Z"));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.CrownlessTerritoryPhase1 && window.CrownlessTerritoryRewardSurface && window.CrownlessExpeditionPresentation?.isReady());
    await seedLocation(page);
    await openFreshNearbyAtlas(page);

    assert.match(await page.locator(".territory-atlas-summary").innerText(), /支配 0\/3 · 前線 3/);
    await selectNearbyPlace(page, "丘の物見台");
    await contestSelectedPlace(page);
    const report = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless.expedition-poc.v1")).completedReports[0]);
    assert.equal(report.territoryOutcome?.controlled, true);
    await page.locator(".expedition-folio__close").click();

    // Reopening the Atlas is the conquest reward surface.
    await page.locator(".world-atlas-home-entry").click();
    await page.waitForSelector(".territory-capture-toast");
    assert.match(await page.locator(".territory-capture-toast").innerText(), /灰炉が「丘の物見台」を押さえた/);
    assert.match(await page.locator(".territory-atlas-summary").innerText(), /支配 1\/3 · 前線 2/);
    assert.ok(await page.locator(".territory-route-ink path").count() >= 1, "captured foothold must draw a manuscript route toward the changed next target");
    assert.equal(await page.locator('[data-territory-owner="player"]').count(), 1);
    assert.ok(await page.locator('[data-territory-frontier="true"]').count() >= 1);

    const ownershipStyles = await page.evaluate(() => {
      const player = document.querySelector('.world-atlas-nearby-marker[data-territory-owner="player"] > i, .world-atlas-marker[data-territory-owner="player"] i');
      const npc = document.querySelector('.world-atlas-nearby-marker[data-territory-owner="npc"] > i, .world-atlas-marker[data-territory-owner="npc"] i');
      return { player: player ? getComputedStyle(player).borderStyle : "", npc: npc ? getComputedStyle(npc).borderStyle : "" };
    });
    assert.equal(ownershipStyles.player, "double", "player control must remain legible without relying on color");
    assert.equal(ownershipStyles.npc, "dashed", "NPC control must remain legible without relying on color");

    await selectNearbyPlace(page, "丘の物見台");
    const build = page.locator(".territory-development");
    assert.match(await build.innerText(), /この土地をどう使う/);
    assert.ok(await build.getByRole("button", { name: /斥候所/ }).isVisible());
    assert.ok(await build.getByRole("button", { name: /補給所/ }).isVisible());
    await build.getByRole("button", { name: /補給所/ }).click();
    await page.waitForFunction(() => document.querySelector(".territory-development")?.textContent.includes("補給所を置いた"));
    assert.match(await page.locator(".territory-development").innerText(), /通常比約55%短くなる/);
    assert.ok(await page.locator('.territory-development-badge').count() >= 1, "the chosen use must remain written on the Atlas marker");

    const nextButton = page.locator(".territory-panel").getByRole("button", { name: "次は「街道の露店」を狙う →", exact: true });
    await nextButton.click();
    await page.waitForFunction(() => document.querySelector(".territory-panel")?.textContent.includes("所要時間が35%短くなる"));
    await page.locator(".territory-panel").getByRole("button", { name: "偵察せず攻略の準備へ →", exact: true }).click();
    await page.waitForSelector(".territory-development-effect", { state: "attached" });
    assert.match(await page.locator(".territory-development-effect").textContent(), /補給所.*通常比約55%短縮/);

    // Territory notes are part of the existing staged preparation UI and are visible
    // on the policy stage, where the player weighs the expedition's risk posture.
    await page.getByRole("button", { name: "仲間と道具へ →", exact: true }).click();
    await page.getByRole("button", { name: "方針へ →", exact: true }).click();
    await page.waitForSelector(".territory-development-effect");
    assert.match(await page.locator(".territory-development-effect").innerText(), /補給所.*通常比約55%短縮/);

    const liveEffect = await page.evaluate(() => {
      const route = CrownlessTerritoryPhase1.territories(window).find(item => item.role === "route");
      const state = CrownlessExpeditionPresentation.getState();
      const id = `world:${route.key}`;
      const base = state.destinations.find(item => item.id === id)?.durationMs;
      const adjusted = CrownlessTerritoryRewardSurface.applySupplyToExpeditionState(window, state, { destinationId: id });
      const next = adjusted.destinations.find(item => item.id === id)?.durationMs;
      return { base, next };
    });
    assert.ok(liveEffect.base > 0);
    assert.equal(liveEffect.next, Math.round(liveEffect.base * 0.7), "supply post must alter the real dispatch-state destination, not only copy text");

    assert.deepEqual(errors, []);
    console.log("PASS 412x915: NPC control → capture → Atlas reward → build choice → changed next preparation");
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
