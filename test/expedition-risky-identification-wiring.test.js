const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('expedition page loads risky identification before the app runtime', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'expedition.html'), 'utf8');
  const risky = html.indexOf('src/expedition-risky-identification.js');
  const app = html.indexOf('src/slice-app.js');
  assert.ok(risky >= 0, 'risky identification runtime must be loaded');
  assert.ok(app > risky, 'risky identification runtime must load before slice-app');
});

test('risky identification enhancement does not remove and reinsert its own card', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'risky-identification-ui.js'), 'utf8');
  assert.match(source, /if \(existing\) return;/, 'existing enhancement must be left in place');
  assert.match(source, /if \(!canShow\) \{\s*existing\?\.remove\(\);\s*return;/, 'stale enhancement may be removed only when it should no longer be shown');
  assert.doesNotMatch(source, /function enhance\(\) \{\s*root\.querySelector\('\.risky-identification'\)\?\.remove\(\);/, 'observer callback must not unconditionally mutate the DOM');
});
