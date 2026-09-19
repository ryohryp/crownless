'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine');
const C = require('../src/loot-comparison');

test('comparison stays compact and explains tactical difference plus return stakes', () => {
  const s = E.initial();
  const result = C.compare('rust', 'fang_blood', E, s);
  assert.equal(result.current, '欠けた鉄剣');
  assert.equal(result.found, '血染めの短剣');
  assert.ok(result.rows.length <= 3);
  assert.ok(result.rows.some(row => /回避後/.test(row.value)));
  assert.ok(result.rows.some(row => /生還/.test(row.value)));
});

test('same-family variants expose their distinct trait instead of a gear score', () => {
  const s = E.initial();
  s.owned.push('fang');
  const result = C.compare('fang', 'fang_moon', E, s);
  assert.ok(result.rows.some(row => /気力消費 0/.test(row.value)));
  assert.equal(result.rows.some(row => /score|スコア/i.test(row.value)), false);
});

test('invalid or identical gear does not create a comparison', () => {
  const s = E.initial();
  assert.equal(C.compare('rust', 'rust', E, s), null);
  assert.equal(C.compare('rust', 'missing', E, s), null);
});
