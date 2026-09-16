const test = require('node:test');
const assert = require('node:assert/strict');
const { repeatedAction, counterIntent } = require('../src/enemy-adaptation');

test('one action never triggers adaptation', () => {
  assert.equal(repeatedAction(['dodge']), null);
  assert.equal(counterIntent(['dodge'], '速攻型'), null);
});

test('repeating dodge lets quick enemies telegraph a feint', () => {
  const intent = counterIntent(['dodge', 'dodge'], '速攻型');
  assert.equal(intent.id, 'feint');
  assert.match(intent.reason, /足運び/);
  assert.match(intent.help, /防御|通常攻撃/);
});

test('repeating guard lets hunter enemies telegraph a break with multiple answers', () => {
  const intent = counterIntent(['guard', 'guard'], '狩人型');
  assert.equal(intent.id, 'break');
  assert.match(intent.reason, /盾の構え/);
  assert.match(intent.help, /回避/);
  assert.match(intent.help, /通常攻撃/);
});

test('repeating heavy lets defensive enemies telegraph an intercept', () => {
  const intent = counterIntent(['heavy', 'heavy'], '防御型');
  assert.equal(intent.id, 'intercept');
  assert.match(intent.help, /通常攻撃|防御/);
});

test('archetypes do not all read the same habit', () => {
  assert.equal(counterIntent(['heavy', 'heavy'], '速攻型'), null);
  assert.equal(counterIntent(['guard', 'guard'], '防御型'), null);
});
