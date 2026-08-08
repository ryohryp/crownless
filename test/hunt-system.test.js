const test = require("node:test");
const assert = require("node:assert/strict");

function freshCore() {
  delete require.cache[require.resolve("../src/game-core.js")];
  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  return installHunts(baseCore);
}

function findStateWithTrace(Core) {
  for (let seed = 1; seed < 200; seed += 1) {
    const state = Core.beginExpedition(Core.createInitialState(), seed);
    const choices = Core.generateExplorationChoices(state);
    const trace = choices.find((choice) => choice.huntTrace && choice.eventKind !== "hunt");
    if (trace) return { state, trace };
  }
  throw new Error("Could not find deterministic hunt trace");
}

function settleLead(Core, state, choiceId) {
  let next = Core.discoverLocation(state, choiceId);
  if (next.phase === "event") {
    const option = next.expedition.pendingEvent.options[0];
    next = Core.resolveEventChoice(next, option.id);
  }
  if (next.phase === "combat") next = Core.resolveVictory(next, 82);
  return next;
}

test("a fresh game begins with the first named hunt active", () => {
  const Core = freshCore();
  const state = Core.createInitialState();
  const active = Core.getActiveHunt(state);

  assert.equal(active.id, "ash-hound");
  assert.equal(active.progress.clues, 0);
  assert.equal(active.progress.completed, false);
  assert.equal(state.stats.huntsCompleted, 0);
});

test("relevant expedition leads visibly carry target traces", () => {
  const Core = freshCore();
  const { state, trace } = findStateWithTrace(Core);

  assert.ok(["dead-kings-road", "blackthorn-copse"].includes(trace.id));
  assert.match(trace.signal, /痕跡/);
  assert.match(trace.omen, /灰牙/);
});

test("resolving a relevant location advances clue progress across the run", () => {
  const Core = freshCore();
  const { state, trace } = findStateWithTrace(Core);
  const resolved = settleLead(Core, state, trace.choiceId);
  const active = Core.getActiveHunt(resolved);

  assert.equal(active.progress.clues, 1);
  assert.equal(resolved.stats.huntClues, 1);
});

test("enough clues reveal the named target as an exploration lead", () => {
  const Core = freshCore();
  const state = Core.beginExpedition(Core.createInitialState(), 777);
  state.hunts.entries[0].clues = 2;

  const choices = Core.generateExplorationChoices(state);
  assert.equal(choices[0].choiceId, "hunt:ash-hound");
  assert.equal(choices[0].eventKind, "hunt");
  assert.equal(choices[0].risk, 5);
  assert.match(choices[0].signal, /標的/);
});

test("named target encounter uses the hunt enemy archetype", () => {
  const Core = freshCore();
  const state = Core.beginExpedition(Core.createInitialState(), 778);
  state.hunts.entries[0].clues = 2;
  const choice = Core.generateExplorationChoices(state)[0];
  const hunted = Core.discoverLocation(state, choice.choiceId);
  const enemy = hunted.expedition.encounter.enemies[0];

  assert.equal(hunted.phase, "combat");
  assert.equal(hunted.expedition.encounter.kind, "hunt");
  assert.equal(enemy.kind, "rusher");
  assert.equal(enemy.name, "灰牙");
  assert.equal(enemy.boss, true);
  assert.ok(enemy.maxHealth > 100);
});

test("defeating a named target awards its signature relic and reveals the next hunt", () => {
  const Core = freshCore();
  let state = Core.beginExpedition(Core.createInitialState(), 779);
  state.hunts.entries[0].clues = 2;
  state = Core.discoverLocation(state, "hunt:ash-hound");
  state = Core.resolveVictory(state, 64);

  const signature = state.expedition.unsecuredLoot.find((item) => item.signature && item.huntId === "ash-hound");
  assert.ok(signature);
  assert.equal(signature.name, "灰牙の血布");
  assert.equal(signature.rarity, "relic");
  assert.equal(state.stats.huntsCompleted, 1);
  assert.equal(state.hunts.entries[0].completed, true);
  assert.equal(Core.getActiveHunt(state).id, "bellless-knight");
});

test("hunt progress survives retreat and defeat", () => {
  const Core = freshCore();
  let state = Core.beginExpedition(Core.createInitialState(), 801);
  state.hunts.entries[0].clues = 2;
  state = Core.discoverLocation(state, "hunt:ash-hound");
  state = Core.resolveDefeat(state);

  assert.equal(state.phase, "hub");
  assert.equal(state.hunts.entries[0].clues, 2);
  assert.equal(state.hunts.entries[0].completed, false);

  state = Core.beginExpedition(state, 802);
  assert.equal(Core.generateExplorationChoices(state)[0].choiceId, "hunt:ash-hound");
});

test("the third signature relic adds movement speed to its combat identity", () => {
  const Core = freshCore();
  let state = Core.createInitialState();
  const relic = {
    ...Core.HUNTS[2].relic,
    id: "fen-relic-test",
    signature: true,
    secured: true
  };
  state.securedLoot.push(relic);
  state = Core.equipItem(state, relic.id);
  const tuning = Core.getCombatTuning(state);

  assert.equal(tuning.evadeEmpower, true);
  assert.ok(tuning.moveSpeed > 218);
});
