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
        // Start in the real neighborhood scene, not via an invented deep link.
        // Demo uses the same discovered-district selection UI as walk mode.
        await page.goto('http://127.0.0.1:' + port + '/expedition.html', {
          waitUntil: 'domcontentloaded', timeout: 30000,
        });
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        assert.equal(await page.locator('.nearby-track-tile.selected.track-wood').count(),1,
          'a discovered woodland must be selected before the action gateway appears');
        const mainAction = page.locator('.nearby-card-actions button:first-child');
        assert.equal(await mainAction.getAttribute('data-action'), 'action-forest-lab',
          'the most prominent forest departure must start real-time combat');
        assert.match(await mainAction.innerText(), /アクション遠征/);
        const saveBefore = await page.evaluate(
          () => localStorage.getItem('crownless-expedition-v1-demo'));
        await mainAction.click();
        await page.waitForURL('**/gemini-feel-lab.html?from=discovered-wood');
        assert.equal(await page.evaluate(
          () => localStorage.getItem('crownless-expedition-v1-demo')), saveBefore,
          'entering action combat must not mutate production saves');
        await page.goto('http://127.0.0.1:' + port + '/gemini-feel-lab.html?from=discovered-wood', {
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
        assert.equal(await page.locator('#rpgPanel').isVisible(), false,
          'combat starts immediately without an RPG menu blocking original touch controls');
        assert.match(await page.locator('#rpgStatusBadge').innerText(), /未帰還 0.*倉庫 0.*初期装備/,
          'run starts with no material and no forged weapon');
        assert.equal(await page.evaluate(() => typeof window.CrownlessRpgLoop.forge), 'function',
          'isolated smithing rules load in the real browser');

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
        // Simulate a completed safe return through the same pure rules,
        // then prove the real browser restores ONLY banked/crafted values.
        await page.evaluate(() => {
          const r = window.CrownlessRpgLoop.create();
          for (let i = 0; i < 3; i++) window.CrownlessRpgLoop.claimMaterial(r);
          window.CrownlessRpgLoop.clearWave(r);
          window.CrownlessRpgLoop.returnAlive(r, 80);
          localStorage.setItem('crownless-action-forest-v1-demo', window.CrownlessActionSave.encode(r));
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#rpgStatusBadge')?.textContent.includes('倉庫 3'));
        assert.match(await page.locator('#rpgStatusBadge').innerText(), /未帰還 0.*倉庫 3.*初期装備/);
        assert.equal(await page.locator('#rpgPanel').isVisible(), false,
          'resuming must start a fresh expedition with no popup blocking combat');
        await page.evaluate(() => {
          const r = window.CrownlessRpgLoop.create();
          r.phase = 'camp';
          r.banked = 3;
          window.CrownlessRpgLoop.forge(r);
          localStorage.setItem('crownless-action-forest-v1-demo', window.CrownlessActionSave.encode(r));
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#rpgStatusBadge')?.textContent.includes('風裂きの剣'));
        assert.match(await page.locator('#rpgStatusBadge').innerText(), /未帰還 0.*倉庫 0.*風裂きの剣/);
        assert.equal(await page.evaluate(
          () => localStorage.getItem('crownless-expedition-v1-demo')), saveBefore,
          'lab visits and saved smith equipment must never mutate the actual RPG save');
        // Bad records are diagnosed rather than rewritten or called saved.
        await page.evaluate(() => localStorage.setItem('crownless-action-forest-v1-demo', '{"version":999}'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('#rpgSaveWarning').isVisible(), true);
        assert.match(await page.locator('#rpgSaveWarning').innerText(), /上書きを防ぐため/);
        assert.equal(await page.evaluate(
          () => localStorage.getItem('crownless-action-forest-v1-demo')), '{"version":999}');
        assert.equal(errors.length, 0, 'no runtime errors after isolated save restore tests');

      } finally {
        await context.close();
      }
    }
    console.log('Gemini-feel fantasy baseline: 360px/390px, real hit + shop + companion toggle + isolated return/forge reload PASS');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
