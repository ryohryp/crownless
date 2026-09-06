// Mobile browser regression for #515 Atlas mobile declutter.
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

async function seedCluster(page) {
  await page.evaluate(() => {
    const kinds = ["dungeon", "event", "facility", "encounter", "event", "dungeon"];
    const features = [["woods"], ["settlement"], ["road_hub"], ["water"], ["sacred"], ["height"]];
    const names = ["森の古砦", "空鐘の廃村", "街道の露店", "霧の渡し", "古い祈り場", "丘の物見台"];
    const discoveries = kinds.map((contentKind, i) => ({
      title: names[i],
      sourceRef: `node:${51500 + i}`,
      contentKind,
      features: features[i],
      mapOrigin: { latitude: 35.68, longitude: 139.77 },
      representativeCoordinate: { latitude: 35.68000 + i * .000005, longitude: 139.77000 + i * .000004 }
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
  await page.waitForFunction(() => document.querySelectorAll('.world-atlas-map--nearby [data-territory-key]').length === 3);
  await page.evaluate(() => window.CrownlessTerritoryMobileDeclutter.apply(document, window));
  await page.waitForFunction(() => document.querySelectorAll('.world-atlas-map--nearby [data-territory-key][data-territory-declutter="true"]').length === 3);
}

(async () => {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, timezoneId: "Asia/Tokyo" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.CrownlessTerritoryPhase1 && window.CrownlessTerritoryRewardSurface && window.CrownlessTerritoryMobileDeclutter && window.CrownlessExpeditionPresentation?.isReady());
    await seedCluster(page);
    await openFreshNearbyAtlas(page);

    const snapshot = await page.evaluate(() => {
      const markers = Array.from(document.querySelectorAll('.world-atlas-map--nearby [data-territory-key]'));
      return markers.map((marker) => {
        const rect = marker.getBoundingClientRect();
        return {
          key: marker.dataset.territoryKey,
          moved: getComputedStyle(marker).translate !== "none" && getComputedStyle(marker).translate !== "0px",
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          active: marker.classList.contains("active"),
          frontier: marker.dataset.territoryFrontier === "true",
          labelOpacity: marker.querySelector(":scope > span") ? getComputedStyle(marker.querySelector(":scope > span")).opacity : "1",
        };
      });
    });
    assert.equal(snapshot.length, 3);
    assert.ok(snapshot.filter(item => item.moved).length >= 1, "clustered territory markers must receive bounded visual offsets");
    assert.equal(new Set(snapshot.map(item => `${item.x},${item.y}`)).size, 3, "three territory markers must remain individually located/tappable");
    const quiet = snapshot.find(item => !item.active && !item.frontier);
    if (quiet) assert.equal(quiet.labelOpacity, "0", "non-selected, non-frontier labels should not cover the mobile Atlas");

    const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.world-atlas-map--nearby [data-territory-key]')).map(marker => marker.dataset.territoryKey));
    for (const key of keys) {
      await page.evaluate((territoryKey) => document.querySelector(`.world-atlas-map--nearby [data-territory-key="${CSS.escape(territoryKey)}"]`)?.click(), key);
      await page.waitForFunction((territoryKey) => document.querySelector('.territory-panel')?.dataset.territoryKey === territoryKey, key);
    }
    assert.match(await page.locator(".territory-atlas-summary").innerText(), /支配 0\/3 · 前線 3/);
    assert.deepEqual(errors, []);
    console.log("PASS 412x915: clustered 3-territory Atlas stays distinct, selectable, and label-light");
  } finally {
    await page.close();
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
