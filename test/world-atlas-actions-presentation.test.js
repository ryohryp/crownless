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

test("local event rumor is persisted once through the existing world knowledge boundary", () => {
  let persistedState = {
    phase: "hub",
    worldKnowledge: { discoveries: {} }
  };
  let saves = 0;
  const root = {
    CrownlessCore: {
      loadSafeState() { return JSON.parse(JSON.stringify(persistedState)); },
      saveWorldKnowledge(next) {
        persistedState = JSON.parse(JSON.stringify(next));
        saves += 1;
        return true;
      }
    }
  };
  const entry = {
    key: "geo:settlement:1",
    name: "古い市場跡",
    state: "discovered",
    contentKind: "unknown",
    terrain: ["settlement"],
    areaId: "area:14:14554:6451",
    latitude: 35.123456,
    longitude: 139.123456
  };
  const event = Actions.buildLocalEvent(entry);
  const investigate = event.choices.find((choice) => choice.id === "investigate");
  const followUp = investigate.followUps.find((choice) => choice.id === "ask-black-stone");

  const first = Presentation.recordLocalEventRumor(root, entry, event, followUp.effect);
  const second = Presentation.recordLocalEventRumor(root, entry, event, followUp.effect);

  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
  assert.equal(saves, 1);
  const rumor = persistedState.worldKnowledge.discoveries[first.key];
  assert.equal(rumor.contentKind, "rumor");
  assert.equal(rumor.name, "北の古井戸の噂");
  assert.equal(rumor.areaId, entry.areaId);
  assert.match(rumor.baseTitle, /夜になると荷運び人の灯りが消える/);
  assert.doesNotMatch(JSON.stringify(rumor), /latitude|longitude|routeHistory/i);
});

test("atlas action hub connects expedition, branching local event, and merchant facility", () => {
  assert.match(source, /dataAtlasActionKind|dataset\.atlasActionKind/);
  assert.match(source, /presentation.open\(\{ view: "prepare", destinationId:/);
  assert.match(source, /buildLocalEvent/);
  assert.match(source, /renderChoices\(choice\.followUps\)/);
  assert.match(source, /recordLocalEventRumor/);
  assert.match(source, /effect\.kind === "merchant"/);
  assert.match(source, /旅商人の荷車/);
  assert.match(source, /戦利品\$\{item\.priceLoot\}個と交換/);
  assert.match(source, /getRegionMissionBoard/);
});

test("Atlas has no synthetic report/close transitions or text-dependent fallback", () => {
  assert.doesNotMatch(source, /\.click\(\)|findPrepareTransitionButton|lockAtlasDestination/);
});

test("opening an Atlas expedition uses the explicit presentation entrypoint instead of the legacy gate", () => {
  const order = [];
  const root = fakeRoot({}, {});
  root.CrownlessGeographicExpeditionBridge = {
    expeditionDestinationId() { return "world:geo:test"; }
  };
  root.CrownlessExpeditionPresentation = {
    isReady() { return true; },
    open(options) { assert.deepEqual(options, { view: "prepare", destinationId: "world:geo:test" }); order.push("presentation"); return true; },
    close() { order.push("presentation-close"); }
  };
  root.CrownlessDiscoveryJournal = { close() { order.push("journal"); } };
  root.CrownlessWorldAtlas = { closeAtlas() { order.push("atlas"); } };
  const document = { getElementById() { return null; } };

  assert.equal(Presentation.openExpedition(document, root, { key: "geo:test" }), true);
  assert.deepEqual(order, ["presentation", "journal", "atlas"]);
  assert.doesNotMatch(source, /gate\.click\(\)/);
});

test("Atlas expedition entrypoint fails closed with retry feedback while presentation is unavailable", () => {
  const root = fakeRoot({}, {});
  root.CrownlessGeographicExpeditionBridge = { expeditionDestinationId() { return "world:geo:test"; } };
  const status = { textContent: "" };
  const document = { getElementById() { return null; } };

  assert.equal(Presentation.openExpedition(document, root, { key: "geo:test" }, status), false);
  assert.match(status.textContent, /再試行/);
});

test("discovery overlay cleanup has a DOM fallback for partially loaded clients", () => {
  let removed = false;
  let classRemoved = "";
  const document = {
    getElementById(id) {
      return id === "discovery-journal-browser" ? { remove() { removed = true; } } : null;
    },
    body: { classList: { remove(name) { classRemoved = name; } } }
  };

  Presentation.closeDiscoverySurfaces(document, {});
  assert.equal(removed, true);
  assert.equal(classRemoved, "discovery-journal-open");
});

test("mobile action sheet remains a manuscript overlay rather than a dashboard", () => {
  assert.match(css, /border-left: 3px solid/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /max-height: 78vh/);
  assert.match(css, /expedition-choice--atlas-locked/);
});
