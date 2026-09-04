"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const cache = require("../src/expedition-player-cache.js");

function stateWithSupply() {
  const state = system.initialState();
  state.securedLoot = [{ id: cache.SUPPLY_ID, name: "野営跡の補給品", count: 1 }];
  state.equipment = [{ id: cache.SUPPLY_ID, name: "野営跡の補給品", tags: ["supply", "consumable"] }];
  state.destinations.push({
    id: "ashen-wood",
    name: "灰の森",
    family: "forest",
    dangerTags: ["beast"],
    opportunityTags: ["tracks"],
    durationMs: 180000,
  });
  state.discoveredDestinationIds.push("ashen-wood");
  return state;
}

function cacheExpedition(outcome = "success") {
  return {
    expedition: {
      id: "exp-cache-create",
      inputs: {
        destinationId: "ashen-wood",
        equipmentIds: [],
        stayPlan: "field-camp",
        cacheSupplyIntent: true,
        cachedEquipmentId: cache.SUPPLY_ID,
      },
    },
    report: {
      expeditionId: "exp-cache-create",
      destinationId: "ashen-wood",
      outcome,
      loot: [],
      discoveries: [],
      log: [],
    },
  };
}

test("cache dispatch reserves the supply only for a field camp", () => {
  const input = {
    destinationId: "ashen-wood",
    equipmentIds: [cache.SUPPLY_ID, "shortbow"],
    fieldCareReserve: true,
  };

  const prepared = cache.prepareCacheDispatchInput(input, true, true);
  assert.equal(prepared.cacheSupply, true);
  assert.deepEqual(prepared.input.equipmentIds, ["shortbow"]);
  assert.equal(prepared.input.cacheSupplyIntent, true);
  assert.equal(prepared.input.cachedEquipmentId, cache.SUPPLY_ID);
  assert.equal(prepared.input.fieldCareReserve, undefined);

  const noCamp = cache.prepareCacheDispatchInput(input, true, false);
  assert.equal(noCamp.cacheSupply, false);
  assert.ok(noCamp.input.equipmentIds.includes(cache.SUPPLY_ID));
});

test("successful field camp leaves one persistent player cache and consumes the carried supply once", () => {
  const state = stateWithSupply();
  const { expedition, report } = cacheExpedition("success");

  cache.decorateReport(report, expedition);
  cache.decorateReport(report, expedition);
  cache.applyCacheState(state, report);
  cache.applyCacheState(state, report);

  const cacheId = cache.cacheDestinationId("ashen-wood");
  const destination = state.destinations.find((item) => item && item.id === cacheId);
  assert.ok(destination);
  assert.equal(destination.playerTrace.kind, "cache");
  assert.equal(destination.playerTrace.sourceType, "player");
  assert.equal(destination.playerTrace.sourceDestinationId, "ashen-wood");
  assert.ok(state.discoveredDestinationIds.includes(cacheId));
  assert.equal(state.destinations.filter((item) => item && item.id === cacheId).length, 1);
  assert.equal(state.securedLoot.filter((item) => item && item.id === cache.SUPPLY_ID).length, 0);
  assert.equal(state.equipment.filter((item) => item && item.id === cache.SUPPLY_ID).length, 0);
  assert.equal(report.log.filter((entry) => entry && entry.type === "player-cache").length, 1);
  assert.equal(report.playerCacheSupplyConsumed, true);
});

test("early return may still leave a planned cache, but failure does not", () => {
  const early = cacheExpedition("early-return");
  cache.decorateReport(early.report, early.expedition);
  assert.ok(early.report.playerCacheCreated);

  const failed = cacheExpedition("failed");
  cache.decorateReport(failed.report, failed.expedition);
  assert.equal(failed.report.playerCacheCreated, undefined);
  assert.equal(failed.report.log.length, 0);
});

test("successful recovery returns exactly one supply and retires the cache idempotently", () => {
  const state = stateWithSupply();
  const created = cacheExpedition("success");
  cache.decorateReport(created.report, created.expedition);
  cache.applyCacheState(state, created.report);

  const cacheId = cache.cacheDestinationId("ashen-wood");
  const expedition = {
    id: "exp-cache-recover",
    inputs: {
      destinationId: cacheId,
      equipmentIds: [],
      stayPlan: "normal",
    },
  };
  const report = {
    expeditionId: expedition.id,
    destinationId: cacheId,
    outcome: "success",
    loot: [],
    log: [],
  };

  cache.decorateReport(report, expedition);
  cache.decorateReport(report, expedition);
  cache.applyCacheState(state, report);
  cache.applyCacheState(state, report);

  assert.equal(report.loot.filter((item) => item && item.id === cache.SUPPLY_ID).length, 1);
  assert.equal(report.log.filter((entry) => entry && entry.type === "player-cache-recovered").length, 1);
  assert.equal(state.securedLoot.filter((item) => item && item.id === cache.SUPPLY_ID).length, 1);
  assert.equal(state.equipment.filter((item) => item && item.id === cache.SUPPLY_ID).length, 1);
  assert.equal(state.destinations.some((item) => item && item.id === cacheId), false);
  assert.equal(state.discoveredDestinationIds.includes(cacheId), false);
});

test("failed recovery keeps the cache available for another attempt", () => {
  const state = stateWithSupply();
  const created = cacheExpedition("success");
  cache.decorateReport(created.report, created.expedition);
  cache.applyCacheState(state, created.report);
  const cacheId = cache.cacheDestinationId("ashen-wood");

  const expedition = { id: "exp-cache-fail", inputs: { destinationId: cacheId } };
  const report = { expeditionId: expedition.id, destinationId: cacheId, outcome: "failed", loot: [], log: [] };
  cache.decorateReport(report, expedition);
  cache.applyCacheState(state, report);

  assert.equal(report.playerCacheRecovered, undefined);
  assert.ok(state.destinations.some((item) => item && item.id === cacheId));
  assert.equal(state.securedLoot.some((item) => item && item.id === cache.SUPPLY_ID), false);
});

test("browser bridge loads player cache after field camp supply handling", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /src\/expedition-player-cache\.js/);
  assert.ok(source.indexOf("loadCampSupplyRelief(root)") < source.indexOf("loadPlayerCache(root)"));
});
