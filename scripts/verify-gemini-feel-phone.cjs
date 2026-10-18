'use strict';
// Chromium smoke for the human-selected Gemini-based combat feel baseline.
// Observe real DOM/canvas output without adding hooks to the original battle engine.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

function listen(server) {
  return new Promise((resolve, reject) => {
    let out = '';
    const timeout = setTimeout(() => reject(new Error('server start timed out')), 10000);
    server.stdout.on('data', data => {
      out += data.toString();
      const found = out.match(/http:\/\/localhost:(\d+)/);
      if (found) { clearTimeout(timeout); resolve(Number(found[1])); }
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error('server exited: ' + code)));
  });
}

async function main() {
  const { chromium } = require('playwright');
  const server = spawn(process.execPath, ['scripts/serve-slice.cjs'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.pipe(process.stderr);
  let browser;
  try {
    const port = await listen(server);
    browser = await chromium.launch({ headless: true });
    await fs.mkdir(path.resolve(__dirname, '../.qa/browser'), { recursive: true });

    for (const width of [360, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 360 ? 800 : 844 },
        isMobile: true, hasTouch: true, deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.addInitScript(() => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        window.__combatLabCanvasText = [];
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          const text = String(value);
          if (window.__combatLabCanvasText.length < 3000) {
            window.__combatLabCanvasText.push(text);
          }
          return original.call(this, value, ...args);
        };
      });
      try {
        await page.goto('http://127.0.0.1:' + port + '/gemini-feel-lab.html', {
          waitUntil: 'domcontentloaded', timeout: 30000,
        });
        await page.waitForFunction(() => {
          const canvas = document.querySelector('#gameCanvas');
          return !!canvas && canvas.width > 0 && window.__combatLabCanvasText.includes('旅人 [1P]');
        }, null, { timeout: 15000 });

        const status = await page.evaluate(() => {
          const a = document.querySelector('#btnPunch').getBoundingClientRect();
          const top = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
          const canvas = document.querySelector('#gameCanvas');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
            canvasHeight: canvas.getBoundingClientRect().height,
            buttonWidth: a.width, buttonHeight: a.height,
            punchTouchable: top === document.querySelector('#btnPunch') ||
              document.querySelector('#btnPunch').contains(top),
            names: window.__combatLabCanvasText.filter(v => v.includes('ゴブリン')).slice(0, 4),
          };
        });
        assert(status.punchTouchable && status.buttonWidth >= 60 && status.canvasHeight >= 180,
          'real thumb punch must be reachable: ' + JSON.stringify(status));
        assert(status.scrollWidth <= width + 1, 'no full-document horizontal overflow');

        // Walk close to the original enemy wave and hold attack as the original invites.
        await page.keyboard.down('d');
        await page.waitForTimeout(800);
        await page.keyboard.up('d');
        await page.keyboard.down('j');
        await page.waitForFunction(
          () => window.__combatLabCanvasText.some(v => /^-\d+$/.test(v)),
          null, { timeout: 8000 }
        );
        await page.keyboard.up('j');
        assert.equal(errors.length, 0, 'no runtime errors: ' + errors.join('; '));
        await page.screenshot({
          path: path.resolve(__dirname, '../.qa/browser/gemini-feel-lab-' + width + '.png'),
        });

        await page.locator('#btnOpenShop').click();
        assert.equal(await page.locator('#shopModal').isVisible(), true, 'skills shop still works');
        await page.locator('#btnCloseShop').click();
        assert.equal(await page.locator('#shopModal').isVisible(), false);
        await page.locator('#btnToggleAI').click();
        assert.match(await page.locator('#btnToggleAI').innerText(), /2P|相棒|同行/);
      } finally {
        await context.close();
      }
    }
    console.log('Gemini-feel fantasy baseline: 360px/390px, real hit + shop + companion toggle PASS');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
