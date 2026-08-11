const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src', 'combat-render-space.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'combat-render-space.css'), 'utf8');

test('render-space projection loads before the combat app and its CSS overrides phase one', () => {
  const phaseOneCss = html.indexOf('combat-oblique.css');
  const phaseTwoCss = html.indexOf('combat-render-space.css');
  const renderSpace = html.indexOf('src/combat-render-space.js');
  const app = html.indexOf('src/app.js');

  assert.ok(phaseOneCss >= 0);
  assert.ok(phaseTwoCss > phaseOneCss, 'phase two CSS should override the phase one whole-canvas tilt');
  assert.ok(renderSpace >= 0 && renderSpace < app, 'render-space must patch the arena context before app.js requests it');
});

test('phase two removes whole-canvas tilt and projects world positions instead', () => {
  assert.match(css, /#arena[\s\S]*transform:\s*none\s*!important/);
  assert.match(js, /function projection\(x, y\)/);
  assert.match(js, /horizontal = 0\.72 \+ t \* 0\.29/);
  assert.match(js, /y:\s*72 \+ y \* vertical/);
  assert.match(js, /beginProjectedEntity/);
});

test('fighters stay upright while depth and grounding come from render space', () => {
  assert.match(js, /drawActorShadow/);
  assert.match(js, /raw\.ellipse\(0, 26, 24, 7\.5/);
  assert.match(js, /Math\.cos\(angle\) < 0 \? -1 : 1/);
  assert.match(js, /actorMode && radius >= 24/);
});

test('render-space shim is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', path.join(root, 'src', 'combat-render-space.js')]);
});
