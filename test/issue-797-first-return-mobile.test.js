const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/slice-engine.js');

test('first safe return can immediately reinforce the starting sword', () => {
  const state = E.initial();
  state.scrap = 4;
  assert.equal(E.upgradeCost(state, 'rust'), 4);
  const upgraded = E.upgrade(state, 'rust');
  assert.notEqual(upgraded, state);
  assert.equal(upgraded.scrap, 0);
  assert.equal(E.weaponLevel(upgraded, 'rust'), 1);
});

test('playable server exposes the living map terrain SVG only from assets root', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'serve-slice.cjs'), 'utf8');
  assert.match(source, /name\.startsWith\('assets\/'\).*name\.endsWith\('\.svg'\)/);
  assert.match(source, /'\.svg':'image\/svg\+xml'/);
});

test('phone navigation wins over density rules and gear reinforce copy is readable', () => {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'bottom-navigation.css'), 'utf8');
  const density = fs.readFileSync(path.join(__dirname, '..', 'phone-density.css'), 'utf8');
  assert.match(nav, /#game > \.game-layout \.camp-tabs\.bottom-navigation \{/);
  assert.match(nav, /position: fixed;/);
  assert.match(density, /button\.active\[data-value="gear"\]\) \.rule-line[\s\S]*color: #23302d;/);
  assert.match(density, /\.rule-line \.small[\s\S]*color: #52635d;/);
});
