'use strict';
// Phone-sized real Chromium smoke. Neither renderer may touch GPS or local saves.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function listen(server) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('renderer lab server did not start')), 10000);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error('renderer lab server stopped: ' + code)));
  });
}

async function main() {
  const { chromium } = require('playwright');
  const server = spawn(process.execPath, ['scripts/serve-slice.cjs'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr.pipe(process.stderr);
  let browser;
  try {
    const port = await listen(server);
    browser = await chromium.launch({ headless: true });
    for (const engine of ['pixi', 'phaser']) {
      for (const width of [360, 390, 430]) {
        const context = await browser.newContext({
          viewport: { width, height: 800 }, isMobile: true,
          hasTouch: true, deviceScaleFactor: 1
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto('http://127.0.0.1:' + port +
            '/experiments/renderer-lab/index.html?engine=' + engine,
            { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForFunction(() => window.__rendererLab?.ready === true,
            null, { timeout: 25000 });
          const geometry = await page.evaluate(() => {
            const stage = document.getElementById('stage').getBoundingClientRect();
            const controls = document.getElementById('move-right').getBoundingClientRect();
            const canvas = document.querySelector('#stage canvas').getBoundingClientRect();
            return { stageWidth: stage.width, stageHeight: stage.height,
              canvasWidth: canvas.width, canvasHeight: canvas.height,
              controlsBottom: controls.bottom,
              docWidth: document.documentElement.scrollWidth,
              viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
          });
          assert(geometry.stageWidth >= 280 && geometry.stageHeight >= 180,
            engine + '/' + width + ' stage must be visible: ' + JSON.stringify(geometry));
          assert(geometry.canvasWidth > 250 && geometry.canvasHeight > 180,
            engine + '/' + width + ' canvas must fit stage');
          assert(geometry.controlsBottom <= geometry.viewportHeight,
            engine + '/' + width + ' control must be visible');
          assert(geometry.docWidth <= geometry.viewportWidth + 2,
            engine + '/' + width + ' page must not scroll horizontally');

          const initialX = await page.evaluate(() => window.__rendererLab.state.x);
          const right = page.locator('#move-right');
          const rect = await right.boundingBox();
          await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(120);
          await page.mouse.up();
          await page.waitForTimeout(80);
          const moved = await page.evaluate(() => window.__rendererLab.state.x);
          assert(moved > initialX, engine + '/' + width + ' must respond to held right button');

          if (engine === 'pixi') {
            assert.equal(await page.locator('#fx-toggle').isVisible(), true);
            assert.equal(await page.locator('#fx-toggle').getAttribute('aria-pressed'), 'true');
            assert.equal(await page.evaluate(() => window.__rendererLabEffectsReady), true);
            await page.locator('#fx-toggle').click();
            assert.equal(await page.evaluate(() => window.__rendererLabEffectsDebug.enabled), false);
            await page.locator('#fx-toggle').click();
            assert.equal(await page.evaluate(() => window.__rendererLabEffectsDebug.enabled), true);
          } else {
            assert.equal(await page.locator('#fx-toggle').isVisible(), false);
          }

          // Use public controls for gathering; x assignment isolates scene input from travel time.
          await page.evaluate(() => { window.__rendererLab.state.x = 260; });
          await page.locator('#interact').click();
          assert.equal(await page.evaluate(() => window.__rendererLab.state.heldHerbs), 1,
            engine + '/' + width + ' player must gather herbs');
          if (engine === 'pixi') {
            await page.waitForFunction(() =>
              window.__rendererLabEffectsDebug.particleCount > 0,
              null, { timeout: 3000 });
          }
          assert.deepEqual(errors, [], engine + '/' + width + ' page errors');
          assert.equal(await page.evaluate(() => localStorage.length), 0,
            'the experiment must not create local player saves');
          console.log('renderer smoke OK:', engine, width, geometry.stageHeight);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
