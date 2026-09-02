const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Presentation = require("../src/world-atlas-actions-presentation.js");
const Actions = require("../src/discovery-actions.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-actions-presentation.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../world-atlas-actions.css"), "utf8");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    dump(key) { return data.get(key); }
  };
}

function fakeRoot(expeditionState, marketState) {
  return {
    localStorage: memoryStorage({
      [Presentation.EXPEDITION_STORAGE_KEY]: JSON.stringify(expeditionState),
      [Presentation.MARKET_STORAGE_KEY]: JSON.stringify(marketState)
    }),
    CrownlessDiscoveryActions: Actions,
    CrownlessExpeditionSystem: {
      normalizeState(input) {
        return {
          companions: [], destinations: [], activeExpedition: null, completedReports: [],
          equipment: Array.isArray(input && input.equipment) ? input.equipment.map((item) => ({ ...item })) : [],
          securedLoot: Array.isArray(input && input.securedLoot) ? input.securedLoot.map((item) => ({ ...item })) : [],
          ...(input || {})
        };
      },
      dispatchExpedition(state) { return state; }
    }
  };
}

test("spent barter loot is consumed by count, not by every duplicate id", () => {
  const loot = [{ id: "hide", name: "毛皮1" }, { id: "hide", name: "毛皮2" }, { id: "coin", name: "銀貨" }];
  assert.deepEqual(Presentation.consumeSpentLoot(loot, { hide: 1 }).map((item) => item.name), ["毛皮2", "銀貨"]);
});

test("merchant purchases become expedition equipment while spent loot stays consumed", () => {
  const root = fakeRoot(
    { equipment: [{ id: "rope", name: "麻縄", tags: ["climb"] }], securedLoot: [{ id: "hide", name: "毛皮" }, { id: "coin", name: "銀貨" }] },
    { ownedIds: ["merchant-bandage-roll"], spentLootCounts: { hide: 1 } }
  );
  const state = Presentation.augmentStateWithMarket(root, JSON.parse(root.localStorage.dump(Presentation.EXPEDITION_STORAGE_KEY)));
  assert.ok(state.equipment.some((item) => item.id === "merchant-bandage-roll" && item.tags.includes("heal")));
  assert.deepEqual(state.securedLoot.map((item) => item.id), ["coin"]);
});

test("atlas action hub connects expedition, local event, and merchant facility", () => {
  assert.match(source, /dataAtlasActionKind|dataset\.atlasActionKind/);
  assert.match(source, /lockAtlasDestination/);
  assert.match(source, /buildLocalEvent/);
  assert.match(source, /旅商人の荷車/);
  assert.match(source, /戦利品\$\{item\.priceLoot\}個と交換/);
  assert.match(source, /getRegionMissionBoard/);
});

test("atlas finds the report-to-prepare action without depending on its injury-specific copy", () => {
  const prepare = {
    textContent: "負傷者を休ませて次を準備する →",
    matches(selector) { return selector === "button.expedition-dispatch"; }
  };
  const content = {
    children: [{ matches() { return false; } }, prepare],
    querySelectorAll() { return []; }
  };
  assert.equal(Presentation.findPrepareTransitionButton(content), prepare);
});

test("atlas keeps a copy-based fallback for older expedition report markup", () => {
  const prepare = { textContent: "負傷者を休ませて次を準備する →" };
  const content = {
    children: [],
    querySelectorAll(selector) { return selector === "button" ? [prepare] : []; }
  };
  assert.equal(Presentation.findPrepareTransitionButton(content), prepare);
});

test("mobile action sheet remains a manuscript overlay rather than a dashboard", () => {
  assert.match(css, /border-left: 3px solid/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /max-height: 78vh/);
  assert.match(css, /expedition-choice--atlas-locked/);
});
