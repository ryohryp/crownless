"use strict";
// Mobile Chromium evidence for the isolated knockback experiment; no GPS or game saves.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

async function start(server) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("impact lab server timeout")), 10000);
    server.stdout.on("data", data => {
      output += data.toString();
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    });
    server.on("error", reject);
    server.on("exit", code => reject(new Error("server exited early: " + code)));
  });
}

async function run() {
  const { chromium } = require("playwright");
  const server = spawn(process.execPath, ["scripts/serve-slice.cjs"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.pipe(process.stderr);
  let browser;
  try {
    const port = await start(server);
    browser = await chromium.launch({ headless: true });
    const output = path.resolve(__dirname, "../.qa/browser");
    await fs.mkdir(output, { recursive: true });
    for (const width of [360, 390]) {
      const height = width === 360 ? 800 : 844;
      const context = await browser.newContext({
        viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://127.0.0.1:" + port + "/combat-lab.html");
      await page.locator("#attack").waitFor();
      const touch = await page.evaluate(() => {
        const btn = document.querySelector("#attack"), r = btn.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { width: document.documentElement.scrollWidth, height: innerHeight,
          buttonVisible: r.width >= 80 && r.right <= innerWidth && r.bottom <= innerHeight,
          buttonUnobstructed: hit === btn || btn.contains(hit),
          canvasHeight: document.querySelector("#arena").getBoundingClientRect().height };
      });
      assert.ok(touch.buttonVisible && touch.buttonUnobstructed && touch.canvasHeight > 200,
        "phone controls must fit and receive a tap: " + JSON.stringify(touch));
      assert.ok(touch.width <= width + 1, "no horizontal page overflow");
      assert.match(await page.locator("#count").innerText(), /3 \/ 3/);
      const initialStorageLength = await page.evaluate(() => localStorage.length);
      // Approach, then HOLD attack: exercises the same held-input path as a touch.
      await page.keyboard.down("d");
      await page.waitForTimeout(550);
      await page.keyboard.up("d");
      await page.keyboard.down("j");
      await page.waitForFunction(() => /巻き込み\s+[1-9]/.test(
        document.querySelector("#stats").textContent), null, { timeout: 6000 });
      await page.keyboard.up("j");
      assert.equal(errors.length, 0, "no JS runtime exceptions: " + errors.join("; "));
      assert.equal(await page.evaluate(() => localStorage.length), initialStorageLength,
        "isolated combat does not touch expedition or GPS saves");
      await page.screenshot({ path: path.join(output, "impact-lab-" + width + ".png") });
      await page.locator("#reset").click();
      assert.match(await page.locator("#count").innerText(), /3 \/ 3/);
      await context.close();
    }
    console.log("impact lab: 360px and 390px hit + chain + reset: PASS");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
