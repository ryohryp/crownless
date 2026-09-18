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
