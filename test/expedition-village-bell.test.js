"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const village = require("../src/expedition-village-bell.js");

function expedition(approachId, destinationId = village.DESTINATION_ID) {
  return {
    id: `exp-${approachId}`,
    inputs: {
      destinationId,
      villageApproach: approachId,
      companionIds: ["mira"],
      policyId: "standard",
    },
  };
}

function report(outcome = "success") {
  return { expeditionId: "exp-test", outcome, discoveries: [], log: [] };
}

function state() {
  return {
    destinations: [{
      id: village.DESTINATION_ID,
      name: "空鐘の廃村",
      family: "village",
      dangerTags: ["bandit", "collapse"],
      opportunityTags: ["salvage", "rumor", "cellar"],
      durationMs: 240000,
    }],
    discoveredDestinationIds: [village.DESTINATION_ID],
    completedReports: [],
  };
}

test("ringing the village bell reveals an answering-smoke lead", () => {
  const value = report();
  village.decorateReport(value, expedition(village.RING));

  assert.equal(value.villageChoice.approachId, village.RING);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "鐘に応えた遠い煙");
  assert.match(value.log.find((entry) => entry.type === "village-choice").text, /煙/);

  const current = state();
  const unlocked = village.unlockFollowup(current, value);
  assert.equal(unlocked.name, "鐘に応えた遠い煙");
  assert.deepEqual(unlocked.opportunityTags, ["survivor", "rumor", "contact"]);
});

test("quiet search reveals a sealed cellar instead of the human-response lead", () => {
  const value = report();
  village.decorateReport(value, expedition(village.QUIET));

  assert.equal(value.villageChoice.approachId, village.QUIET);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "足音のない封鎖地下蔵");
  assert.doesNotMatch(value.discoveries[0].id, /answering-smoke/);
  assert.match(value.log.find((entry) => entry.type === "village-choice").text, /地下蔵/);
});

test("one expedition cannot produce both village branches and apply is idempotent", () => {
  const value = report();
  village.decorateReport(value, expedition(village.RING));
  village.decorateReport(value, expedition(village.RING));
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.log.filter((entry) => entry.type === "village-choice").length, 1);

  const current = state();
  village.unlockFollowup(current, value);
  village.unlockFollowup(current, value);
  assert.equal(current.destinations.filter((item) => item.id === value.villageChoice.destinationId).length, 1);
  assert.equal(current.discoveredDestinationIds.filter((id) => id === value.villageChoice.destinationId).length, 1);
});

test("failure and unrelated destinations do not create a village branch", () => {
  const failed = report("retreat");
  village.decorateReport(failed, expedition(village.RING));
  assert.equal(failed.villageChoice, undefined);
  assert.deepEqual(failed.discoveries, []);

  const unrelated = report();
  village.decorateReport(unrelated, expedition(village.RING, "ashen-wood"));
  assert.equal(unrelated.villageChoice, undefined);
  assert.deepEqual(unrelated.discoveries, []);
});

test("unknown bridge loads the village bell sidecar", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(bridge, /loadVillageBell\(root\)/);
  assert.match(bridge, /CrownlessExpeditionVillageBell/);
  assert.match(bridge, /src\/expedition-village-bell\.js/);
});
test("successful follow-up return rebuilds the village and changes revisit opportunities", () => {
  const current = state();
  const first = report();
  village.decorateReport(first, expedition(village.RING));
  const lead = village.unlockFollowup(current, first);
  const followup = { inputs: { destinationId: lead.id } };
  const returned = report();
  const changed = village.restoreVillage(current, returned, followup);
  assert.equal(changed.name, "見張り火の灯る村");
  assert.ok(changed.opportunityTags.includes("safe-camp"));
  assert.ok(!changed.dangerTags.includes("bandit"));
  assert.equal(returned.villageRestoration.stage, "watchfire");
  village.restoreVillage(current, returned, followup);
  assert.equal(returned.log.filter((entry) => entry.type === "village-restoration").length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(current)).destinations[0], changed);
});

