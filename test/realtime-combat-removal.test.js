const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

test('canonical root entrypoint routes to reboot instead of legacy realtime combat app', () => {
  const html = read('index.html');

  assert.match(html, /reboot\.html/);
  assert.equal(html.includes('combat-screen'), false);
  assert.equal(html.includes('id="arena"'), false);
  assert.equal(html.includes('src/app.js'), false);
  assert.equal(html.includes('combat-manuscript.css'), false);
  assert.equal(html.includes('combat-oblique.css'), false);
  assert.equal(html.includes('combat-render-space.css'), false);
});

test('reboot runtime does not load rejected realtime combat', () => {
  const html = read('reboot.html');

  assert.equal(html.includes('reboot-phase9.css'), false);
  assert.equal(html.includes('reboot-phase9-combat.js'), false);
  assert.equal(exists('reboot-phase9.css'), false);
  assert.equal(exists('src/reboot-phase9-combat.js'), false);
});

test('legacy realtime combat runtime and presentation stay removed', () => {
  const removed = [
    'src/app.js',
    'src/app-runtime-state.js',
    'src/desktop-input.js',
    'src/combat-action-profiles.js',
    'src/combat-depth-order-v1.js',
    'src/combat-feel-tuning.js',
    'src/combat-ink-feel-v3.js',
    'src/combat-manuscript-render.js',
    'src/combat-render-space.js',
    'src/combat-shadow-contact.js',
    'combat-manuscript.css',
    'combat-oblique.css',
    'combat-render-space.css',
    'assets/combat/minimal-v0.1'
  ];

  for (const relativePath of removed) {
    assert.equal(exists(relativePath), false, `${relativePath} must remain removed`);
  }
});

test('prototype reset no longer depends on combat persistence', () => {
  const devTools = read('src/reboot-dev-tools.js');

  assert.equal(devTools.includes('CrownlessRebootPhase9Combat'), false);
  assert.equal(devTools.includes('crownless_reboot_phase9_world_v1'), false);
  assert.match(devTools, /removeItem\(base\.STORAGE_KEY\)/);
});

test('preceding reboot exploration remains wired after combat removal', () => {
  const html = read('reboot.html');

  assert.match(html, /src\/reboot-phase7-exploration\.js/);
  assert.match(html, /src\/reboot-phase6-controller\.js/);
  assert.match(html, /src\/reboot-dev-tools\.js/);
});
