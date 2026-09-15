const test = require('node:test');
const assert = require('node:assert/strict');
const { originText } = require('../src/gear-origin.js');

test('carried gear remembers its game-world origin', () => {
  assert.equal(originText('fang'), '囁きの森から持ち帰った');
  assert.equal(originText('shield_thorn'), '鐘なき塔から持ち帰った');
  assert.equal(originText('bow_recurve'), '星沈みの湿原から持ち帰った');
  assert.equal(originText('crown'), '灰冠の廟から持ち帰った');
});

test('starter gear does not invent an expedition origin', () => {
  assert.equal(originText('rust'), '');
  assert.equal(originText('unknown'), '');
});
