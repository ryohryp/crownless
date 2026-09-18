const test = require("node:test");
const assert = require("node:assert/strict");
const Shortcut = require("../src/hidden-shortcut.js");

test("shortcut is unavailable until discovered", () => {
  assert.deepEqual(Shortcut.choices({}), []);
});

test("discovered shortcut preserves a meaningful route tradeoff", () => {
  const state = {};
  Shortcut.discover(state);
  const options = Shortcut.choices(state);
  assert.equal(options.length, 2);
  assert.deepEqual(options.map(({ id, skipRooms, lootOpportunity }) => ({ id, skipRooms, lootOpportunity })), [
    { id: "normal", skipRooms: 0, lootOpportunity: true },
    { id: "shortcut", skipRooms: 1, lootOpportunity: false },
  ]);

  const picked = Shortcut.choose(state, "shortcut");
  assert.equal(picked.skipRooms, 1);
  assert.equal(state.hiddenShortcuts[Shortcut.SHORTCUT_ID].uses, 1);
});

test("normal route remains available without consuming shortcut use", () => {
  const state = {};
  Shortcut.discover(state);
  const picked = Shortcut.choose(state, "normal");
  assert.equal(picked.lootOpportunity, true);
  assert.equal(state.hiddenShortcuts[Shortcut.SHORTCUT_ID].uses, 0);
});

test("shortcut advances only the opening path and records the lost shallow loot", () => {
  const state = { expedition: { room: 0, stage: "path", log: ["start"] } };
  Shortcut.discover(state);
  const picked = Shortcut.applyToExpedition(state, "shortcut");
  assert.equal(picked.skipRooms, 1);
  assert.equal(state.expedition.room, 1);
  assert.match(state.expedition.log[0], /浅層の戦利品/);
  assert.equal(state.hiddenShortcuts[Shortcut.SHORTCUT_ID].uses, 1);
});

test("shortcut cannot skip a later room", () => {
  const state = { expedition: { room: 2, stage: "path", log: [] } };
  Shortcut.discover(state);
  assert.equal(Shortcut.applyToExpedition(state, "shortcut"), null);
  assert.equal(state.expedition.room, 2);
  assert.equal(state.hiddenShortcuts[Shortcut.SHORTCUT_ID].uses, 0);
});
