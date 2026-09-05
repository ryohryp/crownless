const test = require("node:test");
const assert = require("node:assert/strict");
const Journey = require("../src/expedition-journey.js");
const System = require("../src/expedition-system.js");
const Bridge = require("../src/geographic-expedition-bridge.js");
const Followup = require("../src/expedition-followup-destinations.js");
const Scenes = require("../src/expedition-scenes.js");
const Forest = require("../src/expedition-forest-approach.js");

test("the same discovered place and seed give different persistent decisions with party/gear/policy", () => {
  const entry = { key: "geo:way:482:woods", name: "霧の森", terrain: ["woods"], contentKind: "event" };
  let safe = { worldKnowledge: { discoveries: { [entry.key]: entry } } };
  const Core = { loadSafeState: () => structuredClone(safe), saveWorldKnowledge: s => { safe = structuredClone(s); return true; } };
  const results = [true, false].map(strong => {
    const system = { ...System };
    Followup.installSystemHooks({ CrownlessExpeditionSystem: system });
    Bridge.patchSystem(system, Core, null);
    const state = system.dispatchExpedition(system.initialState(), {
      destinationId: Bridge.expeditionDestinationId(entry), companionIds: strong ? ["mira", "ed"] : ["mira"],
      equipmentIds: strong ? ["shortbow", "old-knife"] : [], policyId: strong ? "standard" : "cautious", seed: 42, objective: "explore",
    }, 1000);
    const result = system.advance(state, state.activeExpedition.expectedReturnAt);
    const before = JSON.stringify(result.state);
    const next = Journey.aftermath(result.report, result.state);
    assert.equal(JSON.stringify(result.state), before);
    assert.equal(result.report.worldKnowledgeProgress.summary, result.state.completedReports[0].worldKnowledgeProgress.summary);
    assert.deepEqual(system.advance(JSON.parse(before), 999999).state, result.state);
    assert.doesNotMatch(before, /"(?:latitude|longitude|routeHistory|mapOrigin)"/);
    return { ...result, next };
  });
  assert.equal(results[0].report.outcome, "success");
  assert.equal(results[1].report.outcome, "early-return");
  assert.ok(results[0].state.securedLoot.length > results[1].state.securedLoot.length);
  assert.ok(results[1].next.injured.length);
  assert.match(Journey.briefing(results[1].state.destinations.at(-1), results[1].state).question, /備え|人選/);
});

test("chosen forest judgment, real encounter and consequences survive report projection and reload", () => {
  const system = { ...System };
  Forest.installSystemHooks({ CrownlessExpeditionSystem: system });
  Forest.setSelectedApproach(Forest.MARK_TRAIL);
  const dispatched = system.dispatchExpedition(system.initialState(), {
    destinationId: "ashen-wood", companionIds: ["mira", "ed"], equipmentIds: ["shortbow", "old-knife"], policyId: "standard", seed: 42,
  }, 1000);
  const result = system.advance(dispatched, dispatched.activeExpedition.expectedReturnAt);
  assert.equal(result.report.outcome, "success");
  const deck = Scenes.buildExpeditionScenes({ report: result.report });
  assert.ok(deck.scenes.some(s => s.kind === "departure"));
  assert.ok(deck.scenes.some(s => s.kind === "decision" && s.caption.includes("布印")));
  assert.ok(deck.scenes.some(s => s.kind.startsWith("combat")));
  assert.ok(Journey.aftermath(result.report, result.state).destinations.some(d => d.id.startsWith("forest-approach:")));
  const copy = JSON.parse(JSON.stringify(result.state));
  assert.deepEqual(Scenes.buildExpeditionScenes({ report: copy.completedReports[0] }), deck);
  for (const scene of deck.scenes) for (const id of scene.sourceEventIds) {
    assert.ok(id.startsWith("log-") || result.report.log.some(e => e.id === id || e.eventId === id));
  }
});

test("quiet old reports stay short, have no invented choices, and need no save migration", () => {
  const report = { expeditionId: "old", destinationId: "ashen-wood", outcome: "success", companionIds: ["mira"], injuries: [], discoveries: [], loot: [], log: [{ type: "return", text: "灰炉へ帰還した。" }] };
  const before = JSON.stringify(report);
  const scenes = Scenes.buildExpeditionScenes({ report }).scenes;
  assert.deepEqual(scenes.map(s => s.kind), ["return"]);
  assert.equal(JSON.stringify(report), before);
  assert.equal(Journey.aftermath(report, System.initialState()).destinations.length, 0);
});

test("adaptation offers at most two currently playable leads and does not resurrect consumed destinations", () => {
  const state = System.initialState();
  const report = { discoveries: state.destinations, followupDestinations: state.destinations, injuries: [], loot: [] };
  assert.equal(Journey.aftermath(report, state).destinations.length, 2);
  state.discoveredDestinationIds = ["black-mine"];
  assert.deepEqual(Journey.aftermath(report, state).destinations.map(d => d.id), ["black-mine"]);
});

test("a geography decorator commits the same final report when inner rules cloned the history entry", () => {
  const key = "geo:way:482:woods";
  let safe = { worldKnowledge: { discoveries: { [key]: { key, name: "森", state: "discovered", visits: 1 } } } };
  const Core = { loadSafeState: () => structuredClone(safe), saveWorldKnowledge: s => { safe = structuredClone(s); return true; } };
  const report = { expeditionId: "cloned", destinationId: `world:${key}`, outcome: "success", discoveries: [], log: [] };
  const system = {
    dispatchExpedition() {},
    advance() { return { state: { completedReports: [structuredClone(report)] }, report: structuredClone(report) }; },
  };
  Bridge.patchSystem(system, Core);
  const result = system.advance({}, 0);
  assert.deepEqual(result.state.completedReports[0], result.report);
  assert.equal(result.report.worldKnowledgeProgress.state, "investigated");
});

test("first Prepare briefing keeps the GPS discovery motivation visible", () => {
  const destination = Bridge.destinationFromKnowledge({
    key: "geo:way:482:woods",
    name: "霧の森",
    terrain: ["woods"],
    contentKind: "event"
  });
  const brief = Journey.briefing(destination, System.initialState());
  assert.match(brief.known, /現実を歩いて見つけ/);
  assert.match(brief.known, /霧の森/);
  assert.match(brief.question, /手掛かり|危険/);
});
