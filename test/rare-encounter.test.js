const test = require('node:test');
const assert = require('node:assert/strict');
const rare = require('../src/rare-encounter');

function state(overrides = {}) {
  return {
    runs: 2,
    expedition: {
      stage: 'cleared', depth: 1, hp: 20, scrap: 4, gear: [], log: [],
      ...overrides,
    },
  };
}

test('rare encounter is uncommon and only seeds once', () => {
  assert.equal(rare.shouldAppear(state()), true);
  assert.equal(rare.shouldAppear({ ...state(), runs: 3 }), false);
  const seeded = rare.seed(state());
  assert.equal(seeded.expedition.rareEncounterPending, true);
  assert.match(seeded.expedition.log[0], /希少遭遇/);
  assert.equal(rare.shouldAppear(seeded), false);
});

test('search trades health for a larger reward', () => {
  const seeded = rare.seed(state());
  const result = rare.resolve(seeded, 'rare-search');
  assert.equal(result.expedition.hp, 17);
  assert.equal(result.expedition.scrap, 11);
  assert.equal(result.expedition.rareEncounterPending, false);
});

test('leaving avoids damage but still prevents a total blank', () => {
  const seeded = rare.seed(state());
  const result = rare.resolve(seeded, 'rare-leave');
  assert.equal(result.expedition.hp, 20);
  assert.equal(result.expedition.scrap, 6);
  assert.equal(result.expedition.rareEncounterPending, false);
});
