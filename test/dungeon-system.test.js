const test = require("node:test");
const assert = require("node:assert/strict");

function freshCore() {
  delete require.cache[require.resolve("../src/game-core.js")];
  delete require.cache[require.resolve("../src/hunt-system.js")];
  delete require.cache[require.resolve("../src/dungeon-system.js")];
  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  const installDungeons = require("../src/dungeon-system.js");
  return installDungeons(installHunts(baseCore));
}

function stateWithFirstHuntCompleted(Core) {
  const state = Core.createInitialState();
  state.hunts.entries[0].completed = true;
  state.hunts.entries[0].clues = 2;
  state.hunts.entries[0].defeatedAtRun = 1;
  state.stats.huntsCompleted = Math.max(1, state.stats.huntsCompleted || 0);
  return state;
}

function enterDungeon(Core, seed = 1401) {
  let state = Core.beginExpedition(stateWithFirstHuntCompleted(Core), seed);
  const entrance = Core.generateExplorationChoices(state).find((choice) => choice.eventKind === "dungeon");
  assert.ok(entrance, "unlocked dungeon entrance should appear");
  state = Core.discoverLocation(state, entrance.choiceId);
  return state;
}

function reachRoom(Core, targetRoom) {
  let state = enterDungeon(Core);
  state = Core.continueExpedition(state);

  while (state.expedition.dungeon.room < targetRoom) {
    const choice = Core.generateExplorationChoices(state)[0];
    state = Core.discoverLocation(state, choice.choiceId);
    if (state.phase === "event") state = Core.resolveEventChoice(state, "dungeon-edge-through");
    if (state.phase === "combat") state = Core.resolveVictory(state, 88);
    state = Core.continueExpedition(state);
  }

  return state;
}

test("the first mini-dungeon starts locked", () => {
  const Core = freshCore();
  const state = Core.createInitialState();
  const dungeon = Core.getDungeonLedger(state)[0];

  assert.equal(dungeon.id, "ash-eater-mine");
  assert.equal(dungeon.progress.unlocked, false);
  assert.equal(dungeon.progress.completed, false);
});

test("defeating the first named hunt unlocks the dungeon entrance", () => {
  const Core = freshCore();
  const state = Core.beginExpedition(stateWithFirstHuntCompleted(Core), 1402);
  const dungeon = Core.getDungeonLedger(state)[0];
  const entrance = Core.generateExplorationChoices(state).find((choice) => choice.eventKind === "dungeon");

  assert.equal(dungeon.progress.unlocked, true);
  assert.ok(entrance);
  assert.equal(entrance.name, "灰喰い坑道");
  assert.match(entrance.signal, /ダンジョン入口/);
});

test("entering the dungeon creates a retreat point before room one", () => {
  const Core = freshCore();
  const state = enterDungeon(Core, 1403);

  assert.equal(state.phase, "decision");
  assert.equal(state.expedition.dungeon.active, true);
  assert.equal(state.expedition.dungeon.room, 0);
  assert.equal(state.expedition.dungeon.roomCleared, false);
  assert.match(state.expedition.lastEventSummary, /三つの区画/);
});

test("room one offers a trap route and a combat route", () => {
  const Core = freshCore();
  let state = enterDungeon(Core, 1404);
  state = Core.continueExpedition(state);
  const choices = Core.generateExplorationChoices(state);

  assert.equal(state.phase, "explore");
  assert.equal(choices.length, 2);
  assert.ok(choices.some((choice) => choice.eventKind === "dungeon-trap"));
  assert.ok(choices.some((choice) => choice.eventKind === "dungeon-combat"));
});

test("taking the trap cache trades health for loot and clears the room", () => {
  const Core = freshCore();
  let state = enterDungeon(Core, 1405);
  state = Core.continueExpedition(state);
  const trap = Core.generateExplorationChoices(state).find((choice) => choice.eventKind === "dungeon-trap");
  state = Core.discoverLocation(state, trap.choiceId);
  const hpBefore = state.expedition.health;
  const lootBefore = state.expedition.unsecuredLoot.length;
  state = Core.resolveEventChoice(state, "dungeon-take-cache");

  assert.equal(state.phase, "decision");
  assert.equal(state.expedition.dungeon.roomCleared, true);
  assert.ok(state.expedition.health < hpBefore);
  assert.equal(state.expedition.unsecuredLoot.length, lootBefore + 1);
  assert.equal(state.expedition.lastLootIds.length, 1);
});

