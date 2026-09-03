"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const scouting = require("../src/world-atlas-scouting.js");
const bridge = require("../src/geographic-expedition-bridge.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function rootWithLoot(loot = [{ id: "wolf-hide", name: "灰狼の毛皮" }]) {
  const localStorage = memoryStorage();
  const expeditionState = { securedLoot: loot };
  const atlas = {
    loadMarketState(root) {
      const raw = root.localStorage.getItem(scouting.MARKET_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        ownedIds: Array.isArray(parsed.ownedIds) ? parsed.ownedIds : [],
        spentLootCounts: parsed.spentLootCounts && typeof parsed.spentLootCounts === "object" ? parsed.spentLootCounts : {},
      };
    },
    availableTradeLoot(root) {
      const market = this.loadMarketState(root);
      const remaining = { ...market.spentLootCounts };
      return expeditionState.securedLoot.filter((item) => {
        const id = item.id || item.name;
        if (!(remaining[id] > 0)) return true;
        remaining[id] -= 1;
        return false;
      });
    },
  };
  return {
    localStorage,
    CrownlessWorldAtlasActionsPresentation: atlas,
    CrownlessGeographicExpeditionBridge: bridge,
  };
}

const roadEntry = {
  key: "geo:road-hub:example",
  name: "煤けた辻",
  state: "discovered",
  contentKind: "location",
  terrain: ["road_hub"],
};

test("scouting is limited to usable geographic discoveries", () => {
  assert.equal(scouting.canScout(roadEntry), true);
  assert.equal(scouting.canScout({ ...roadEntry, key: "local-rumor:test" }), false);
  assert.equal(scouting.canScout({ ...roadEntry, state: "hidden" }), false);
});

test("scout intel reuses the geographic expedition danger model", () => {
  const intel = scouting.buildScoutIntel(roadEntry, bridge);
  assert.equal(intel.destinationId, `world:${roadEntry.key}`);
  assert.deepEqual(intel.dangerTags, ["bandit"]);
  assert.match(intel.dangerLabel, /街道荒らし/);
  assert.match(intel.advice, /外套|短刀/);
});

test("first scouting spends one secured loot and records persistent intel", () => {
  const root = rootWithLoot();
  const outcome = scouting.recordIntel(root, roadEntry);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.reason, "scouted");
  assert.equal(outcome.intel.paymentName, "灰狼の毛皮");
  assert.equal(root.CrownlessWorldAtlasActionsPresentation.availableTradeLoot(root).length, 0);
  assert.equal(scouting.intelForEntry(root, roadEntry).destinationId, `world:${roadEntry.key}`);
});

test("known scouting intel can be reviewed without paying twice", () => {
  const root = rootWithLoot([
    { id: "wolf-hide", name: "灰狼の毛皮" },
    { id: "wolf-fang", name: "灰狼の牙" },
  ]);
  const first = scouting.recordIntel(root, roadEntry);
  const second = scouting.recordIntel(root, roadEntry);
  assert.equal(first.reason, "scouted");
  assert.equal(second.reason, "known");
  assert.equal(root.CrownlessWorldAtlasActionsPresentation.availableTradeLoot(root).length, 1);
});

test("scouting fails closed when there is no loot to pay the guide", () => {
  const root = rootWithLoot([]);
  const outcome = scouting.recordIntel(root, roadEntry);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, "insufficient");
  assert.equal(scouting.intelForEntry(root, roadEntry), null);
});

test("saved intel is addressable by expedition destination for Prepare", () => {
  const root = rootWithLoot();
  const outcome = scouting.recordIntel(root, roadEntry);
  const byDestination = scouting.destinationIntel(root, outcome.intel.destinationId);
  assert.equal(byDestination.discoveryKey, roadEntry.key);
  assert.match(scouting.formatIntel(byDestination), /偵察:/);
});