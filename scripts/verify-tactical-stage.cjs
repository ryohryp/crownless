'use strict';
// Real Chromium input, read-only game state. Does not forge HP, discoveries or loot.
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const qa = path.join(root, '.qa/browser');
const read = page => page.evaluate(() => window.CrownlessTacticalStage.read());

function startServer() {
  const server = spawn(process.execPath, [path.join(root, 'scripts/serve-slice.cjs')], {
    cwd: root, env: {...process.env, PORT: '0'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('stage server timeout')), 10000);
    server.stdout.on('data', bytes => {
      const found = bytes.toString().match(/http:\/\/localhost:(\d+)/);
      if (found) { clearTimeout(timer); resolve(Number(found[1])); }
    });
    server.once('error', reject);
    server.once('exit', code => reject(Error('stage server exited: ' + code)));
  });
  return {server, ready};
}

async function run() {
  fs.mkdirSync(qa, {recursive: true});
  const {server, ready} = startServer();
  let browser;
  try {
    const port = await ready;
    const options = {headless: true, args: ['--no-sandbox']};
    if (process.env.CROWNLESS_CHROMIUM_PATH) options.executablePath = process.env.CROWNLESS_CHROMIUM_PATH;
    browser = await chromium.launch(options);
    for (const width of [360, 390, 430, 1280]) {
      const height = width === 1280 ? 800 : 780;
      const context = await browser.newContext({viewport: {width, height}, isMobile: width !== 1280, hasTouch: width !== 1280});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      const res = await page.goto(`http://127.0.0.1:${port}/tactical-stage.html`, {waitUntil: 'load'});
      assert.equal(res.status(), 200);
      await page.waitForFunction(() => window.CrownlessTacticalStage?.ready, {timeout: 10000});
      const snapshot = () => page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        canvas: document.getElementById('stageCanvas').getBoundingClientRect().toJSON(),
        commands: Array.from(document.querySelectorAll('#commands button')).map(b => b.getBoundingClientRect().toJSON()),
      }));
      const dimensions = await snapshot();
      assert(dimensions.canvas.height > 230, `${width}px gameplay canvas should not collapse`);
      assert(dimensions.width <= width + 1, `${width}px has horizontal overflow`);
      assert(dimensions.height <= height + 1, `${width}px has document scroll`);
      for (const box of dimensions.commands) assert(box.y + box.height <= height + 1 && box.width >= 80,
        `${width}px command button must be visible and thumb-sized`);

      if (width === 390) await page.screenshot({path: path.join(qa, 'tactical-stage-390-start.png')});
      let state = await read(page);
      assert.equal(state.discovered, false);
      assert.equal(state.phase, 'explore');
      // Actual touch on phone; on desktop, the keyboard advances one waypoint.
      if (width === 1280) await page.keyboard.press('ArrowRight');
      else {
        const box = await page.locator('#stageCanvas').boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      }
      await page.waitForFunction(() => !document.querySelector('#commands button')?.disabled);
      assert.equal((await read(page)).step, 1);
      for (let step = 2; step < 6; step++) {
        await page.locator('[data-action="advance"]').click();
        await page.waitForFunction(() => !document.querySelector('#commands button')?.disabled);
        state = await read(page);
        assert.equal(state.step, step);
        assert.equal(state.discovered, step >= 4);
      }
      assert.equal(state.phase, 'gate');
      if (width === 390) await page.screenshot({path: path.join(qa, 'tactical-stage-390-discovery.png')});
      await page.locator('[data-action="enter"]').click();
      assert.equal((await read(page)).phase, 'combat');
      await page.locator('[data-action="guard"]').click();
      assert.equal((await read(page)).opening, true);
      for (let i = 0; i < 3; i++) await page.locator('[data-action="strike"]').click();
      state = await read(page);
      assert.equal(state.phase, 'vault');
      assert(state.hp > 0);
      await page.locator('[data-action="collect"]').click();
      assert.equal((await read(page)).carried, 1);
      await page.locator('[data-action="return"]').click();
      state = await read(page);
      assert.equal(state.phase, 'returned');
      assert.equal(state.result, 'cleared');
      assert.equal(state.banked, 1);
      assert.equal(state.carried, 0);
      if (width === 390) await page.screenshot({path: path.join(qa, 'tactical-stage-390-return.png')});
      assert.deepEqual(errors, [], `${width}px page errors`);
      const storeWrites = await page.evaluate(() => localStorage.length);
      assert.equal(storeWrites, 0, 'isolated stage must not write production saves');
      await page.locator('[data-action="restart"]').click();
      assert.equal((await read(page)).step, 0);
      console.log(`tactical-stage ${width}x${height}: exploration → discovery → guard/strike → material return → restart PASS`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}

run().catch(err => {console.error(err); process.exitCode = 1;});
