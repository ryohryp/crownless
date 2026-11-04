#!/usr/bin/env node
/* Browser smoke for the isolated Pixelorama key-pose review; no runtime mutation. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function pngSheet(page, repeated = false) {
  return page.evaluate(repeatedPose => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    for (let frame = 0; frame < 4; frame++) {
      context.fillStyle = '#162d51';
      context.fillRect(frame * 128 + 20 + (repeatedPose ? 0 : frame * 3), 30, 30, 80);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, repeated);
}

async function main() {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const file = path.resolve(__dirname, '../docs/visual/adventurer-a-walk-review.html');
    await page.goto(pathToFileURL(file).href);
    assert.equal(await page.locator('#play').isDisabled(), true);
    assert.equal(await page.locator('.stage figure img').first().evaluate(image => image.naturalWidth), 128);

    const atlas = await pngSheet(page);
    await page.locator('#atlas').setInputFiles({
      name: 'keyposes.png', mimeType: 'image/png', buffer: Buffer.from(atlas, 'base64')
    });
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('技術チェック通過'));
    assert.equal(await page.locator('#play').isDisabled(), false);
    await page.locator('#next').click();
    assert.match(await page.locator('#frame-number').textContent(), /フレーム 2 \/ 4/);
    await page.locator('#onion').check();
    assert.equal(await page.locator('#ghost').evaluate(el => getComputedStyle(el).display), 'block');
    await page.locator('#play').click();
    assert.equal(await page.locator('#play').textContent(), '■ 停止');
    await page.locator('#play').click();

    const duplicate = await pngSheet(page, true);
    await page.locator('#atlas').setInputFiles({
      name: 'duplicate.png', mimeType: 'image/png', buffer: Buffer.from(duplicate, 'base64')
    });
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('同一内容のコマがあります'));
    assert.equal(await page.locator('#play').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: 390px Pixelorama review, import, scrub, onion, play, repeated-frame reject');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
