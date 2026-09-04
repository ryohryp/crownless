"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const water = require("../src/expedition-water-affinity.js");
const followups = require("../src/expedition-followup-destinations.js");

function waterDestination() {
  return {
    id: "world:geo:water-crossing",
    name: "血濡れの渡し場",
    family: "village",
    geographic: true,
    features: ["water", "crossing"],
    dangerTags: ["water"],
    opportunityTags: ["crossing", "tracks"],
    palette: "water",
    durationMs: 0,
  };
}

function roadDestination() {
  return {
    id: "world:geo:road-bandit",
    name: "見張られた辻",
    family: "village",
    geographic: true,
    features: ["crossing"],
    dangerTags: ["bandit"],
    opportunityTags: ["road"],
    palette: "road",
    durationMs: 0,
  };
}

function state(destination = waterDestination()) {
  return {
    destinations: [destination],
    discoveredDestinationIds: [destination.id],
    equipment: [],
    securedLoot: [],
  };
}

function expedition(destinationId = "world:geo:water-crossing", equipmentIds = []) {
  return {
    id: "exp-water-affinity",
    inputs: {
      destinationId,
      companionIds: ["mira"],
      equipmentIds,
      policyId: "standard",
      objective: "explore",
    },
  };
}

function report(overrides = {}) {
  return {
    expeditionId: "exp-water-affinity",
    outcome: "success",
    destinationId: "world:geo:water-crossing",
    destinationName: "血濡れの渡し場",
    loot: [],
    discoveries: [],
    log: [{ minute: 40, time: "08:00", type: "arrival", text: "渡し場へ着いた。", causes: [] }],
    ...overrides,
  };
}

test("water affinity recognizes canonical water/crossing geography but not a road-only location", () => {
  assert.equal(water.isWaterAffinityDestination(waterDestination()), true);
  assert.equal(water.isWaterAffinityDestination(roadDestination()), false);
  assert.deepEqual(water.affinityTags(waterDestination()).sort(), ["crossing", "tracks", "water"].sort());
});

test("successful water expedition yields one ferryman cloak and promotes it into Prepare equipment", () => {
  const current = state();
  const value = report();
  const exp = expedition();

  water.applyWaterLoot(value, exp, current);
  water.applyWaterLoot(value, exp, current);
  water.persistWaterGear(current, value);
  water.persistWaterGear(current, value);

  const cloak = value.loot.find((item) => item.id === water.REGIONAL_WATER_CLOAK.id);
  assert.ok(cloak);
  assert.equal(cloak.affinity, "water-crossing");
  assert.equal(cloak.originDestinationId, "world:geo:water-crossing");
  assert.equal(current.equipment.filter((item) => item.id === cloak.id).length, 1);
  assert.equal(current.securedLoot.filter((item) => item.id === cloak.id).length, 1);
  assert.match(value.log.find((entry) => entry.type === "regional-loot").text, /水辺の痕跡/);
});

test("equipping the ferryman cloak at water reveals a shallow crossing follow-up", () => {
  const current = state();
  current.equipment.push({
    ...water.REGIONAL_WATER_CLOAK,
    tags: Array.from(water.REGIONAL_WATER_CLOAK.tags),
    originDestinationId: "world:geo:water-crossing",
  });
  const exp = expedition("world:geo:water-crossing", [water.REGIONAL_WATER_CLOAK.id]);
  const value = report();

  water.applyWaterRouteEffect(value, exp, current);
  water.applyWaterRouteEffect(value, exp, current);
  followups.unlockFollowupDestinations(current, value);
  followups.unlockFollowupDestinations(current, value);

  const discovery = value.discoveries.find((item) => item.id === water.WATER_ROUTE_DISCOVERY_ID);
  assert.ok(discovery);
  assert.equal(discovery.kind, "route");
  assert.equal(discovery.sourceDestinationId, "world:geo:water-crossing");
  assert.equal(value.waterGeographicEquipmentEffect.effect, "read-shallow-crossing");
  assert.equal(value.log.filter((entry) => entry.type === "regional-water-gear").length, 1);

  const followupId = followups.followupDestinationId("world:geo:water-crossing");
  assert.ok(current.discoveredDestinationIds.includes(followupId));
  assert.equal(current.destinations.filter((item) => item.id === followupId).length, 1);
  assert.ok(value.log.some((entry) => entry.type === "followup-unlocked" && entry.causes.includes(followupId)));
});

test("ferryman cloak has no special effect away from water, preserving regional loadout tradeoff", () => {
  const current = state(roadDestination());
  current.equipment.push({
    ...water.REGIONAL_WATER_CLOAK,
    tags: Array.from(water.REGIONAL_WATER_CLOAK.tags),
    originDestinationId: "world:geo:water-crossing",
  });
  const exp = expedition("world:geo:road-bandit", [water.REGIONAL_WATER_CLOAK.id]);
  const value = report({ destinationId: "world:geo:road-bandit", destinationName: "見張られた辻" });

  water.applyWaterRouteEffect(value, exp, current);

  assert.equal(value.waterGeographicEquipmentEffect, undefined);
  assert.equal(value.discoveries.length, 0);
  assert.equal(value.log.some((entry) => entry.type === "regional-water-gear"), false);
});

test("browser bridge loads water affinity after regional equipment opportunities", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /src\/expedition-water-affinity\.js/);
  assert.match(source, /loadWaterAffinity/);
  assert.ok(source.indexOf("api.loadEquipmentOpportunities(root)") < source.indexOf("api.loadWaterAffinity(root)"));
});
