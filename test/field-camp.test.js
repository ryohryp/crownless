const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  const E = require('../src/slice-engine.js');
  const window = { CrownlessSlice: E, addEventListener() {} };
  const context = vm.createContext({ window, console, MutationObserver: class {} });
  vm.runInContext(fs.readFileSync(require.resolve('../src/field-camp.js'), 'utf8'), context);
  return { E, Camp: window.CrownlessFieldCamp };
}

test('field camp heals once without exceeding current max HP', () => {
  const { E, Camp } = load();
  let state = E.initial();
  state.mode = 'demo';
  state = E.start(state, 'wood');
  state.expedition.hp = E.maxHp(state) - 5;
  const max = E.maxHp(state);

  const preview = Camp.preview(state.expedition);
  assert.equal(preview.recover, 5);
  state = E.act(state, 'field-camp');
  assert.equal(state.expedition.hp, max);
  assert.equal(state.expedition.fieldCampUsed, true);
  assert.equal(state.expedition.fieldCampRisk, 4);
  assert.equal(E.act(state, 'field-camp'), state);
});

test('field camp risk adds four enemy HP to the next encounter only', () => {
  const { E } = load();
  let state = E.initial();
  state.mode = 'demo';
  state = E.start(state, 'wood');
  state.expedition.hp -= 8;
  state = E.act(state, 'field-camp');
  state = E.act(state, 'careful');

  assert.equal(state.expedition.enemy.maxHp, 20);
  assert.equal(state.expedition.fieldCampRisk, 0);

  state.expedition.stage = 'path';
  state.expedition.enemy = null;
  state.expedition.room = 2;
  state = E.act(state, 'careful');
  assert.equal(state.expedition.enemy.maxHp, 18);
});