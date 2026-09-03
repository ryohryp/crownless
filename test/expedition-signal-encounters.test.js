"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const encounters = require("../src/expedition-signal-encounters.js");

function coreHarness() {
  let state = { worldKnowledge: { discoveries: {} } };
  return {
    core: {
      loadSafeState: () => JSON.parse(JSON.stringify(state)),
      sanitizeWorldKnowledge: (value) => value && typeof value === "object" ? value : { discoveries: {} },
      saveWorldKnowledge: (next) => {
        state = JSON.parse(JSON.stringify(next));
        return true;
      }
    },
    state: () => JSON.parse(JSON.stringify(state))
  };
}

function expedition(destinationId = encounters.ROADSIDE_DESTINATION_ID, equipmentIds = []) {
  return {
    id: "exp-roadside-signal",
    inputs: {
      destinationId,
      companionIds: ["mira"],
      equipmentIds,
      policyId: "standard",
      objective: "explore"
    }
  };
}

function report(outcome = "success") {
  return {
    expeditionId: "exp-roadside-signal",
    outcome,
    destinationId: encounters.ROADSIDE_DESTINATION_ID,
    loot: [],
    discoveries: [],
    log: [{ minute: 80, time: "08:00", type: "return", text: "帰路についた。", causes: [] }]
  };
}

function signalState(wrapped) {
  const state = wrapped.initialState();
  state.destinations.push({
    id: encounters.ROADSIDE_DESTINATION_ID,
    name: "街道の異変",
    family: "village",
    dangerTags: ["bandit"],
    opportunityTags: ["tracks", "rumor"],
    durationMs: 0
  });
  state.discoveredDestinationIds.push(encounters.ROADSIDE_DESTINATION_ID);
  return state;
}

test("roadside signal becomes a coarse geographic expedition destination without precise location data", () => {
  const harness = coreHarness();
  const entry = encounters.ensureRoadsideDiscovery({ CrownlessCore: harness.core }, 123456);

  assert.equal(entry.key, encounters.ROADSIDE_DISCOVERY_KEY);
  assert.equal(entry.name, "街道の異変");
  assert.deepEqual(entry.terrain, ["road_hub"]);
  assert.equal(entry.contentKind, "signal");
  assert.equal(entry.firstDiscoveredAt, 123456);
  const serialized = JSON.stringify(harness.state());
  assert.doesNotMatch(serialized, /latitude|longitude|coords|routeHistory|exact/i);
});

test("roadside signal reuses the existing expedition preparation action", () => {
  const harness = coreHarness();
  const calls = [];
  const document = {};
  const root = {
    CrownlessCore: harness.core,
    CrownlessWorldAtlasActionsPresentation: {
      openExpedition: (passedDocument, passedRoot, entry, status) => {
        calls.push({ passedDocument, passedRoot, entry, status });
        return true;
      }
    }
  };

  assert.equal(encounters.openRoadsideExpedition(document, root), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].passedDocument, document);
  assert.equal(calls[0].passedRoot, root);
  assert.equal(calls[0].entry.key, encounters.ROADSIDE_DISCOVERY_KEY);
  assert.equal(calls[0].status, null);
});

test("successful signal expedition reveals an injured traveler exactly once in the report", () => {
  const value = report("success");
  const exp = expedition();

  encounters.applyRoadsideEncounter(value, exp);
  encounters.applyRoadsideEncounter(value, exp);

  assert.equal(value.signalEncounter.id, encounters.ROADSIDE_ENCOUNTER_ID);
  assert.equal(value.signalEncounter.kind, "injured-traveler");
  assert.equal(value.log.filter((entry) => entry.type === "signal-encounter").length, 1);
  assert.match(value.log.find((entry) => entry.type === "signal-encounter").text, /負傷した旅人/);
});