test("cellar follow-up restores workshop; retreat never rebuilds village", () => {
  const current = state();
  const first = report();
  village.decorateReport(first, expedition(village.QUIET));
  const lead = village.unlockFollowup(current, first);
  const followup = { inputs: { destinationId: lead.id } };
  assert.equal(village.restoreVillage(current, report("retreat"), followup), null);
  assert.equal(current.destinations[0].villageRestoration, undefined);
  const changed = village.restoreVillage(current, report(), followup);
  assert.equal(changed.name, "物資庫を取り戻した村");
  assert.ok(changed.opportunityTags.includes("workshop"));
  assert.ok(!changed.dangerTags.includes("collapse"));
  assert.equal(village.restoreVillage(current, report(), { inputs: { destinationId: "unrelated" } }), null);
});

test("restored village revisits bank supplies through automatic advance without duplication", () => {
  const engine = require("../src/expedition-system.js");
  const system = { ...engine };
  village.installSystemHooks({ CrownlessExpeditionSystem: system });
  const current = engine.initialState();
  const source = current.destinations.find((item) => item.id === village.DESTINATION_ID);
  source.villageRestoration = "storehouse";
  const input = { destinationId: village.DESTINATION_ID, companionIds: ["mira"], equipmentIds: [], policyId: "standard", durationMs: 0, seed: 123 };
  const dispatched = system.dispatchExpedition(current, input, 1000);
  const result = system.advance(dispatched, 1001);
  assert.equal(result.status, "completed");
  if (result.report.outcome === "success") {
    assert.equal(result.report.loot.filter((item) => item.id === "village-storehouse-ore").length, 1);
    assert.equal(result.state.securedLoot.filter((item) => item.id === "village-storehouse-ore").length, 1);
    assert.equal(system.applyReport(result.state, result.report).securedLoot.filter((item) => item.id === "village-storehouse-ore").length, 1);
  } else {
    assert.equal(result.state.securedLoot.filter((item) => item.id === "village-storehouse-ore").length, 0);
  }
});

test("restored village preparation changes actual combat without permanent free equipment", () => {
  const engine = require("../src/expedition-system.js");
  const system = { ...engine };
  village.installSystemHooks({ CrownlessExpeditionSystem: system });
  const current = engine.initialState();
  const source = current.destinations.find((item) => item.id === village.DESTINATION_ID);
  source.villageRestoration = "watchfire";
  const base = {
    id: "exp-village-prepare", seed: 123, startedAt: 1000,
    inputs: { destinationId: village.DESTINATION_ID, companionIds: ["mira"], equipmentIds: [], policyId: "standard", villagePreparation: "scout" },
  };
  const unprepared = engine.resolveExpedition(base, current);
  const prepared = system.resolveExpedition(base, current);
  assert.equal(prepared.villagePreparation, "scout");
  assert.ok(prepared.log.some((entry) => entry.type === "village-preparation"));
  assert.ok(prepared.combat.encounters.some((combat) => combat.rounds.some((round) => round.events.includes("ambush"))));
  assert.ok(!unprepared.combat.encounters.some((combat) => combat.rounds.some((round) => round.events.includes("ambush"))));
  assert.equal(current.equipment.some((item) => item.id.startsWith("village-preparation-")), false);
  const supply = system.resolveExpedition({ ...base, inputs: { ...base.inputs, villagePreparation: "supplies" } }, current);
  assert.equal(supply.villagePreparation, "supplies");
  assert.ok(supply.log.some((entry) => /応急手当/.test(entry.text)));
  const noRestoration = engine.initialState();
  assert.equal(system.resolveExpedition(base, noRestoration).villagePreparation, undefined);
});

test("restoration unlocks one repeatable destination that survives reload", () => {
  const engine = require("../src/expedition-system.js");
  for (const approach of [village.RING, village.QUIET]) {
    const current = engine.initialState();
    const first = report();
    village.decorateReport(first, expedition(approach));
    const lead = village.unlockFollowup(current, first);
    const returned = report();
    returned.destinationId = lead.id;
    const restored = village.restoreVillage(current, returned);
    const routeId = returned.villageRestoration.routeId;
    const route = current.destinations.find((item) => item.id === routeId);
    assert.ok(restored);
    assert.ok(route);
    assert.ok(current.discoveredDestinationIds.includes(routeId));
    assert.equal(route.villageRestoredRoute, approach === village.RING ? "watchfire" : "storehouse");
    assert.equal(village.unlockRestoredRoute(current, route.villageRestoredRoute), route);
    assert.equal(current.destinations.filter((item) => item.id === routeId).length, 1);
    const reloaded = engine.normalizeState(JSON.parse(JSON.stringify(current)));
    assert.ok(reloaded.destinations.some((item) => item.id === routeId));
    const dispatched = engine.dispatchExpedition(reloaded, {
      destinationId: routeId, companionIds: ["mira"], equipmentIds: [], policyId: "cautious",
    }, 1000);
    assert.equal(dispatched.activeExpedition.inputs.destinationId, routeId);
  }
});

