'use strict';
// Real-Chromium phone & landscape visual + gameplay verification for ?art=castle-bridge.
// Executes Task 5 scenario:
// 1. Observe 5s without moving
// 2. Move right onto the stone bridge
// 3. Stop partway on the bridge
// 4. Move back left
// 5. Tap a discovery site
// 6. Move again and verify parallax & world-ground consistency
// Captures screenshots (start, walk, stop, return, tap) and continuous .webm video.

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.qa/castle-bridge');

function resolveChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1187', 'chrome-win', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of candidates) {
    if (candidate && require('node:fs').existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function waitForServer(server) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('serve-slice timeout')), 10000);
    server.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    server.once('error', reject);
    server.once('exit', (code) => reject(new Error('serve-slice exited: ' + code)));
  });
}

async function runScenarioForViewport(browser, port, width, height) {
  const isPortrait = height > width;
  const tag = `${width}x${height}`;
  const videoDir = path.join(outDir, 'videos', tag);
  await fs.mkdir(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: { width, height } }
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`http://127.0.0.1:${port}/gemini-feel-lab.html?art=castle-bridge`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForFunction(() => {
    const r = window.CrownlessForestReadout?.();
    return Boolean(r && r.art === 'castle-bridge' && r.assetsReady && r.castleBridge?.heroScreen);
  }, null, { timeout: 15000 });

  // 1. Observe without moving for 5 seconds (also verify compact HUD & zero blank edges)
  await page.waitForTimeout(5000);
  const startState = await page.evaluate(() => {
    const r = window.CrownlessForestReadout();
    const headerRect = document.querySelector('header').getBoundingClientRect();
    const canvas = document.getElementById('gameCanvas');
    const cRect = canvas.getBoundingClientRect();
    const g = canvas.getContext('2d');
    const sampleCols = [0.02, 0.25, 0.5, 0.75, 0.98].map((fx) => {
      const px = Math.floor(fx * canvas.width);
      const colors = new Set();
      for (const fy of [0.15, 0.45, 0.7, 0.9]) {
        const py = Math.floor(fy * canvas.height);
        const d = g.getImageData(px, py, 1, 1).data;
        colors.add(`${d[0]},${d[1]},${d[2]}`);
      }
      return colors.size;
    });
    return {
      readout: r,
      headerHeight: headerRect.height,
      canvasHeight: cRect.height,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      sampleCols
    };
  });
  assert(startState.headerHeight <= 52, `${tag} header must be <= 52px, got ${startState.headerHeight}`);
  assert(startState.overflow <= 1, `${tag} must not overflow horizontally: ${startState.overflow}`);
  assert(startState.sampleCols.every((n) => n >= 2), `${tag} must have no blank/solid edge column: ${JSON.stringify(startState.sampleCols)}`);
  assert.equal(
    Math.round(startState.readout.castleBridge.heroScreen.y),
    Math.round(startState.readout.castleBridge.shadowScreen.y),
    `${tag} grounded hero feet must match shadow Y at start`
  );
  await page.screenshot({ path: path.join(outDir, `${tag}-01-start-5s.png`) });

  // 2. Move right onto the stone bridge (aim for x ~ 550..610, bridge center)
  // First adjust z slightly upward onto bridge lane (bridgeMinZ=235, bridgeMaxZ=345; hero starts at z=310, already in lane!)
  await page.keyboard.down('d');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(outDir, `${tag}-02-walking-bridge.png`) });
  const walkState = await page.evaluate(() => window.CrownlessForestReadout());
  await page.keyboard.up('d');

  // 3. Stop partway on the bridge and verify feet/shadow/ground match once grounded
  await page.waitForFunction(() => {
    const r = window.CrownlessForestReadout?.();
    if (!r?.castleBridge?.heroScreen || !r?.castleBridge?.shadowScreen) return false;
    return Math.abs(r.castleBridge.heroScreen.y - r.castleBridge.shadowScreen.y) < 0.05 &&
      r.player?.state !== 'HURT' && r.player?.state !== 'JUMP';
  }, null, { timeout: 5000 });
  const stopState = await page.evaluate(() => window.CrownlessForestReadout());
  assert(stopState.player.x >= 430 && stopState.player.x <= 730,
    `${tag} hero should reach the stone bridge [430..730], got x=${stopState.player.x}`);
  assert(stopState.castleBridge.groundHeight > 5,
    `${tag} bridge elevation should lift hero above flat ground, got ${stopState.castleBridge.groundHeight}`);
  assert.equal(
    Math.round(stopState.castleBridge.heroScreen.y),
    Math.round(stopState.castleBridge.shadowScreen.y),
    `${tag} hero feet must stay locked to shadow Y while stopped on arched bridge`
  );
  // Verify parallax consistency from start -> stop
  const dCam = stopState.cameraX - startState.readout.cameraX;
  if (dCam > 10) {
    const dCastle = startState.readout.castleBridge.anchors.castleX - stopState.castleBridge.anchors.castleX;
    const dWaterfall = startState.readout.castleBridge.anchors.waterfallX - stopState.castleBridge.anchors.waterfallX;
    const dFg = startState.readout.castleBridge.anchors.foregroundOffsetX - stopState.castleBridge.anchors.foregroundOffsetX;
    assert(Math.abs(dCastle / dCam - 0.20) < 0.02, `${tag} castle parallax ratio expected ~0.20, got ${dCastle / dCam}`);
    assert(Math.abs(dWaterfall / dCam - 0.50) < 0.02, `${tag} waterfall parallax ratio expected ~0.50, got ${dWaterfall / dCam}`);
    assert(Math.abs(dFg / dCam - 1.00) < 0.01, `${tag} foreground parallax ratio expected 1.00, got ${dFg / dCam}`);
  }
  await page.screenshot({ path: path.join(outDir, `${tag}-03-stopped-bridge.png`) });

  // 4. Move back left
  await page.keyboard.down('a');
  await page.waitForTimeout(900);
  await page.keyboard.up('a');
  await page.waitForTimeout(200);
  const leftState = await page.evaluate(() => window.CrownlessForestReadout());
  assert(leftState.player.x < stopState.player.x - 40,
    `${tag} hero must walk back left (${leftState.player.x} < ${stopState.player.x})`);
  await page.screenshot({ path: path.join(outDir, `${tag}-04-returned-left.png`) });

  // Verify settings drawer opens & closes cleanly
  await page.locator('#visualSettingsToggle').click();
  assert.equal(await page.locator('#visualSettingsToggle').getAttribute('aria-expanded'), 'true');
  assert(await page.locator('#btnToggleAI').isVisible(), `${tag} secondary controls must be accessible in drawer`);
  await page.locator('#visualSettingsToggle').click();

  // 5. Steer deterministically near shrine (x=660, z=230) and tap it directly in full-screen gesture mode
  for (let step = 0; step < 36; step++) {
    const p = await page.evaluate(() => window.CrownlessForestReadout()?.player);
    if (!p) break;
    const dx = 660 - p.x;
    const dz = 230 - p.z;
    if (Math.hypot(dx, dz) <= 30) break;
    const keys = [];
    if (Math.abs(dx) > 12) keys.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dz) > 10) keys.push(dz > 0 ? 's' : 'w');
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(80);
    for (const k of keys) await page.keyboard.up(k);
  }
  await page.waitForFunction(() => {
    const p = window.CrownlessForestReadout()?.player;
    return p && !['HURT', 'DOWN', 'ATTACK', 'SPECIAL', 'JUMP'].includes(p.state);
  }, null, { timeout: 4000 });
  await page.waitForTimeout(180);

  const shrineClick = await page.evaluate(() => {
    const r = window.CrownlessForestReadout();
    const rect = document.getElementById('gameCanvas').getBoundingClientRect();
    const sx = 660 - r.cameraX;
    const sy = 230;
    return {
      x: rect.left + (sx / r.viewport.width) * rect.width,
      y: rect.top + ((sy - 20) / 420) * rect.height,
      dist: Math.hypot(r.player.x - 660, r.player.z - 230)
    };
  });
  await page.mouse.click(shrineClick.x, shrineClick.y);
  await page.waitForTimeout(250);
  const shrineModalVisible = await page.locator('#forestShrineChoice').isVisible();
  assert(shrineModalVisible, `${tag} tapping shrine site within range (dist=${shrineClick.dist.toFixed(1)}) must open #forestShrineChoice`);
  await page.screenshot({ path: path.join(outDir, `${tag}-05-tap-site.png`) });
  await page.locator('#forestShrineCancel').click();
  await page.waitForTimeout(150);

  // 6. Move again right toward east courtyard to observe continuous parallax
  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  await page.keyboard.up('d');
  await page.waitForTimeout(150);
  const endState = await page.evaluate(() => window.CrownlessForestReadout());
  await page.screenshot({ path: path.join(outDir, `${tag}-06-parallax-end.png`) });

  assert.deepEqual(errors, [], `${tag} browser errors: ${JSON.stringify(errors)}`);

  const videoPath = await page.video().path();
  await context.close();

  const savedVideoPath = path.join(outDir, `${tag}-playthrough.webm`);
  await fs.copyFile(videoPath, savedVideoPath);

  console.log('CASTLE_BRIDGE_PASS', tag, JSON.stringify({
    headerHeight: startState.headerHeight,
    startX: Math.round(startState.readout.player.x),
    bridgeX: Math.round(stopState.player.x),
    bridgeGroundH: Math.round(stopState.castleBridge.groundHeight),
    returnedX: Math.round(leftState.player.x),
    shrineModalVisible,
    endX: Math.round(endState.player.x),
    isPortrait,
    video: path.relative(root, savedVideoPath)
  }));
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const server = spawn(process.execPath, ['scripts/serve-slice.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr.pipe(process.stderr);

  let browser;
  try {
    const port = await waitForServer(server);
    const executablePath = resolveChromiumExecutable();
    browser = await chromium.launch({ headless: true, executablePath });

    for (const [w, h] of [[360, 800], [390, 844], [430, 932], [844, 390]]) {
      await runScenarioForViewport(browser, port, w, h);
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

