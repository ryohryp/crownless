const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const U = require('../src/unknown-enemy.js');

test('wolf intent is uncertain only on the first encounter', () => {
  let memory = U.initial();
  const first = U.describe(memory, 'wolf', '次は強打');
  assert.equal(first.hidden, true);
  assert.match(first.label, /読めない/);
  memory = U.learn(memory, 'wolf');
  assert.deepEqual(U.describe(memory, 'wolf', '次は強打'), { hidden: false, label: '次は強打' });
});

test('other enemies keep normal intent information', () => {
  const memory = U.initial();
  assert.deepEqual(U.describe(memory, 'bandit', '次は牽制'), { hidden: false, label: '次は牽制' });
  assert.deepEqual(U.learn(memory, 'bandit'), memory);
});

test('unknown enemy UI guards its MutationObserver render from self-triggered rewrites', () => {
  const ui = fs.readFileSync('src/unknown-enemy-ui.js', 'utf8');
  const guard = ui.indexOf('intent.dataset.unknownEnemyRendered === U.TARGET');
  const marker = ui.indexOf('intent.dataset.unknownEnemyRendered = U.TARGET');
  const rewrite = ui.indexOf('intent.innerHTML');
  assert.ok(guard >= 0, 'render must skip an already-enhanced intent');
  assert.ok(marker > guard && marker < rewrite, 'render marker must be set before mutating the observed DOM');
});
