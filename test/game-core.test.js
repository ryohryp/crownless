const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/game-core.js");

test("same expedition seed produces the same discovery and encounter", () => {
  const first = Core.discoverNextCell(Core.beginExpedition(Core.createInitialState(), 4242));
  const second = Core.discoverNextCell(Core.beginExpedition(Core.createInitialState(), 4242));

  assert.deepEqual(first.expedition.encounter, second.expedition.encounter);
});

test("victory produces unsecured loot instead of permanent loot", () => {
  let state = Core.beginExpedition(Core.createInitialState(), 99);
  state = Core.discoverNextCell(state);
  state = Core.resolveVictory(state, 73);

  assert.equal(state.phase, "decision");
  assert.ok(state.expedition.unsecuredLoot.length >= 1);
  assert.equal(state.securedLoot.length, 0);
  assert.equal(state.expedition.health, 73);
});

test("returning home secures every carried item", () => {
  let state = Core.beginExpedition(Core.createInitialState(), 101);
  state = Core.discoverNextCell(state);
  state = Core.resolveVictory(state, 82);
  const carried = state.expedition.unsecuredLoot.length;
  state = Core.returnHome(state);

  assert.equal(state.phase, "hub");
  assert.equal(state.expedition, null);
  assert.equal(state.securedLoot.length, carried);
  assert.ok(state.securedLoot.every((item) => item.secured));
  assert.equal(state.stats.expeditionsSurvived, 1);
});

test("defeat loses at least half of unsecured loot but never secured loot", () => {
  let state = Core.createInitialState();
  state.securedLoot.push({ id: "old-keepsake", name: "Old Keepsake", modifier: { effect: {} } });
  state = Core.beginExpedition(state, 222);
  state = Core.discoverNextCell(state);
  state.expedition.unsecuredLoot = [
    { id: "a", modifier: { effect: {} } },
    { id: "b", modifier: { effect: {} } },
    { id: "c", modifier: { effect: {} } }
  ];

  state = Core.resolveDefeat(state);

  assert.equal(state.phase, "hub");
  assert.equal(state.stats.defeats, 1);
  assert.ok(state.securedLoot.some((item) => item.id === "old-keepsake"));
  assert.equal(state.securedLoot.filter((item) => ["a", "b", "c"].includes(item.id)).length, 1);
});

test("only secured loot may be equipped", () => {
  const loot = Core.rollLoot(300, 0, 0);
  let state = Core.createInitialState();

  assert.throws(() => Core.equipItem(state, loot.id), /secured loot/i);

  state.securedLoot.push({ ...loot, secured: true });
  state = Core.equipItem(state, loot.id);
  assert.equal(Core.getEquippedItem(state).id, loot.id);
});

test("equipment modifiers change combat tuning", () => {
  let state = Core.createInitialState();
  state.securedLoot.push({
    id: "breaker-wraps",
    type: "handwraps",
    style: "unarmed",
    power: 4,
    modifier: { effect: { heavyStagger: 1.8, unarmedTempo: 1.35 } }
  });
  state = Core.equipItem(state, "breaker-wraps");
  const tuning = Core.getCombatTuning(state);

  assert.equal(tuning.style, "unarmed");
  assert.equal(tuning.heavyStagger, 1.8);
  assert.equal(tuning.unarmedTempo, 1.35);
  assert.ok(tuning.lightDamage > Core.getCombatTuning(Core.createInitialState()).lightDamage);
});
