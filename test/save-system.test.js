const test = require("node:test");
const assert = require("node:assert/strict");

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function freshCore(storage) {
  global.localStorage = storage;
  for (const path of [
    "../src/game-core.js",
    "../src/hunt-system.js",
    "../src/dungeon-system.js",
    "../src/progression-system.js",
    "../src/save-system.js"
  ]) {
    delete require.cache[require.resolve(path)];
  }
  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  const installDungeons = require("../src/dungeon-system.js");
  const installProgression = require("../src/progression-system.js");
  const installSave = require("../src/save-system.js");
  return installSave(installProgression(installDungeons(installHunts(baseCore))));
}

function settleFirstLead(Core, state) {
  const choice = Core.generateExplorationChoices(state)[0];
  let next = Core.discoverLocation(state, choice.choiceId);
  if (next.phase === "event") next = Core.resolveEventChoice(next, next.expedition.pendingEvent.options[0].id);
  if (next.phase === "combat") next = Core.resolveVictory(next, 88);
  return next;
}

test("a fresh game creates a versioned safe hub snapshot", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const state = Core.createInitialState();
  const raw = storage.getItem(Core.SAVE_KEY);

  assert.ok(raw);
  const payload = JSON.parse(raw);
  assert.equal(payload.version, 1);
  assert.equal(payload.state.phase, "hub");
  assert.equal(payload.state.expedition, null);
  assert.equal(state.phase, "hub");
  delete global.localStorage;
});

test("saved safe state is loaded on the next initialization", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const state = Core.createInitialState();
  state.progression.renown = 18;
  Core.getHearthProgression(state);
  state.securedLoot.push({ id: "saved-item", name: "Saved", power: 9, modifier: { effect: {} } });
  state.equippedItemId = "saved-item";
  assert.equal(Core.saveSafeState(state), true);

  const loaded = Core.createInitialState();
  assert.equal(loaded.progression.renown, 18);
  assert.equal(loaded.progression.rank, 2);
  assert.equal(loaded.securedLoot.length, 1);
  assert.equal(loaded.equippedItemId, "saved-item");
  delete global.localStorage;
});

test("active expedition state is never written as the safe snapshot", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const safe = Core.createInitialState();
  safe.progression.renown = 6;
  Core.getHearthProgression(safe);
  Core.saveSafeState(safe);

  const active = Core.beginExpedition(safe, 1701);
  active.progression.renown = 99;
  assert.equal(Core.saveSafeState(active), false);

  const loaded = Core.createInitialState();
  assert.equal(loaded.phase, "hub");
  assert.equal(loaded.expedition, null);
  assert.equal(loaded.progression.renown, 6);
  delete global.localStorage;
});

test("returning home saves secured loot and newly earned renown", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  let state = Core.beginExpedition(Core.createInitialState(), 1702);
  state = settleFirstLead(Core, state);
  state = Core.returnHome(state);
  assert.ok(state.progression.renown > 0);

  const loaded = Core.createInitialState();
  assert.equal(loaded.progression.renown, state.progression.renown);
  assert.equal(loaded.securedLoot.length, state.securedLoot.length);
  assert.equal(loaded.stats.expeditionsSurvived, state.stats.expeditionsSurvived);
  delete global.localStorage;
});

test("defeat saves the recovered safe state rather than the unfinished run", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  let state = Core.createInitialState();
  state.progression.renown = 15;
  Core.getHearthProgression(state);
  state = Core.beginExpedition(state, 1703);
  state.expedition.unsecuredLoot = [
    { id: "loss-a", name: "A" },
    { id: "loss-b", name: "B" },
    { id: "loss-c", name: "C" }
  ];
  state = Core.resolveDefeat(state);

  const loaded = Core.createInitialState();
  assert.equal(loaded.phase, "hub");
  assert.equal(loaded.securedLoot.length, 2);
  assert.equal(loaded.progression.renown, 15);
  delete global.localStorage;
});

test("corrupt storage fails safely and falls back to a fresh game", () => {
  const storage = memoryStorage();
  storage.setItem("crownless.safe.v1", "{not json");
  const Core = freshCore(storage);
  const state = Core.createInitialState();

  assert.equal(state.phase, "hub");
  assert.equal(state.progression.renown, 0);
  assert.equal(state.securedLoot.length, 0);
  delete global.localStorage;
});
