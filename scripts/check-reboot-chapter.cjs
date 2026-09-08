// Exercise real controllers together; mock only the device/storage boundaries.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const { chromium } = require('playwright');
const root = resolve(__dirname, '..');
const server = createServer(async (req, res) => {
  const file = resolve(root, `.${new URL(req.url, 'http://localhost').pathname}`);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream' }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
async function click(page, selector) { await page.locator(selector).click(); }
async function bounded(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
}
async function chapter(page, choices) {
  await click(page, '#start-sim');
  await click(page, '#check-location');
  await click(page, '#check-location');
  await click(page, '#scene-continue');
  await click(page, `[data-choice="${choices.bell}"]`);
  await click(page, '#dev-walk-next');
  await click(page, '#crossing-continue');
  await click(page, `[data-choice="${choices.crossing}"]`);
  await click(page, '#dev-walk-hill');
  await click(page, '#hill-continue');
  await click(page, `[data-choice="${choices.hill}"]`);
  await page.locator('#phase6-navigation').waitFor({ state: 'visible' });
  await click(page, '[data-move="north"]');
  assert.ok((await page.locator('#phase8-copy').textContent()).length > 10);
  await click(page, '[data-move="south"]');
  for (let i = 0; i < 3; i++) await click(page, `[data-move="${choices.direction}"]`);
  await page.locator('#collision-summary').waitFor({ state: 'visible' });
  await bounded(page);
  await click(page, '#dev-walk-collision');
  await page.locator('#chapter-ending').waitFor({ state: 'visible' });
  await click(page, '#chapter-journal summary');
  assert.equal(await page.locator('#chapter-places button').count(), 6);
  await click(page, '#chapter-places button[data-memory="bell_tower"]');
  assert.equal(await page.locator('#chapter-memory-title').textContent(), choices.bell === 'ring_bell' ? '王の烽火' : '自由民の隠れ家');
  await bounded(page);
}
(async () => {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/reboot.html`;
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const output = process.env.REBOOT_SCREENSHOT_DIR || '/tmp/reboot-qa';
  await mkdir(output, { recursive: true });
  try {
    let count = 0;
    for (const bell of ['ring_bell', 'break_bell']) for (const crossing of ['cut_crossing', 'keep_crossing']) {
      for (const hill of ['signal_chapel', 'signal_gate']) for (const direction of ['west', 'south_west']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await chapter(page, { bell, crossing, hill, direction });
        const before = await page.evaluate(() => localStorage.getItem('crownless.reboot.v1'));
        assert.doesNotMatch(before, /latitude|longitude|accuracy|routeHistory/);
        await page.reload();
        await page.locator('#chapter-ending').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => localStorage.getItem('crownless.reboot.v1')), before);
        if (count === 0) {
          await page.screenshot({ path: `${output}/chapter-phone.png`, fullPage: true });
          await page.setViewportSize({ width: 320, height: 568 });
          await bounded(page);
          await page.screenshot({ path: `${output}/chapter-small-phone.png`, fullPage: true });
          await page.setViewportSize({ width: 1366, height: 900 });
          await bounded(page);
          await page.screenshot({ path: `${output}/chapter-desktop.png`, fullPage: true });
        }
        count++;
        await context.close();
      }
    }
    const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
    const blockedPage = await blocked.newPage();
    blockedPage.on('pageerror', error => errors.push(error.message));
    await blockedPage.goto(url);
    await chapter(blockedPage, { bell: 'break_bell', crossing: 'keep_crossing', hill: 'signal_gate', direction: 'west' });
    assert.match(await blockedPage.locator('#persistence-note').textContent(), /このタブ内だけ/);
    await blocked.close();
    const live = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await live.addInitScript(() => {
      window.gpsSamples = []; window.gpsCalls = 0;
      Object.defineProperty(navigator, 'geolocation', { value: {
        getCurrentPosition(ok, fail) {
          window.gpsCalls++;
          const value = window.gpsSamples.shift();
          window.pendingFix = () => value && value.error ? fail({ code: value.error }) : ok({ coords: value });
        }
      } });
    });
    const page = await live.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    async function fix(selector, value) {
      await page.evaluate(value => { window.gpsSamples.push(value); }, value);
      const before = await page.evaluate(() => window.gpsCalls);
      await click(page, selector);
      assert.equal(await page.locator(selector).isDisabled(), true);
      await page.evaluate(selector => document.querySelector(selector).click(), selector);
      const calls = await page.evaluate(() => window.gpsCalls);
      assert.equal(calls, before + 1);
      await page.evaluate(() => window.pendingFix());
      assert.equal(await page.evaluate(() => window.gpsCalls), calls);
    }
    await fix('#start-live', { error: 1 });
    assert.equal(await page.locator('#start-sim').isVisible(), true);
    assert.equal(await page.locator('#check-location').isVisible(), true);
    assert.match(await page.locator('#location-status').textContent(), /許可されていない/);
    const origin = { latitude: 35, longitude: 139, accuracy: 8 };
    const moved = { latitude: 35.001, longitude: 139, accuracy: 8 };
    await fix('#check-location', origin);
    await fix('#check-location', moved);
    await click(page, '#scene-continue');
    await click(page, '[data-choice="ring_bell"]');
    await fix('#phase2-live', { error: 2 });
    await fix('#phase2-live', origin);
    await fix('#phase2-live', origin);
    assert.match(await page.locator('#location-status').textContent(), /まだ古い渡り場/);
    await fix('#phase2-live', moved);
    await click(page, '#crossing-continue');
    await click(page, '[data-choice="keep_crossing"]');
    await fix('#phase3-live', { error: 3 });
    await fix('#phase3-live', origin);
    await fix('#phase3-live', moved);
    await click(page, '#hill-continue');
    await click(page, '[data-choice="signal_gate"]');
    await fix('#phase6-live-start', origin);
    await fix('#phase6-live-check', { latitude: 35, longitude: 138.9984, accuracy: 8 });
    await page.locator('#collision-live').waitFor({ state: 'visible' });
    await fix('#collision-live', origin);
    await fix('#collision-live', moved);
    await page.locator('#chapter-ending').waitFor({ state: 'visible' });
    await page.reload();
    await page.locator('#chapter-ending').waitFor({ state: 'visible' });
    await live.close();
    assert.deepEqual(errors, []);
    console.log('Reboot: 16 branches, reload, blocked storage, full GPS flow, recovery and viewports passed.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
