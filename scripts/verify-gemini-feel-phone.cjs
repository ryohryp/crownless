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
          const a = document.querySelector('#gestureActionArea').getBoundingClientRect();
          const top = document.elementFromPoint(a.x + a.width * 0.7, a.y + a.height * 0.7);
          const canvas = document.querySelector('#gameCanvas');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
            canvasHeight: canvas.getBoundingClientRect().height,
            gestureWidth: a.width, gestureHeight: a.height,
            gestureTouchable: top === document.querySelector('#gestureActionArea') ||
              document.querySelector('#gestureActionArea').contains(top),
            names: window.__combatLabCanvasText.filter(v => v.includes('ゴブリン')).slice(0, 4),
          };
        });
        assert(status.gestureTouchable && status.gestureWidth >= 130 && status.canvasHeight >= 180,
          'right-side touch combat region must be reachable: ' + JSON.stringify(status));
        assert.equal(await page.locator('#arcadeActionButtons').isVisible(), false,
          'action buttons should not obscure fighters in gesture mode');
        assert.equal(await page.evaluate(() => typeof window.CrownlessActionBarrierReadout), 'undefined',
          'moving fence has been removed instead of hidden');
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
        // Phone touch gameplay without obstructive arcade buttons. Actual
        // pointer movements exercise the right-side action area.
        const gesture = page.locator('#gestureActionArea');
        const zone = await gesture.boundingBox();
        assert(zone && zone.width >= 130, 'right thumb combat region must exist');
        const x = zone.x + zone.width * 0.55;
        const y = zone.y + zone.height * 0.65;
        const read=() => page.evaluate(() => window.CrownlessGestureReadout());
        assert.equal((await read()).mode,'gesture');
        await page.touchscreen.tap(x,y);
        assert.equal((await read()).lastAction,'punch','tap must attack');
        for (const [dx,dy,expected] of [[65,0,'kick'],[0,-75,'jump'],[0,75,'grab']]) {
          const before=(await read()).count;
          await page.mouse.move(x,y);
          await page.mouse.down();
          await page.mouse.move(x+dx,y+dy,{steps:6});
          await page.mouse.up();
          assert.equal((await read()).lastAction,expected,'swipe action '+expected);
          assert.equal((await read()).count,before+1,'one swipe triggers only one action');
        }
        const after=(await read()).count;
        await gesture.dispatchEvent('pointercancel',{pointerId:4096});
        assert.equal((await read()).count,after,'cancelled gesture never attacks');
        await page.screenshot({
          path:path.resolve(__dirname,'../.qa/browser/gesture-combat-'+width+'.png'),
        });
        await page.locator('#btnToggleInput').click();
        assert.equal((await read()).mode,'buttons');
        assert.equal(await page.locator('#arcadeActionButtons').isVisible(),true);
        assert.equal(await page.locator('#gestureActionArea').isVisible(),false);
        const buttonProof=await page.evaluate(() => {
          const stage=document.getElementById('stageViewport').getBoundingClientRect();
          const btn=document.getElementById('btnPunch').getBoundingClientRect();
          return {stageBottom:stage.bottom,buttonTop:btn.top};
        });
        assert(buttonProof.buttonTop>=buttonProof.stageBottom-2,
          'legacy buttons live below canvas, not on top of fighters: '+JSON.stringify(buttonProof));
        await page.locator('#btnToggleInput').click();
        assert.equal((await read()).mode,'gesture');
        assert.equal(await page.locator('#arcadeActionButtons').isVisible(),false);
        assert.equal(errors.length, 0, 'no errors in gesture and legacy input modes');
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
