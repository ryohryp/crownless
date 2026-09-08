const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-dev-tools.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase6.css'), 'utf8');

test('reboot exposes an explicit development-only replay control', () => {
  assert.match(html, /id="reboot-dev-reset"/);
  assert.match(html, /DEV: Prototypeを最初からやり直す/);
  assert.match(html, /ゲーム内の巻き戻しではない/);
  assert.match(html, /src\/reboot-dev-tools\.js/);
});

test('reset removes only the Reboot Prototype storage key', () => {
  assert.match(source, /localStorage\.removeItem\(base\.STORAGE_KEY\)/);
  assert.doesNotMatch(source, /localStorage\.clear\s*\(/);
  assert.doesNotMatch(source, /removeItem\(['"`]/);
  assert.match(source, /(?:window|win)\.confirm/);
  assert.match(source, /(?:window|win)\.location\.reload\(\)/);
});

test('development replay control remains compact on desktop and stacks on mobile', () => {
  assert.match(css, /\.prototype-dev-tools\s*\{[\s\S]*?display: flex/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.prototype-dev-tools \{ align-items: stretch; flex-direction: column; \}/);
});