test("failed follow-up does not reveal restored route", () => {
  const current = state();
  const first = report();
  village.decorateReport(first, expedition(village.RING));
  const lead = village.unlockFollowup(current, first);
  const failed = report("retreat");
  failed.destinationId = lead.id;
  assert.equal(village.restoreVillage(current, failed), null);
  assert.equal(current.destinations.some((item) => item.villageRestoredRoute), false);
});

test("restored roads give different material loot on success, not retreat, without duplicates", () => {
  const current = state();
  village.unlockRestoredRoute(current, "watchfire");
  village.unlockRestoredRoute(current, "storehouse");
  const system = {
    dispatchExpedition: (s) => s,
    resolveExpedition: (exp) => ({ expeditionId: exp.id, destinationId: exp.inputs.destinationId, outcome: exp.outcome, loot: [], log: [] }),
    applyReport: (s) => s,
    advance: (s) => ({ state: s, report: null }),
    normalizeState: (s) => s,
  };
  village.installSystemHooks({ CrownlessExpeditionSystem: system });
  const run = (id, outcome = "success") => system.resolveExpedition({ id: "exp", inputs: { destinationId: id }, outcome }, current);
  const medicine = run("village-restored:watch-road");
  const ore = run("village-restored:ore-trail");
  assert.equal(medicine.loot[0].id, "watch-road-medicine");
  assert.equal(ore.loot[0].id, "ore-trail-iron");
  assert.deepEqual(run("village-restored:ore-trail", "retreat").loot, []);
  system.applyReport(current, medicine);
  system.applyReport(current, medicine);
  assert.equal(medicine.loot.length, 1);
  assert.equal(medicine.log.filter((item) => item.type === "restored-road-loot").length, 1);
});

test("clearing the watch road builds a persistent watchtower only after success", () => {
  const current = state();
  current.destinations[0].villageRestoration = "watchfire";
  const road = village.unlockRestoredRoute(current, "watchfire");
  const result = { ...report(), destinationId: road.id };
  assert.equal(village.upgradeVillageFromRoad(current, { ...result, outcome: "retreat" }), null);
  assert.equal(current.destinations[0].villageFacility, undefined);
  village.upgradeVillageFromRoad(current, result);
  assert.equal(current.destinations[0].villageFacility, "watchtower");
  assert.ok(current.destinations[0].opportunityTags.includes("scouting"));
  village.upgradeVillageFromRoad(current, result);
  assert.equal(result.log.filter((item) => item.type === "village-facility").length, 1);
  assert.equal(JSON.parse(JSON.stringify(current)).destinations[0].villageFacility, "watchtower");
});

test("ore road opens a forge, but unrelated roads cannot upgrade the village", () => {
  const current = state();
  current.destinations[0].villageRestoration = "storehouse";
  const road = village.unlockRestoredRoute(current, "storehouse");
  assert.equal(village.upgradeVillageFromRoad(current, { ...report(), destinationId: "unknown" }), null);
  village.upgradeVillageFromRoad(current, { ...report(), destinationId: road.id });
  assert.equal(current.destinations[0].villageFacility, "forge");
  assert.ok(current.destinations[0].opportunityTags.includes("smithing"));
});

test("forge consumes one safely returned iron and opens a persistent mine", () => {
  const current = state();
  current.destinations[0].villageRestoration = "storehouse";
  current.destinations[0].villageFacility = "forge";
  current.securedLoot = [
    { id: "ore-trail-iron", sourceExpeditionId: "safe-1" },
    { id: "ore-trail-iron", sourceExpeditionId: "safe-2" },
  ];
  const opened = village.forgeMinePass(current);
  assert.equal(opened.id, "village-forge:sealed-mine");
  assert.equal(current.securedLoot.length, 1);
  assert.ok(current.discoveredDestinationIds.includes(opened.id));
  assert.equal(village.forgeMinePass(current).id, opened.id);
  assert.equal(current.securedLoot.length, 1, "repeat craft cannot consume again");
  const engine = require("../src/expedition-system.js");
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.ok(restored.destinations.some((item) => item.id === opened.id));
});

