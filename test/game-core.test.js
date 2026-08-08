const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/game-core.js");

function findChoice(eventKind) {
  for (let seed = 1; seed < 800; seed += 1) {
    const state = Core.beginExpedition(Core.createInitialState(), seed);
    const choice = Core.generateExplorationChoices(state).find((candidate) => candidate.eventKind === eventKind);
    if (choice) return { seed, state, choice };
  }
  throw new Error(`No ${eventKind} choice found`);
}

test("same expedition seed produces the same exploration choices", () => {
  const firstState = Core.beginExpedition(Core.createInitialState(), 4242);
  const secondState = Core.beginExpedition(Core.createInitialState(), 4242);

  assert.deepEqual(Core.generateExplorationChoices(firstState), Core.generateExplorationChoices(secondState));
});

test("exploration presents three distinct leads with readable signals", () => {
  const state = Core.beginExpedition(Core.createInitialState(), 31337);
  const choices = Core.generateExplorationChoices(state);

  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.ok(choices.every((choice) => choice.name && choice.kicker && choice.description && choice.omen));
  assert.ok(choices.every((choice) => choice.risk >= 1 && choice.reward >= 1));
  assert.ok(choices.every((choice) => choice.signal));
});

test("event preview is deterministic for seed, depth, and lead", () => {
  const first = Core.beginExpedition(Core.createInitialState(), 5150);
  const second = Core.beginExpedition(Core.createInitialState(), 5150);
  const firstChoices = Core.generateExplorationChoices(first);
  const secondChoices = Core.generateExplorationChoices(second);

  assert.deepEqual(firstChoices.map((choice) => choice.eventKind), secondChoices.map((choice) => choice.eventKind));
});

test("enemy generation includes rusher, guard, and skirmisher identities", () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 80; seed += 1) {
    for (const location of Core.LOCATIONS) {
      const enemies = Core.buildEnemies(2, Core.createRng(seed * 97), { ...location, risk: 5 });
      enemies.forEach((enemy) => kinds.add(enemy.kind));
    }
  }

  assert.deepEqual([...kinds].sort(), ["guard", "rusher", "skirmisher"]);
});

test("cache events can reward loot without combat", () => {
  const { state, choice } = findChoice("cache");
  const resolved = Core.discoverLocation(state, choice.choiceId);

  assert.equal(resolved.phase, "decision");
  assert.equal(resolved.expedition.encounter, null);
  assert.ok(resolved.expedition.unsecuredLoot.length >= 1);
  assert.ok(resolved.expedition.lastEventSummary);
  assert.equal(resolved.stats.eventsResolved, 1);
});

test("shrine event offers a health-for-loot decision", () => {
  const { state, choice } = findChoice("shrine");
  let resolved = Core.discoverLocation(state, choice.choiceId);

  assert.equal(resolved.phase, "event");
  assert.equal(resolved.expedition.pendingEvent.kind, "shrine");

  const beforeHealth = resolved.expedition.health;
  resolved = Core.resolveEventChoice(resolved, "offer-blood");

  assert.equal(resolved.phase, "decision");
  assert.ok(resolved.expedition.health < beforeHealth);
  assert.ok(resolved.expedition.unsecuredLoot.length >= 1);
});

test("traveler information makes the next leads safer", () => {
  const { state, choice } = findChoice("traveler");
  let resolved = Core.discoverLocation(state, choice.choiceId);
  resolved = Core.resolveEventChoice(resolved, "take-rumor");

  assert.equal(resolved.phase, "decision");
  assert.ok(resolved.expedition.scouting >= 1);

  resolved = Core.continueExpedition(resolved);
  const choices = Core.generateExplorationChoices(resolved);
  assert.ok(choices.every((candidate) => candidate.risk >= 1 && candidate.risk <= 5));
});

test("following traveler tracks creates a high-reward combat encounter", () => {
  const { state, choice } = findChoice("traveler");
  let resolved = Core.discoverLocation(state, choice.choiceId);
  resolved = Core.resolveEventChoice(resolved, "follow-tracks");

  assert.equal(resolved.phase, "combat");
  assert.equal(resolved.expedition.encounter.kind, "ambush");
  assert.ok(resolved.expedition.encounter.rewardBonus >= 3);
  assert.ok(resolved.expedition.encounter.enemies.length >= 2);
});

test("legacy discoverNextCell still creates a combat encounter", () => {
  const state = Core.beginExpedition(Core.createInitialState(), 4242);
  const resolved = Core.discoverNextCell(state);

  assert.equal(resolved.phase, "combat");
  assert.ok(resolved.expedition.encounter.enemies.length >= 1);
});

test("victory produces unsecured loot and remembers fresh drops", () => {
  let state = Core.beginExpedition(Core.createInitialState(), 99);
  state = Core.discoverNextCell(state);
  state = Core.resolveVictory(state, 73);

  assert.equal(state.phase, "decision");
  assert.ok(state.expedition.unsecuredLoot.length >= 1);
  assert.equal(state.securedLoot.length, 0);
  assert.equal(state.expedition.health, 73);
  assert.ok(state.expedition.lastLootIds.length >= 1);
  assert.ok(state.expedition.lastDiscovery);
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

test("loot comparison communicates power and style changes", () => {
  let state = Core.createInitialState();
  const item = Core.rollLoot(1234, 2, 0, 4);
  const comparison = Core.compareItem(state, item);

  assert.ok(typeof comparison.summary === "string" && comparison.summary.length > 0);
  assert.equal(typeof comparison.delta, "number");

  state.securedLoot.push({ ...item, secured: true });
  state = Core.equipItem(state, item.id);
  const sameComparison = Core.compareItem(state, item);
  assert.equal(sameComparison.verdict, "同等");
  assert.equal(sameComparison.styleChange, false);
});

test("equipment modifiers still change combat tuning", () => {
  let state = Core.createInitialState();
  state.securedLoot.push({
    id: "breaker-wraps",
    type: "handwraps",
    style: "unarmed",
    power: 4,
    modifier: { effect: { heavyStagger: 1.8, unarmedTempo: 1.35, comboFinisher: 1.25 } }
  });
  state = Core.equipItem(state, "breaker-wraps");
  const tuning = Core.getCombatTuning(state);

  assert.equal(tuning.style, "unarmed");
  assert.equal(tuning.heavyStagger, 1.8);
  assert.equal(tuning.unarmedTempo, 1.35);
  assert.equal(tuning.comboFinisher, 1.25);
  assert.ok(tuning.lightDamage > Core.getCombatTuning(Core.createInitialState()).lightDamage);
});
