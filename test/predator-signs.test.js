'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { signFor } = require('../src/predator-signs');

test('each guardian exposes a short actionable environmental sign', () => {
  for (const kind of ['wolf', 'knight', 'wraith', 'king']) {
    const sign = signFor(kind);
    assert.ok(sign?.title);
    assert.ok(sign?.text);
    assert.ok(sign?.advice);
    assert.ok(sign.text.length < 60, `${kind} sign should stay phone-readable`);
  }
});

test('unknown enemies do not invent a sign', () => {
  assert.equal(signFor('unknown'), null);
});
