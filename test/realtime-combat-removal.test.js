const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('reboot runtime does not load rejected real-time combat', () => {
  const html = read('reboot.html');

  assert.equal(html.includes('reboot-phase9.css'), false);
  assert.equal(html.includes('reboot-phase9-combat.js'), false);
  assert.equal(fs.existsSync(path.join(root, 'reboot-phase9.css')), false);
  assert.equal(fs.existsSync(path.join(root, 'src/reboot-phase9-combat.js')), false);
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
