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
