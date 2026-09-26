const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Engine = require('../src/slice-engine.js');
const { fromReportPanel, nextPowerPreview } = require('../src/return-feedback.js');

function returnedState({ scrap = 0, newGear = [], died = false } = {}) {
  const state = Engine.initial();
  state.mode = 'demo';
  state.scrap = scrap;
  state.owned = [...new Set([...state.owned, ...newGear])];
  state.report = {
    died,
    place: 'wood',
    depth: 1,
    scrap,
    gear: [...newGear],
    newGear: died ? [] : [...newGear],
    hp: died ? -1 : 20,
    cleared: [],
  };
  return state;
}

test('celebrates bringing a new weapon home', () => {
  assert.match(fromReportPanel('SAFE RETURN 新しい一本を、火へ。 +8 鉄片を確保'), /新しい武具を生還確定/);
});

test('calls out a valuable haul as a deliberate return decision', () => {
  const text = fromReportPanel('SAFE RETURN 欲張らずに、帰る強さ。 +17 鉄片を確保');
  assert.match(text, /鉄片 17 個/);
  assert.match(text, /帰る判断/);
});

test('does not praise a failed expedition', () => {
  assert.equal(fromReportPanel('EXPEDITION LOST 命だけを、持ち帰った。 −12 鉄片を失った'), '');
});

test('newly returned gear previews the combat style it unlocks', () => {
  const state = returnedState({ scrap: 8, newGear: ['fang'] });
  const text = nextPowerPreview(state, Engine);
  assert.match(text, /牙の短剣/);
  assert.match(text, /回避後の追撃 \+5/);
  assert.match(text, /かわして返す/);
});

test('affordable reinforcement previews a concrete before and after', () => {
  const state = returnedState({ scrap: 4 });
  const text = nextPowerPreview(state, Engine);
  assert.match(text, /鉄片 4 で今すぐ補強/);
  assert.match(text, /強撃 8 → 9/);
});

test('small haul still shows how close the next power step is', () => {
  const state = returnedState({ scrap: 2 });
  const text = nextPowerPreview(state, Engine);
  assert.match(text, /鉄片あと 2/);
  assert.match(text, /強撃 8 → 9/);
});

test('defeat never presents a false power-up celebration', () => {
  const state = returnedState({ scrap: 20, died: true });
  assert.equal(nextPowerPreview(state, Engine), '');
});

test('safe return with an affordable upgrade routes the primary continuation to gear', () => {
  const source = fs.readFileSync('src/slice-app.js', 'utf8');
  assert.match(source, /function canReinforceEquipped\(\)/);
  assert.match(source, /canPowerUp \? '補強へ進む'/);
  assert.match(source, /const hasNewBattleGear = !state\.report\.died/);
  assert.match(source, /const canPowerUp = !state\.report\.died && canReinforceEquipped\(\)/);
  assert.match(source, /const gearStep = hasNewBattleGear \|\| canPowerUp/);
  assert.match(source, /tab = gearStep \? 'gear' : 'explore'/);
});
