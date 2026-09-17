'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MEMORY_KEY, signFor, readMemory, remember } = require('../src/predator-signs');

test('each guardian exposes a short actionable environmental sign', () => {
  for (const kind of ['wolf', 'knight', 'wraith', 'king']) {
    const sign = signFor(kind);
    assert.ok(sign?.title);
    assert.ok(sign?.text);
    assert.ok(sign?.advice);
    assert.equal(sign.memory, undefined);
    assert.ok(sign.text.length < 60, `${kind} sign should stay phone-readable`);
  }
});

test('a previous guardian encounter unlocks one extra tactical memory without stats', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readMemory(storage), []);
  assert.equal(remember(storage, 'wolf'), true);
  assert.equal(remember(storage, 'wolf'), false);
  assert.deepEqual(readMemory(storage), ['wolf']);
  assert.deepEqual(JSON.parse(values.get(MEMORY_KEY)), ['wolf']);
  const learned = signFor('wolf', true);
  assert.match(learned.memory, /前回の記憶/);
  assert.doesNotMatch(learned.memory, /攻撃 \+|体力 \+|最大体力|ダメージ \+/);
});

test('unknown enemies and malformed memory do not invent tells', () => {
  assert.equal(signFor('unknown'), null);
  const storage = { getItem: () => '{broken' };
  assert.deepEqual(readMemory(storage), []);
});
