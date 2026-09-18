const test = require('node:test');
const assert = require('node:assert/strict');
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
