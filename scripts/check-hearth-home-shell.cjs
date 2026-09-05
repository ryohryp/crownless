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
    return {
      viewportHeight: innerHeight,
      sceneTop: scene.top,
      sceneBottom: scene.bottom,
      mainBottom: main.bottom,
      scrollY,
      hubGrid: document.querySelectorAll("#hub-screen .hub-grid").length,
      lootInsideFolio: Boolean(document.querySelector("#hearth-folio #secured-loot")),
      recordInsideFolio: Boolean(document.querySelector("#hearth-folio #stat-runs"))
    };
  });

  assert.equal(geometry.hubGrid, 0, JSON.stringify(geometry));
  assert.ok(geometry.lootInsideFolio && geometry.recordInsideFolio, JSON.stringify(geometry));
  assert.ok(geometry.sceneTop >= 0, JSON.stringify(geometry));
  assert.ok(geometry.sceneBottom <= geometry.viewportHeight + 1, JSON.stringify(geometry));
  assert.ok(geometry.mainBottom <= geometry.viewportHeight + 1, JSON.stringify(geometry));
  assert.equal(geometry.scrollY, 0, JSON.stringify(geometry));

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
