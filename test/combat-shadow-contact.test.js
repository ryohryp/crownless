const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const patchPath = path.join(root, 'src', 'combat-shadow-contact.js');
const js = fs.readFileSync(patchPath, 'utf8');

test('shadow contact correction loads after manuscript renderer and before app', () => {
  const manuscript = html.indexOf('src/combat-manuscript-render.js');
  const contact = html.indexOf('src/combat-shadow-contact.js');
  const app = html.indexOf('src/app.js');
  assert.ok(manuscript >= 0 && contact > manuscript && app > contact);
});

test('contact correction only lifts the known actor ground-shadow ellipse', () => {
  assert.match(js, /const CONTACT_LIFT = 7/);
  assert.match(js, /radiusX\) - 16/);
  assert.match(js, /radiusY\) - 5\.5/);
  assert.match(js, /rgba\(70,64,56,0\.42\)/);
  assert.match(js, /Number\(y\) - CONTACT_LIFT/);
});

test('shadow contact correction is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', patchPath]);
});
