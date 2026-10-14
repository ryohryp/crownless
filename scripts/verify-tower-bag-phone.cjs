"use strict";

// A focused real-phone regression for the tower's at-risk crafting materials.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

function waitForPort(server) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("game server startup timeout")), 10000);
    server.stdout.setEncoding("utf8");
    server.stderr.pipe(process.stderr);
    server.stdout.on("data", chunk => {
      output += chunk;
      const found = output.match(/http:\/\/localhost:(\d+)/);
      if (found) { clearTimeout(timeout); resolve(Number(found[1])); }
    });
    server.once("error", reject);
    server.once("exit", code => reject(new Error("game server exited: " + code)));
  });
}

async function main() {
  const output = path.resolve(__dirname, "../.qa/browser");
  await fs.mkdir(output, { recursive: true });
  const server = spawn(process.execPath, ["scripts/serve-slice.cjs"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let browser;
  try {
    const port = await waitForPort(server);
    browser = await chromium.launch({ headless: true });
    for (const width of [360, 390]) {
      const height = width === 360 ? 800 : 844;
      const context = await browser.newContext({
        viewport: { width, height }, isMobile: true, hasTouch: true
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const saved = () => page.evaluate(() =>
        JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
      const bag = page.locator('[data-tower-bag="true"]');
      try {
        await page.goto("http://127.0.0.1:" + port + "/expedition.html");
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
        await page.locator('[data-action="scout"][data-value="tower"]').click();
        await page.locator('.nearby-track-tile[data-value="0,1"]').click();
        await page.locator('.district-detail [data-action="depart"][data-value="tower"]').click();
        assert.match(await bag.innerText(), /鐘鉄 0 · 鉄片 0/);
        for (const id of [21, 22, 23, 18, 13]) {
          await page.locator('.tower-field [data-action="tower-step"][data-value="' + id + '"]').click();
        }
        assert.equal((await saved()).expedition.tower.pos, 13);
        await page.locator('[data-action="tower-cache-iron"]').click();
        assert.equal((await saved()).expedition.materials.watchIron, 1);
        assert.equal((await saved()).materials.watchIron, 0);
        assert.match(await bag.innerText(), /鐘鉄 1 · 鉄片 0/);
        assert.match(await bag.innerText(), /生還で確定 · 倒れれば失う/);
        await bag.scrollIntoViewIfNeeded();
        const bounds = await bag.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top,
            bottom: rect.bottom, width: el.scrollWidth - el.clientWidth };
        });
        assert(bounds.left >= -1 && bounds.right <= width + 1 &&
          bounds.top >= -1 && bounds.bottom <= height + 2 && bounds.width <= 1,
          "bag must fit phone viewport: " + JSON.stringify(bounds));
        await page.screenshot({ path: path.join(output, "tower-bag-" + width + ".png") });
        await page.reload();
        assert.match(await bag.innerText(), /鐘鉄 1 · 鉄片 0/,
          "saved carried loot must be visible after reload");
        await page.locator('.field-choices [data-action="return"]').click();
        assert.equal((await saved()).materials.watchIron, 1,
          "safe return must bank collected iron");
        assert.equal((await saved()).expedition, null);
        assert.deepEqual(errors, [], "no browser JS errors");
      } finally {
        await context.close();
      }
    }
    console.log("[tower-bag-phone] PASS: 360x800 and 390x844, gather, reload, return");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
