const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pagesUrl = 'https://ryohryp.github.io/crownless/';

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('GitHub Pages stays the canonical player-facing Crownless URL', () => {
  const readme = read('README.md');
  const deployment = read('docs/deployment-strategy.md');

  assert.match(readme, /Canonical public \/ phone-playtest URL:/);
  assert.ok(readme.includes(pagesUrl));
  assert.match(readme, /Vercel is not the canonical game URL/);

  assert.ok(deployment.includes(pagesUrl));
  assert.match(deployment, /GitHub Pages — canonical public \/ playtest/);
  assert.ok(deployment.includes('It is **not** the canonical player-facing game URL.'));
  assert.match(deployment, /player-facing links pointed at/);
});