test("herb kit turns the injured traveler discovery into first aid exactly once", () => {
  const value = report("success");
  const exp = expedition(encounters.ROADSIDE_DESTINATION_ID, ["herb-kit"]);

  encounters.applyRoadsideEncounter(value, exp);
  encounters.applyRoadsideEncounter(value, exp);

  assert.equal(value.signalEncounter.aid.id, encounters.ROADSIDE_HERB_AID_ID);
  assert.equal(value.signalEncounter.aid.equipmentId, "herb-kit");
  assert.equal(value.signalEncounter.aid.outcome, "stabilized");
  assert.equal(value.log.filter((entry) => entry.type === "signal-aid").length, 1);
  assert.match(value.log.find((entry) => entry.type === "signal-aid").text, /薬草包み.*応急手当/);
  assert.equal(value.notableEvent.type, "signal-aid");
});

test("without herb kit the traveler is found but not treated", () => {
  const value = report("success");
  encounters.applyRoadsideEncounter(value, expedition());

  assert.equal(value.signalEncounter.kind, "injured-traveler");
  assert.equal(value.signalEncounter.aid, undefined);
  assert.equal(value.log.some((entry) => entry.type === "signal-aid"), false);
});

test("failed or unrelated expeditions do not invent a roadside encounter or aid", () => {
  const failed = report("failed");
  const unrelated = report("success");
  encounters.applyRoadsideEncounter(failed, expedition(encounters.ROADSIDE_DESTINATION_ID, ["herb-kit"]));
  encounters.applyRoadsideEncounter(unrelated, expedition("ashen-wood", ["herb-kit"]));

  assert.equal(failed.signalEncounter, undefined);
  assert.equal(unrelated.signalEncounter, undefined);
  assert.equal(failed.log.some((entry) => entry.type === "signal-encounter" || entry.type === "signal-aid"), false);
  assert.equal(unrelated.log.some((entry) => entry.type === "signal-encounter" || entry.type === "signal-aid"), false);
});

test("installed resolver hook exposes the signal encounter through normal expedition resolution", () => {
  const wrapped = { ...system };
  encounters.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  let selected = null;

  for (let seed = 1; seed <= 300 && !selected; seed += 1) {
    const state = signalState(wrapped);
    const dispatched = wrapped.dispatchExpedition(state, {
      destinationId: encounters.ROADSIDE_DESTINATION_ID,
      companionIds: ["mira", "ed"],
      equipmentIds: ["shortbow"],
      policyId: "standard",
      objective: "explore",
      seed,
      durationMs: 0
    }, 1_000_000 + seed);
    const resolved = wrapped.resolveExpedition(dispatched.activeExpedition, dispatched);
    if (resolved.outcome === "success") selected = resolved;
  }

  assert.ok(selected, "expected a successful roadside expedition seed");
  assert.equal(selected.signalEncounter.kind, "injured-traveler");
  assert.ok(selected.log.some((entry) => entry.type === "signal-encounter"));
});

test("normal resolver resolution exposes herb first aid when the supply was prepared", () => {
  const wrapped = { ...system };
  encounters.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  let selected = null;

  for (let seed = 1; seed <= 300 && !selected; seed += 1) {
    const state = signalState(wrapped);
    const dispatched = wrapped.dispatchExpedition(state, {
      destinationId: encounters.ROADSIDE_DESTINATION_ID,
      companionIds: ["mira", "ed"],
      equipmentIds: ["shortbow", "herb-kit"],
      policyId: "standard",
      objective: "explore",
      seed,
      durationMs: 0
    }, 2_000_000 + seed);
    const resolved = wrapped.resolveExpedition(dispatched.activeExpedition, dispatched);
    if (resolved.outcome === "success") selected = resolved;
  }

  assert.ok(selected, "expected a successful roadside expedition seed with herb kit");
  assert.equal(selected.signalEncounter.aid.outcome, "stabilized");
  assert.ok(selected.log.some((entry) => entry.type === "signal-aid"));
});

test("browser bridge loads the signal encounter sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-signal-encounters\.js/);
  assert.match(bridgeSource, /loadSignalEncounters/);
});
