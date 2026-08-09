const test = require("node:test");
const assert = require("node:assert/strict");

function freshCore() {
  for (const path of ["../src/game-core.js", "../src/hunt-system.js", "../src/dungeon-system.js", "../src/progression-system.js"]) {
    delete require.cache[require.resolve(path)];
  }
  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  const installDungeons = require("../src/dungeon-system.js");
  const installProgression = require("../src/progression-system.js");
  return installProgression(installDungeons(installHunts(baseCore)));
}

function settleFirstLead(Core, state) {
  const choice = Core.generateExplorationChoices(state)[0];
  let next = Core.discoverLocation(state, choice.choiceId);
  if (next.phase === "event") {
    next = Core.resolveEventChoice(next, next.expedition.pendingEvent.options[0].id);
  }
  if (next.phase === "combat") next = Core.resolveVictory(next, 84);
  return next;
}

test("turning back without discovering anything earns no renown", () => {
  const Core = freshCore();
  let state = Core.beginExpedition(Core.createInitialState(), 1601);
  state = Core.returnHome(state);

  assert.equal(state.progression.renown, 0);
  assert.equal(state.progression.lastGain, 0);
  assert.equal(state.stats.renownEarned, 0);
});

test("a real successful expedition earns persistent renown even without a special clear", () => {
  const Core = freshCore();
  let state = Core.beginExpedition(Core.createInitialState(), 1602);
  state = settleFirstLead(Core, state);
  assert.equal(state.phase, "decision");
  state = Core.returnHome(state);

  assert.ok(state.progression.renown >= 1);
  assert.equal(state.progression.lastGain, state.progression.renown);
  assert.equal(state.stats.renownEarned, state.progression.renown);
});

test("hunt and dungeon discoveries add explicit renown bonuses", () => {
  const Core = freshCore();
  const plain = Core.renownForExpedition({
    depth: 2,
    unsecuredLoot: [{}, {}],
    discoveries: [{ eventKind: "combat" }]
  });
  const hunt = Core.renownForExpedition({
    depth: 2,
    unsecuredLoot: [{}, {}],
    discoveries: [{ eventKind: "hunt" }]
  });
  const dungeon = Core.renownForExpedition({
    depth: 2,
    unsecuredLoot: [{}, {}],
    discoveries: [{ eventKind: "dungeon-boss" }]
  });

  assert.equal(hunt - plain, 3);
  assert.equal(dungeon - plain, 5);
});

test("rank one starts expeditions with a scouting charge", () => {
  const Core = freshCore();
  const state = Core.createInitialState();
  state.progression.renown = 5;
  const run = Core.beginExpedition(state, 1603);

  assert.equal(run.progression.rank, 1);
  assert.equal(run.expedition.scouting, 1);
});

test("rank two recovers one extra unsecured item on defeat", () => {
  const Core = freshCore();
  let state = Core.createInitialState();
  state.progression.renown = 15;
  state = Core.beginExpedition(state, 1604);
  state.expedition.unsecuredLoot = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" }
  ];
  state = Core.resolveDefeat(state);

  assert.equal(state.progression.rank, 2);
  assert.equal(state.securedLoot.length, 2);
  assert.ok(state.securedLoot.some((item) => item.hearthRecovered));
});

test("rank three tempers both normal and technique damage", () => {
  const Core = freshCore();
  const low = Core.createInitialState();
  const high = Core.createInitialState();
  high.progression.renown = 30;
  Core.getHearthProgression(high);

  const lowTuning = Core.getCombatTuning(low);
  const highTuning = Core.getCombatTuning(high);
  assert.equal(high.progression.rank, 3);
  assert.equal(highTuning.lightDamage, lowTuning.lightDamage + 2);
  assert.equal(highTuning.heavyDamage, lowTuning.heavyDamage + 3);
});

test("hearth progression reports the next functional milestone", () => {
  const Core = freshCore();
  const state = Core.createInitialState();
  state.progression.renown = 7;
  const progress = Core.getHearthProgression(state);

  assert.equal(progress.rank, 1);
  assert.equal(progress.current.name, "地図掛け");
  assert.equal(progress.next.name, "回収係");
  assert.equal(progress.next.threshold, 15);
});