test("forge pass cannot be crafted without facility or banked ore", () => {
  const current = state();
  current.securedLoot = [{ id: "ore-trail-iron" }];
  assert.equal(village.forgeMinePass(current), null);
  current.destinations[0].villageFacility = "forge";
  current.securedLoot = [];
  assert.equal(village.forgeMinePass(current), null);
  assert.equal(current.destinations.length, 1);
});

test("deep mine consumes returned medicine and grants star ore only on success", () => {
  const current = state();
  current.securedLoot = [{ id: "watch-road-medicine", sourceExpeditionId: "safe-return" }];
  const mission = { inputs: { destinationId: "village-forge:sealed-mine" } };
  assert.equal(village.prepareMineDelve(current, mission, "deep"), true);
  assert.equal(current.securedLoot.length, 0);
  const won = report();
  assert.equal(village.rewardMineDelve(won, mission), true);
  assert.equal(won.loot[0].id, "sealed-mine-star-ore");
  assert.equal(village.rewardMineDelve(won, mission), false);
  assert.equal(won.loot.length, 1);
  const lost = report("retreat");
  assert.equal(village.rewardMineDelve(lost, mission), false);
  assert.equal(lost.loot, undefined);
});

test("safe mining and missing medicine cannot mint rare ore", () => {
  const current = state();
  current.securedLoot = [];
  const mission = { inputs: { destinationId: "village-forge:sealed-mine" } };
  assert.equal(village.prepareMineDelve(current, mission, "deep"), false);
  assert.equal(village.rewardMineDelve(report(), mission), false);
  current.securedLoot.push({ id: "watch-road-medicine" });
  assert.equal(village.prepareMineDelve(current, mission, "safe"), false);
  assert.equal(current.securedLoot.length, 1);
  assert.equal(village.rewardMineDelve(report(), mission), false);
});

test("unstable shaft spends medicine, forces greedy combat and awards two rare materials on success", () => {
  const current = state();
  current.securedLoot = [{ id: "watch-road-medicine", sourceExpeditionId: "returned" }];
  const mission = { inputs: { destinationId: "village-forge:sealed-mine", policyId: "cautious" } };
  assert.equal(village.prepareMineDelve(current, mission, "unstable"), true);
  assert.equal(current.securedLoot.length, 0);
  assert.equal(mission.inputs.policyId, "greedy");
  const won = report();
  assert.equal(village.rewardMineDelve(won, mission), true);
  assert.deepEqual(won.loot.map(item => item.id), ["sealed-mine-star-ore", "sealed-mine-deep-crystal"]);
  assert.equal(village.rewardMineDelve(won, mission), false);
  assert.equal(won.loot.length, 2);
  const lost = report("retreat");
  assert.equal(village.rewardMineDelve(lost, mission), false);
  assert.equal(lost.loot, undefined);
});

test("unstable shaft without returned medicine cannot change combat policy", () => {
  const current = state();
  current.securedLoot = [];
  const mission = { inputs: { destinationId: "village-forge:sealed-mine", policyId: "cautious" } };
  assert.equal(village.prepareMineDelve(current, mission, "unstable"), false);
  assert.equal(mission.inputs.policyId, "cautious");
  assert.equal(village.rewardMineDelve(report(), mission), false);
});

test("shored mine consumes crafted supports instead of medicine and avoids greedy combat", () => {
  const current = state();
  current.securedLoot = [
    { id: "village-forged-parts", sourceExpeditionId: "returned-village" },
    { id: "watch-road-medicine", sourceExpeditionId: "returned-road" },
  ];
  const mission = { inputs: { destinationId: "village-forge:sealed-mine", policyId: "cautious" } };
  assert.equal(village.prepareMineDelve(current, mission, "shored"), true);
  assert.equal(mission.inputs.policyId, "cautious", "supports preserve the chosen combat policy");
  assert.deepEqual(current.securedLoot.map(item => item.id), ["watch-road-medicine"]);
  const won = report();
  assert.equal(village.rewardMineDelve(won, mission), true);
  assert.deepEqual(won.loot.map(item => item.id), ["sealed-mine-star-ore", "sealed-mine-deep-crystal"]);
  assert.equal(village.rewardMineDelve(won, mission), false);
  assert.equal(won.loot.length, 2);
  assert.equal(village.rewardMineDelve(report("retreat"), mission), false);
});

