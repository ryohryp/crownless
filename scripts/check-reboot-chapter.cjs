// Exercise the current Reboot controllers together; mock only browser device/storage boundaries.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const { chromium } = require('playwright');

const root = resolve(__dirname, '..');
const REBOOT_KEY = 'crownless.reboot.v1';
const INTERNAL_ENDING_TERMS = /ring_bell|break_bell|cut_crossing|keep_crossing|signal_chapel|signal_gate|salt_chapel|ruined_gate|GPSとDEV|transition|DEV PATH/;

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, `.${pathname}`);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    const type = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }).end(bytes);
  } catch (_error) {
    res.writeHead(404).end();
  }
});

async function click(page, selector) {
  await page.locator(selector).click();
}

async function bounded(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  assert.ok(metrics.documentWidth <= metrics.viewport + 1, `${label}: document has no horizontal overflow`);
  assert.ok(metrics.bodyWidth <= metrics.viewport + 1, `${label}: body has no horizontal overflow`);
}

async function assertHillCausality(page, hillChoice) {
  const expected = hillChoice === 'signal_chapel' ? '谷見の丘' : '道見の丘';
  const label = page.locator('.hill-label');
  assert.equal(await label.textContent(), expected);
  const labelOpacity = Number(await label.evaluate((node) => getComputedStyle(node).opacity));
  assert.ok(labelOpacity >= 0.9, `hill label remains readable after choice (${labelOpacity})`);
  assert.equal(await page.locator('.second-consequence-line').evaluate((node) => getComputedStyle(node).display), 'block');
}

async function reachHillChoice(page, choices) {
  await click(page, '#start-sim');
  await click(page, '#check-location');
  await click(page, '#check-location');
  await page.locator('#scene-continue').waitFor({ state: 'visible' });
  await click(page, '#scene-continue');
  await click(page, `[data-choice="${choices.bell}"]`);
  await page.locator('#dev-walk-next').waitFor({ state: 'visible' });
  await click(page, '#dev-walk-next');
  await click(page, '#crossing-continue');
  await click(page, `[data-choice="${choices.crossing}"]`);
  await page.locator('#dev-walk-hill').waitFor({ state: 'visible' });
  await click(page, '#dev-walk-hill');
  await click(page, '#hill-continue');
  await click(page, `[data-choice="${choices.hill}"]`);
  await page.locator('#phase6-navigation').waitFor({ state: 'visible' });
  await assertHillCausality(page, choices.hill);
}

async function finishBySimulatedMovement(page, visit) {
  await click(page, '[data-move="north"]');
  assert.ok((await page.locator('#phase8-copy').textContent()).trim().length > 10);
  await click(page, '[data-move="south"]');
  const direction = visit === 'salt_chapel' ? 'south_west' : 'west';
  for (let i = 0; i < 3; i += 1) await click(page, `[data-move="${direction}"]`);
  await page.locator('#collision-summary').waitFor({ state: 'visible' });
  await click(page, '#dev-walk-collision');
  await page.locator('#reboot-ending').waitFor({ state: 'visible' });
}

async function assertEnding(page, choices) {
  const ending = page.locator('#reboot-ending');
  const text = await ending.textContent();
  assert.equal(await ending.locator('.land-memory-card').count(), 6);
  assert.equal(await ending.locator('.land-memory-state').count(), 6);
  assert.doesNotMatch(text, INTERNAL_ENDING_TERMS);
  assert.match(text, choices.bell === 'ring_bell' ? /鐘を鳴らした/ : /鐘を壊した/);
  assert.match(text, choices.crossing === 'cut_crossing' ? /渡りを断った/ : /渡りを残した/);
  assert.match(text, choices.hill === 'signal_chapel' ? /谷へ合図した/ : /街道へ合図した/);
  assert.match(text, choices.visit === 'salt_chapel' ? /塩の礼拝堂へ先に向かった/ : /朽ちた関門へ先に向かった/);

  const chapelStatus = await ending.locator('[data-place="salt_chapel"] .land-memory-state').textContent();
  const gateStatus = await ending.locator('[data-place="ruined_gate"] .land-memory-state').textContent();
  assert.equal(chapelStatus, choices.visit === 'salt_chapel' ? '訪問した' : '未訪問: 世界は進んだ');
  assert.equal(gateStatus, choices.visit === 'ruined_gate' ? '訪問した' : '未訪問: 世界は進んだ');
}

