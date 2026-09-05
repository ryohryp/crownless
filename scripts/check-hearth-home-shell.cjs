const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { resolve, extname, sep } = require("node:path");
const { chromium } = require("playwright");

const phase = process.argv[2] || "full";
const validPhases = new Set(["load", "loot", "record", "full"]);
if (!validPhases.has(phase)) throw new Error(`Unknown Hearth check phase: ${phase}`);

const root = resolve(__dirname, "..");
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png"
};

const server = createServer(async (req, res) => {
  const file = resolve(root, `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`);
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const path = file === root ? resolve(root, "index.html") : file;
    const bytes = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }).end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});

async function assertBoundedHome(page) {
  await page.waitForFunction(() => window.CrownlessHearthHomeShell?.isOpen() === false, null, { timeout: 5000 });
  const geometry = await page.evaluate(() => {
    const scene = document.querySelector("#hub-screen .hearth-scene").getBoundingClientRect();
    const main = document.querySelector("main").getBoundingClientRect();
    const shelf = document.querySelector("#hearth-loot-focus").getBoundingClientRect();
    const shelfLabel = document.querySelector("#hearth-loot-focus .object-label").getBoundingClientRect();
    const journal = document.querySelector("#hearth-chronicle-focus").getBoundingClientRect();
    const gate = document.querySelector("#start-expedition").getBoundingClientRect();
    const atlasEntryNode = document.querySelector(".world-atlas-home-entry");
    const atlasEntry = atlasEntryNode ? atlasEntryNode.getBoundingClientRect() : null;
    const shelfStyle = getComputedStyle(document.querySelector("#hearth-loot-focus .object-label"));
    return {
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      sceneTop: scene.top,
      sceneBottom: scene.bottom,
      mainBottom: main.bottom,
      scrollY,
      hubGrid: document.querySelectorAll("#hub-screen .hub-grid").length,
      lootInsideFolio: Boolean(document.querySelector("#hearth-folio #secured-loot")),
      recordInsideFolio: Boolean(document.querySelector("#hearth-folio #stat-runs")),
      shelf: { left: shelf.left, right: shelf.right, top: shelf.top, bottom: shelf.bottom, width: shelf.width, height: shelf.height },
      shelfLabel: { left: shelfLabel.left, right: shelfLabel.right, top: shelfLabel.top, bottom: shelfLabel.bottom, opacity: Number(shelfStyle.opacity), visibility: shelfStyle.visibility },
      journal: { left: journal.left, right: journal.right, top: journal.top, bottom: journal.bottom },
      gate: { left: gate.left, right: gate.right, top: gate.top, bottom: gate.bottom },
      atlasEntry: atlasEntry ? { left: atlasEntry.left, right: atlasEntry.right, top: atlasEntry.top, bottom: atlasEntry.bottom, width: atlasEntry.width } : null
    };
  });

  assert.equal(geometry.hubGrid, 0, JSON.stringify(geometry));
  assert.ok(geometry.lootInsideFolio && geometry.recordInsideFolio, JSON.stringify(geometry));
  assert.ok(geometry.sceneTop >= 0, JSON.stringify(geometry));
  assert.ok(geometry.sceneBottom <= geometry.viewportHeight + 1, JSON.stringify(geometry));
  assert.ok(geometry.mainBottom <= geometry.viewportHeight + 1, JSON.stringify(geometry));
  assert.equal(geometry.scrollY, 0, JSON.stringify(geometry));

  if (geometry.viewportWidth <= 700) {
    for (const [name, rect] of [["loot shelf", geometry.shelf], ["journal", geometry.journal], ["gate", geometry.gate]]) {
      assert.ok(rect.left >= 0 && rect.right <= geometry.viewportWidth + 1, `${name} outside horizontal viewport: ${JSON.stringify(geometry)}`);
      assert.ok(rect.top >= geometry.sceneTop - 1 && rect.bottom <= geometry.viewportHeight + 1, `${name} outside vertical viewport: ${JSON.stringify(geometry)}`);
    }
    assert.ok(geometry.shelfLabel.opacity >= 0.99 && geometry.shelfLabel.visibility === "visible", `loot shelf affordance must be visible without hover: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.shelfLabel.right <= geometry.viewportWidth + 1 && geometry.shelfLabel.bottom <= geometry.viewportHeight + 1, `loot shelf label clipped: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.atlasEntry && geometry.atlasEntry.width <= 150, `Atlas entry must stay compact on the Hearth: ${JSON.stringify(geometry)}`);
    const overlapsShelf = !(geometry.atlasEntry.right <= geometry.shelf.left || geometry.atlasEntry.left >= geometry.shelf.right || geometry.atlasEntry.bottom <= geometry.shelf.top || geometry.atlasEntry.top >= geometry.shelf.bottom);
    assert.equal(overlapsShelf, false, `Atlas entry must not cover the loot shelf: ${JSON.stringify(geometry)}`);
  }

  await page.mouse.move(5, Math.min(300, geometry.viewportHeight / 2));
  await page.mouse.wheel(0, 700);
  assert.equal(await page.evaluate(() => scrollY), 0, "Grey Hearth must not scroll the browser page");
}

async function checkLoot(page) {
  const shelf = page.locator("#hearth-loot-focus");
  await shelf.click({ timeout: 5000 });
  await page.waitForSelector("#hearth-folio:not([hidden])", { timeout: 5000 });
  assert.equal(await page.locator("#hearth-folio").getAttribute("aria-hidden"), "false");
  assert.ok(await page.locator("#hearth-folio-loot").isVisible());
  assert.equal(await page.locator("#hearth-folio-record").isVisible(), false);
  assert.ok(await page.locator(".hearth-folio__close").evaluate((node) => node === document.activeElement));
  assert.equal(await page.evaluate(() => scrollY), 0);

  await page.getByRole("tab", { name: "遠征記録" }).click({ timeout: 5000 });
  assert.equal(await page.locator("#hearth-folio-loot").isVisible(), false);
  assert.ok(await page.locator("#hearth-folio-record").isVisible());
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#hearth-folio:not([hidden])").count(), 0);
  assert.ok(await shelf.evaluate((node) => node === document.activeElement));
}

async function checkRecord(page) {
  const journal = page.locator("#hearth-chronicle-focus");
  await journal.click({ timeout: 5000 });
  assert.ok(await page.locator("#hearth-folio-record").isVisible());
  assert.equal(await page.locator("#hearth-folio-title").innerText(), "遠征記録");
  await page.keyboard.press("Escape");
  assert.ok(await journal.evaluate((node) => node === document.activeElement));
}

(async () => {
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.ATLAS_BROWSER_CHANNEL ? { channel: process.env.ATLAS_BROWSER_CHANNEL } : {})
  });

  try {
    for (const viewport of [
      { width: 412, height: 720 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 1366, height: 900 }
    ]) {
      const page = await browser.newPage({ viewport, timezoneId: "Asia/Tokyo" });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await assertBoundedHome(page);

      if (phase === "loot" || phase === "full") await checkLoot(page);
      if (phase === "record" || phase === "full") await checkRecord(page);

      await assertBoundedHome(page);
      assert.deepEqual(errors, []);
      console.log(`PASS ${phase} ${viewport.width}x${viewport.height}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => server.close());