test("shoring requires returned crafted parts and cannot spend unrelated materials", () => {
  const current = state();
  current.securedLoot = [{ id: "watch-road-medicine" }];
  const mission = { inputs: { destinationId: "village-forge:sealed-mine", policyId: "standard" } };
  assert.equal(village.prepareMineDelve(current, mission, "shored"), false);
  assert.equal(current.securedLoot.length, 1);
  assert.equal(mission.inputs.villageMineDelve, undefined);
});

test("deep crystal builds a persistent beacon route and cannot double spend", () => {
  const current = state();
  current.destinations[0].villageFacility = "forge";
  current.destinations.push({ id: "village-forge:sealed-mine" });
  current.securedLoot = [
    { id: "sealed-mine-deep-crystal", sourceExpeditionId: "safe-1" },
    { id: "sealed-mine-deep-crystal", sourceExpeditionId: "safe-2" },
  ];
  const grotto = village.buildCrystalBeacon(current);
  assert.equal(grotto.id, "village-forge:crystal-grotto");
  assert.equal(current.securedLoot.length, 1);
  assert.ok(current.discoveredDestinationIds.includes(grotto.id));
  assert.equal(current.destinations[0].villageCrystalBeacon, true);
  assert.equal(village.buildCrystalBeacon(current), grotto);
  assert.equal(current.securedLoot.length, 1);
  const engine = require("../src/expedition-system.js");
  const reloaded = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.ok(reloaded.destinations.some(item => item.id === grotto.id));
});

test("beacon requires forged mine, forge and safely banked crystal", () => {
  const current = state();
  current.securedLoot = [{ id: "sealed-mine-deep-crystal" }];
  assert.equal(village.buildCrystalBeacon(current), null);
  current.destinations[0].villageFacility = "forge";
  assert.equal(village.buildCrystalBeacon(current), null);
  current.destinations.push({ id: "village-forge:sealed-mine" });
  current.securedLoot = [{ id: "sealed-mine-star-ore" }];
  assert.equal(village.buildCrystalBeacon(current), null);
  assert.equal(current.destinations.some(item => item.villageCrystalBeacon), false);
});

test("grotto shadow detour forces risky policy and rewards only safe return", () => {
  const mission = { inputs: { destinationId: "village-forge:crystal-grotto", policyId: "careful" } };
  assert.equal(village.prepareGrottoDetour(mission, "lit"), false);
  assert.equal(mission.inputs.policyId, "careful");
  assert.equal(village.prepareGrottoDetour(mission, "shadow"), true);
  assert.equal(mission.inputs.policyId, "greedy");
  const failed = { outcome: "retreat", loot: [] };
  assert.equal(village.rewardGrottoDetour(failed, mission), false);
  assert.equal(failed.loot.length, 0);
  const success = { outcome: "success", loot: [], log: [] };
  assert.equal(village.rewardGrottoDetour(success, mission), true);
  assert.equal(success.loot[0].id, "grotto-shadow-prism");
  assert.equal(village.rewardGrottoDetour(success, mission), false);
  assert.equal(success.loot.length, 1);
});

test("grotto reward cannot be earned on an unrelated expedition", () => {
  const mission = { inputs: { destinationId: "village-forge:sealed-mine" } };
  assert.equal(village.prepareGrottoDetour(mission, "shadow"), false);
  assert.equal(village.rewardGrottoDetour({ outcome: "success", loot: [] }, mission), false);
});

test("scout map can be spent to reach shadow grotto without forced greedy combat", () => {
  const current = state();
  current.securedLoot = [{ id: "village-scout-map", sourceExpeditionId: "watchtower-return" }];
  const mission = { inputs: { destinationId: "village-forge:crystal-grotto", policyId: "cautious" } };
  assert.equal(village.prepareGrottoDetour(mission, "mapped", current), true);
  assert.equal(mission.inputs.policyId, "standard");
  assert.equal(mission.inputs.villageGrottoDetour, "mapped");
  assert.equal(current.securedLoot.length, 0);
  const won = { outcome: "success", loot: [], log: [] };
  assert.equal(village.rewardGrottoDetour(won, mission), true);
  assert.equal(won.loot[0].id, "grotto-shadow-prism");
  assert.equal(village.rewardGrottoDetour(won, mission), false);
  assert.equal(village.rewardGrottoDetour({ outcome: "retreat", loot: [] }, mission), false);
});