async function chapter(page, choices) {
  await reachHillChoice(page, choices);
  await finishBySimulatedMovement(page, choices.visit);
  await assertEnding(page, choices);
  const save = await page.evaluate((key) => localStorage.getItem(key), REBOOT_KEY);
  if (save !== null) assert.doesNotMatch(save, /latitude|longitude|accuracy|routeHistory|movementTrack|mapOrigin|representativeCoordinate/);
  await bounded(page, 'chapter');
  return save;
}

async function verifyAllBranches(browser, url, output, errors) {
  let count = 0;
  for (const bell of ['ring_bell', 'break_bell']) {
    for (const crossing of ['cut_crossing', 'keep_crossing']) {
      for (const hill of ['signal_chapel', 'signal_gate']) {
        for (const visit of ['salt_chapel', 'ruined_gate']) {
          const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
          const page = await context.newPage();
          page.on('pageerror', (error) => errors.push(`branch ${bell}/${crossing}/${hill}/${visit}: ${error.message}`));
          await page.goto(url);
          const choices = { bell, crossing, hill, visit };
          const before = await chapter(page, choices);
          assert.ok(before, 'normal persistent run writes the Reboot save');
          await page.reload();
          await page.locator('#reboot-ending').waitFor({ state: 'visible' });
          await assertEnding(page, choices);
          assert.equal(await page.evaluate((key) => localStorage.getItem(key), REBOOT_KEY), before, 'reload is idempotent');

          if (count === 0) {
            await page.screenshot({ path: `${output}/reboot-390.png`, fullPage: true });
            await page.setViewportSize({ width: 320, height: 568 });
            await bounded(page, '320px');
            await page.screenshot({ path: `${output}/reboot-320.png`, fullPage: true });
            await page.setViewportSize({ width: 1366, height: 900 });
            await bounded(page, '1366px');
            await page.screenshot({ path: `${output}/reboot-1366.png`, fullPage: true });
          }
          count += 1;
          await context.close();
        }
      }
    }
  }
  assert.equal(count, 16);
}

function installStorageFailure(context, kind) {
  return context.addInitScript((failureKind) => {
    if (failureKind === 'read') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('blocked read', 'SecurityError'); }
      });
      return;
    }

    const backing = new Map();
    const fakeStorage = {
      get length() { return backing.size; },
      key(index) { return [...backing.keys()][index] || null; },
      getItem(key) { return backing.has(String(key)) ? backing.get(String(key)) : null; },
      setItem() {
        if (failureKind === 'quota') throw new DOMException('quota exceeded', 'QuotaExceededError');
        throw new DOMException('blocked write', 'SecurityError');
      },
      removeItem() { throw new DOMException('blocked remove', 'SecurityError'); },
      clear() { throw new DOMException('blocked clear', 'SecurityError'); }
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: fakeStorage });
  }, kind);
}

async function verifyStorageFallbacks(browser, url, errors) {
  for (const kind of ['read', 'write', 'quota']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await installStorageFailure(context, kind);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`storage ${kind}: ${error.message}`));
    await page.goto(url);
    const choices = { bell: 'break_bell', crossing: 'keep_crossing', hill: 'signal_gate', visit: 'ruined_gate' };
    await chapter(page, choices);
    assert.match(await page.locator('#persistence-note').textContent(), /保存不可/);
    assert.equal(await page.locator('body').getAttribute('data-persistence'), 'memory-only');

    page.once('dialog', (dialog) => dialog.accept());
    await click(page, '#reboot-dev-reset');
    assert.match(await page.locator('#location-status').textContent(), /削除できなかった.*再読み込みはしない/);
    await page.locator('#reboot-ending').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#reboot-ending .land-memory-card').count(), 6, 'failed reset preserves same-tab ending');
    await context.close();
  }
}