test("continuing after a cleared room descends exactly one room", () => {
  const Core = freshCore();
  let state = enterDungeon(Core, 1406);
  state = Core.continueExpedition(state);
  const trap = Core.generateExplorationChoices(state).find((choice) => choice.eventKind === "dungeon-trap");
  state = Core.discoverLocation(state, trap.choiceId);
  state = Core.resolveEventChoice(state, "dungeon-edge-through");
  state = Core.continueExpedition(state);

  assert.equal(state.phase, "explore");
  assert.equal(state.expedition.dungeon.room, 1);
  assert.equal(state.expedition.dungeon.roomCleared, false);
  assert.ok(Core.generateExplorationChoices(state).every((choice) => choice.eventKind === "dungeon-elite"));
});

test("the second room is an elite fight and victory creates another retreat point", () => {
  const Core = freshCore();
  let state = reachRoom(Core, 1);
  const elite = Core.generateExplorationChoices(state)[0];
  state = Core.discoverLocation(state, elite.choiceId);

  assert.equal(state.phase, "combat");
  assert.equal(state.expedition.encounter.kind, "dungeon");
  assert.equal(state.expedition.encounter.dungeonRoom, 1);
  assert.ok(state.expedition.encounter.enemies.some((enemy) => enemy.elite));

  state = Core.resolveVictory(state, 73);
  assert.equal(state.phase, "decision");
  assert.equal(state.expedition.dungeon.roomCleared, true);
  assert.match(state.expedition.lastEventSummary, /今なら帰れる/);
});

test("the final room contains the warden and first clear awards a unique relic", () => {
  const Core = freshCore();
  let state = reachRoom(Core, 2);
  const bossChoice = Core.generateExplorationChoices(state)[0];
  state = Core.discoverLocation(state, bossChoice.choiceId);
  const boss = state.expedition.encounter.enemies[0];

  assert.equal(boss.name, "鉄杭の番人");
  assert.equal(boss.boss, true);
  assert.ok(boss.maxHealth >= 160);

  state = Core.resolveVictory(state, 51);
  const relic = state.expedition.unsecuredLoot.find((item) => item.dungeonId === "ash-eater-mine" && item.signature);
  const dungeon = Core.getDungeonLedger(state)[0];

  assert.ok(relic);
  assert.equal(relic.name, "坑道守の鎖刃");
  assert.equal(relic.rarity, "relic");
  assert.equal(dungeon.progress.completed, true);
  assert.equal(dungeon.progress.clears, 1);
  assert.equal(state.stats.dungeonsCleared, 1);
  assert.equal(state.expedition.dungeon.active, false);
  assert.match(state.expedition.lastEventSummary, /生還して初めて/);
});

test("retreat from inside the dungeon preserves the permanent unlock", () => {
  const Core = freshCore();
  let state = enterDungeon(Core, 1407);
  state = Core.continueExpedition(state);
  const fight = Core.generateExplorationChoices(state).find((choice) => choice.eventKind === "dungeon-combat");
  state = Core.discoverLocation(state, fight.choiceId);
  state = Core.resolveVictory(state, 79);
  state = Core.returnHome(state);

  assert.equal(state.phase, "hub");
  assert.equal(state.expedition, null);
  assert.equal(Core.getDungeonLedger(state)[0].progress.unlocked, true);
});

test("defeat inside the dungeon does not relock it", () => {
  const Core = freshCore();
  let state = reachRoom(Core, 1);
  const elite = Core.generateExplorationChoices(state)[0];
  state = Core.discoverLocation(state, elite.choiceId);
  state = Core.resolveDefeat(state);

  assert.equal(state.phase, "hub");
  assert.equal(Core.getDungeonLedger(state)[0].progress.unlocked, true);
  assert.equal(Core.getDungeonLedger(state)[0].progress.completed, false);
});
