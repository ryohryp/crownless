#!/usr/bin/env node
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, acceptDownloads: true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../docs/visual/adventurer-a-native-pixel-editor.html')).href);
    assert.equal(await page.locator('#view').getAttribute('width'), '512');

    await page.locator('#save').click();
    assert.match(await page.locator('#status').textContent(), /白紙/);

    const bounds = await page.locator('#view').boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#save').click();
    const download = await downloadEvent;
    assert.equal(download.suggestedFilename(), 'adventurer-a-contact-a-draft.png');

    await page.locator('#undo').click();
    await page.locator('#save').click();
    assert.match(await page.locator('#status').textContent(), /白紙/);
    assert.deepEqual(errors, []);
    console.log('PASS: 390px canvas paint, export, undo and blank guard');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