test("mapped grotto rejects missing map and unrelated destinations without spending loot", () => {
  const current = state();
  current.securedLoot = [{ id: "watch-road-medicine" }];
  const mission = { inputs: { destinationId: "village-forge:crystal-grotto", policyId: "cautious" } };
  assert.equal(village.prepareGrottoDetour(mission, "mapped", current), false);
  assert.equal(mission.inputs.policyId, "cautious");
  assert.equal(mission.inputs.villageGrottoDetour, undefined);
  current.securedLoot.push({ id: "village-scout-map" });
  mission.inputs.destinationId = "village-forge:sealed-mine";
  assert.equal(village.prepareGrottoDetour(mission, "mapped", current), false);
  assert.equal(current.securedLoot.length, 2);
});

test("shadow prism opens a persistent mirror chamber only once", () => {
  const current = state();
  current.destinations.push({ id: "village-forge:crystal-grotto", name: "隠し洞窟", family: "cave", dangerTags: [], opportunityTags: [] });
  current.securedLoot = [{ id: "grotto-shadow-prism" }, { id: "grotto-shadow-prism" }];
  const opened = village.revealMirrorChamber(current);
  assert.equal(opened.id, "village-forge:mirror-chamber");
  assert.equal(opened.villageMirrorChamber, true);
  assert.equal(current.securedLoot.length, 1);
  assert.ok(current.discoveredDestinationIds.includes(opened.id));
  assert.equal(village.revealMirrorChamber(current).id, opened.id);
  assert.equal(current.securedLoot.length, 1);
  const engine = require("../src/expedition-system.js");
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.ok(restored.destinations.some(item => item.id === opened.id));
  assert.ok(restored.discoveredDestinationIds.includes(opened.id));
});

test("mirror chamber cannot be revealed without the grotto and prism", () => {
  const current = state();
  current.securedLoot = [{ id: "grotto-shadow-prism" }];
  assert.equal(village.revealMirrorChamber(current), null);
  assert.equal(current.securedLoot.length, 1);
  current.destinations.push({ id: "village-forge:crystal-grotto", family: "cave" });
  current.securedLoot = [];
  assert.equal(village.revealMirrorChamber(current), null);
  assert.equal(current.destinations.some(item => item.villageMirrorChamber), false);
});


test("mirror chamber clue selects safe relic recovery versus dangerous direct beam", () => {
  const expedition = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(expedition, "left"), true);
  assert.equal(expedition.inputs.policyId, "standard");
  const report = { outcome: "success", loot: [], log: [] };
  assert.equal(village.rewardMirrorPath(report, expedition), true);
  assert.equal(report.loot.filter(item => item.id === "mirror-chamber-relic").length, 1);
  assert.equal(village.rewardMirrorPath(report, expedition), false);
  assert.equal(report.loot.length, 1);

  const danger = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(danger, "center"), true);
  assert.equal(danger.inputs.policyId, "greedy");
  const dangerReport = { outcome: "success", loot: [], log: [] };
  village.rewardMirrorPath(dangerReport, danger);
  assert.equal(dangerReport.loot.length, 0);
});

test("mirror relic requires safe return and never affects other destinations", () => {
  const expedition = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  village.prepareMirrorPath(expedition, "left");
  const retreat = { outcome: "retreat", loot: [], log: [] };
  village.rewardMirrorPath(retreat, expedition);
  assert.equal(retreat.loot.length, 0);
  const other = { inputs: { destinationId: "hollow-village", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(other, "left"), false);
  assert.equal(village.rewardMirrorPath({ outcome: "success", loot: [], log: [] }, other), false);
});

test("mirror inscription needs a successful scouting visit and persists across reload", () => {
  const engine = require("../src/expedition-system.js");
  const current = engine.initialState();
  current.destinations.push({ id: "village-forge:mirror-chamber", name: "鏡の間", family: "cave", dangerTags: [], opportunityTags: [] });
  const mission = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard", villageMirrorPath: "observe" } };
  const left = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(left, "left", current), false);
  assert.equal(village.discoverMirrorInscription(current, { outcome: "retreat", log: [] }, mission), false);
  const report = { outcome: "success", log: [] };
  assert.equal(village.discoverMirrorInscription(current, report, mission), true);
  assert.equal(village.discoverMirrorInscription(current, report, mission), false);
  assert.ok(report.log.some(item => item.type === "mirror-inscription"));
  const reloaded = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.equal(village.prepareMirrorPath(left, "left", reloaded), true);
});