function installGpsMock(context, { neverReturn = false, fastLongTimers = false } = {}) {
  return context.addInitScript(({ neverReturn: shouldNeverReturn, fastLongTimers: shouldFastForward }) => {
    if (shouldFastForward) {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, Number(delay) >= 10000 ? 35 : delay, ...args);
    }
    window.__gpsSamples = [];
    window.__gpsCalls = 0;
    window.__pendingGps = null;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(ok, fail) {
          window.__gpsCalls += 1;
          if (shouldNeverReturn) return;
          const value = window.__gpsSamples.shift();
          window.__pendingGps = () => {
            window.__pendingGps = null;
            if (value && value.error) fail({ code: value.error });
            else ok({ coords: value || {} });
          };
        }
      }
    });
  }, { neverReturn, fastLongTimers });
}

async function gpsFix(page, selector, value) {
  await page.evaluate((sample) => window.__gpsSamples.push(sample), value);
  const before = await page.evaluate(() => window.__gpsCalls);
  await click(page, selector);
  assert.equal(await page.evaluate(() => window.__gpsCalls), before + 1, `${selector}: one native GPS request`);
  await page.evaluate((target) => document.querySelector(target).click(), selector);
  assert.equal(await page.evaluate(() => window.__gpsCalls), before + 1, `${selector}: duplicate request suppressed`);
  await page.evaluate(() => window.__pendingGps && window.__pendingGps());
  await page.waitForFunction(() => window.__pendingGps === null);
}

async function verifyFullGpsFlow(browser, url, errors) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await installGpsMock(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`gps flow: ${error.message}`));
  await page.goto(url);

  const origin = { latitude: 35, longitude: 139, accuracy: 8 };
  const north = { latitude: 35.001, longitude: 139, accuracy: 8 };
  const west = { latitude: 35, longitude: 138.9984, accuracy: 8 };

  await gpsFix(page, '#start-live', { error: 1 });
  assert.equal(await page.locator('#start-sim').isVisible(), true);
  assert.equal(await page.locator('#check-location').isVisible(), true);
  assert.match(await page.locator('#location-status').textContent(), /許可.*再試行.*模擬探索/);

  await gpsFix(page, '#check-location', origin);
  await gpsFix(page, '#check-location', north);
  await click(page, '#scene-continue');
  await click(page, '[data-choice="ring_bell"]');

  await gpsFix(page, '#phase2-live', { error: 2 });
  assert.match(await page.locator('#location-status').textContent(), /取得できない.*再試行.*模擬探索/);
  await gpsFix(page, '#phase2-live', origin);
  await gpsFix(page, '#phase2-live', north);
  await click(page, '#crossing-continue');
  await click(page, '[data-choice="keep_crossing"]');

  await gpsFix(page, '#phase3-live', { error: 3 });
  assert.match(await page.locator('#location-status').textContent(), /時間切れ.*再試行.*模擬探索/);
  await gpsFix(page, '#phase3-live', origin);
  await gpsFix(page, '#phase3-live', north);
  await click(page, '#hill-continue');
  await click(page, '[data-choice="signal_gate"]');
  await page.locator('#phase6-navigation').waitFor({ state: 'visible' });
  await assertHillCausality(page, 'signal_gate');

  await gpsFix(page, '#phase6-live-start', origin);
  await gpsFix(page, '#phase6-live-check', west);
  await page.locator('#collision-summary').waitFor({ state: 'visible' });
  await page.locator('#collision-live').waitFor({ state: 'visible' });

  await gpsFix(page, '#collision-live', { latitude: 35, longitude: 139, accuracy: 180 });
  assert.match(await page.locator('#location-status').textContent(), /約180m.*再試行.*模擬探索/);
  assert.equal(await page.locator('#collision-live').isEnabled(), true);
  await gpsFix(page, '#collision-live', origin);
  await gpsFix(page, '#collision-live', north);
  await page.locator('#reboot-ending').waitFor({ state: 'visible' });
  await assertEnding(page, { bell: 'ring_bell', crossing: 'keep_crossing', hill: 'signal_gate', visit: 'ruined_gate' });

  const save = await page.evaluate((key) => localStorage.getItem(key), REBOOT_KEY);
  assert.ok(save);
  assert.doesNotMatch(save, /latitude|longitude|accuracy|routeHistory|movementTrack/);
  await context.close();
}

async function verifyStaleCallbacks(browser, url, errors) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await installGpsMock(context);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`stale callback: ${error.message}`));
  await page.goto(url);

  const origin = { latitude: 35, longitude: 139, accuracy: 8 };
  await page.evaluate((sample) => window.__gpsSamples.push(sample), origin);
  await click(page, '#start-live');
  assert.equal(await page.evaluate(() => window.__gpsCalls), 1);
  await click(page, '#start-sim');
  const beforeStatus = await page.locator('#location-status').textContent();
  await page.evaluate(() => window.__pendingGps && window.__pendingGps());
  await page.waitForFunction(() => window.__pendingGps === null);
  assert.equal(await page.locator('#location-status').textContent(), beforeStatus, 'late live callback does not override simulated mode');

  await click(page, '#check-location');
  await click(page, '#check-location');
  await click(page, '#scene-continue');
  await click(page, '[data-choice="break_bell"]');

  await page.evaluate((sample) => window.__gpsSamples.push(sample), origin);
  await click(page, '#phase2-live');
  const calls = await page.evaluate(() => window.__gpsCalls);
  await click(page, '#dev-walk-next');
  const devStatus = await page.locator('#location-status').textContent();
  await page.evaluate(() => window.__pendingGps && window.__pendingGps());
  await page.waitForFunction(() => window.__pendingGps === null);
  assert.equal(await page.evaluate(() => window.__gpsCalls), calls);
  assert.equal(await page.locator('#location-status').textContent(), devStatus, 'late Phase 2 callback does not overwrite DEV discovery');
  assert.equal(await page.locator('#story-title').textContent(), '古い渡り場');
  await context.close();
}

async function verifyMissingCallbackRecovery(browser, url, errors) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await installGpsMock(context, { neverReturn: true, fastLongTimers: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`missing callback: ${error.message}`));
  await page.goto(url);

  await click(page, '#start-sim');
  await click(page, '#check-location');
  await click(page, '#check-location');
  await click(page, '#scene-continue');
  await click(page, '[data-choice="ring_bell"]');
  await page.locator('#phase2-live').waitFor({ state: 'visible' });
  await click(page, '#phase2-live');
  await page.locator('#location-status').filter({ hasText: '時間切れ' }).waitFor({ timeout: 2000 });
  assert.equal(await page.locator('#phase2-live').isEnabled(), true, 'watchdog releases a request whose provider never calls back');
  assert.match(await page.locator('#location-status').textContent(), /再試行.*模擬探索/);
  await context.close();
}

(async () => {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/reboot.html`;
  const output = process.env.REBOOT_SCREENSHOT_DIR || '/tmp/reboot-qa';
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    await verifyAllBranches(browser, url, output, errors);
    await verifyStorageFallbacks(browser, url, errors);
    await verifyFullGpsFlow(browser, url, errors);
    await verifyStaleCallbacks(browser, url, errors);
    await verifyMissingCallbackRecovery(browser, url, errors);
    assert.deepEqual(errors, []);
    console.log('Reboot main: 16 branches, reload, storage fallbacks/reset, GPS failures/retry/stale/missing callbacks, hill causality, and 320/390/1366px checks passed.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