test("mirror vault unlocks only after safe reflection and persists", () => {
  const engine = require("../src/expedition-system.js");
  const current = engine.initialState();
  current.destinations.push({ id: "village-forge:mirror-chamber", name: "鏡の間", family: "cave", dangerTags: [], opportunityTags: [], villageMirrorInscription: true });
  const mission = { inputs: { destinationId: "village-forge:mirror-chamber", villageMirrorPath: "left", policyId: "standard" } };
  const vault = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(vault, "vault", current), false);
  assert.equal(village.discoverMirrorVault(current, { outcome: "retreat", log: [] }, mission), false);
  const report = { outcome: "success", log: [] };
  assert.equal(village.discoverMirrorVault(current, report, mission), true);
  assert.equal(village.discoverMirrorVault(current, report, mission), false);
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.equal(village.prepareMirrorPath(vault, "vault", restored), true);
  assert.equal(vault.inputs.policyId, "greedy");
});

test("mirror vault rewards only safe returns, once per report", () => {
  const mission = { inputs: { destinationId: "village-forge:mirror-chamber", villageMirrorPath: "vault" } };
  const retreat = { outcome: "retreat", loot: [], log: [] };
  assert.equal(village.rewardMirrorPath(retreat, mission), true);
  assert.equal(retreat.loot.length, 0);
  const success = { outcome: "success", loot: [], log: [] };
  assert.equal(village.rewardMirrorPath(success, mission), true);
  assert.equal(success.loot.filter(item => item.id === "mirror-vault-essence").length, 1);
  assert.equal(village.rewardMirrorPath(success, mission), false);
  assert.equal(success.loot.length, 1);
});

test("mirror resonance consumes a recovered core to avoid forced battles", () => {
  const engine = require("../src/expedition-system.js");
  const current = engine.initialState();
  current.destinations.push({ id: "village-forge:mirror-chamber", name: "鏡の間", family: "cave", dangerTags: [], opportunityTags: [], villageMirrorVault: true });
  current.securedLoot.push({ id: "mirror-chamber-relic", name: "反射核" });
  const mission = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(mission, "resonance", current), true);
  assert.equal(mission.inputs.policyId, "standard");
  assert.equal(current.securedLoot.some(item => item.id === "mirror-chamber-relic"), false);
  assert.equal(village.prepareMirrorPath({ inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } }, "resonance", current), false);
  const success = { outcome: "success", loot: [], log: [] };
  assert.equal(village.rewardMirrorPath(success, mission), true);
  assert.equal(success.loot.filter(item => item.id === "mirror-vault-essence").length, 1);
  assert.equal(village.rewardMirrorPath(success, mission), false);
  const restored = engine.normalizeState(JSON.parse(JSON.stringify(current)));
  assert.equal(restored.securedLoot.some(item => item.id === "mirror-chamber-relic"), false);
});

test("mirror resonance cannot spend a core before vault discovery or on unrelated expeditions", () => {
  const engine = require("../src/expedition-system.js");
  const current = engine.initialState();
  current.destinations.push({ id: "village-forge:mirror-chamber", name: "鏡の間", family: "cave", dangerTags: [], opportunityTags: [] });
  current.securedLoot.push({ id: "mirror-chamber-relic" });
  const mission = { inputs: { destinationId: "village-forge:mirror-chamber", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(mission, "resonance", current), false);
  assert.equal(current.securedLoot.length, 1);
  const other = { inputs: { destinationId: "hollow-village", policyId: "standard" } };
  assert.equal(village.prepareMirrorPath(other, "resonance", current), false);
  assert.equal(current.securedLoot.length, 1);
  const retreat = { outcome: "retreat", loot: [], log: [] };
  mission.inputs.villageMirrorPath = "resonance";
  village.rewardMirrorPath(retreat, mission);
  assert.equal(retreat.loot.length, 0);
});
