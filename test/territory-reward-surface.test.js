const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Reward = require("../src/territory-reward-surface.js");
const source = fs.readFileSync(path.join(__dirname, "../src/territory-reward-surface.js"), "utf8");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

function models({ controlled = ["geo:fort"], scoutedRoute = false } = {}) {
  return [
    { key: "geo:fort", role: "foothold", owner: controlled.includes("geo:fort") ? "player" : "npc", scouted: true, supported: false, entry: { name: "崩れた小砦" }, meta: { supportMultiplier: 1 } },
    { key: "geo:bridge", role: "route", owner: controlled.includes("geo:bridge") ? "player" : "npc", scouted: scoutedRoute, supported: controlled.includes("geo:fort"), entry: { name: "古い渡河点" }, meta: { supportMultiplier: 0.65 } },
    { key: "geo:grove", role: "resource", owner: controlled.includes("geo:grove") ? "player" : "npc", scouted: false, supported: controlled.includes("geo:bridge"), entry: { name: "煤けた樹林" }, meta: { supportMultiplier: 0.75 } },
  ];
}

function rootFor(activeModels = models()) {
  const scouted = [];
  const root = {
    localStorage: memoryStorage(),
    dispatchEvent() {},
    CrownlessTerritoryPhase1: {
      territories() { return activeModels; },
      scoutTerritory(_root, key) {
        scouted.push(key);
        const item = activeModels.find((candidate) => candidate.key === key);
        const changed = Boolean(item && !item.scouted);
        if (item) item.scouted = true;
        return { ok: Boolean(item), changed };
      },
      discoveryKeyFromDestinationId(id) { return String(id).replace(/^world:/, ""); },
      patchSystem() {},
    }
  };
  root._scouted = scouted;
  return root;
}

test("reward state stays bounded to authored build choices and celebration keys", () => {
  const normalized = Reward.normalizeState({
    developments: { "geo:fort": "scout", "geo:bridge": "castle", latitude: "supply" },
    pendingCelebrationKey: "geo:fort",
    celebratedKeys: ["geo:fort", "geo:fort"],
    longitude: 139,
    resources: { wood: 20 },
  });

  assert.deepEqual(normalized, {
    developments: { "geo:fort": "scout" },
    pendingCelebrationKey: "geo:fort",
    celebratedKeys: ["geo:fort"],
  });
  assert.doesNotMatch(JSON.stringify(normalized), /latitude|longitude|resources|wood|castle/i);
});

test("Atlas summary and route ink model expose control to next-target causality", () => {
  const current = models();
  const summary = Reward.summaryModel(current);
  assert.equal(summary.controlled, 1);
  assert.equal(summary.front, 2);
  assert.equal(summary.next.key, "geo:bridge");

  const pairs = Reward.connectionPairs(current);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].from.key, "geo:fort");
  assert.equal(pairs[0].to.key, "geo:bridge");
});

test("scout post is one-time, persisted, and reveals the next unscouted front", () => {
  const root = rootFor();
  const first = Reward.chooseDevelopment(root, "geo:fort", "scout");
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.revealed, true);
  assert.deepEqual(root._scouted, ["geo:bridge"]);
  assert.equal(Reward.loadState(root).developments["geo:fort"], "scout");

  const again = Reward.chooseDevelopment(root, "geo:fort", "scout");
  assert.equal(again.ok, true);
  assert.equal(again.changed, false);
  assert.deepEqual(root._scouted, ["geo:bridge"]);

  const locked = Reward.chooseDevelopment(root, "geo:fort", "supply");
  assert.equal(locked.ok, false);
  assert.equal(locked.locked, true);
});

test("scout post falls forward to one remaining unscouted territory instead of becoming decorative", () => {
  const root = rootFor(models({ scoutedRoute: true }));
  const result = Reward.chooseDevelopment(root, "geo:fort", "scout");
  assert.equal(result.ok, true);
  assert.equal(result.revealed, true);
  assert.deepEqual(root._scouted, ["geo:grove"]);
});

test("supply post modifies the actual next destination duration before territory support resolves", () => {
  const root = rootFor();
  Reward.chooseDevelopment(root, "geo:fort", "supply");
  const state = {
    destinations: [
      { id: "world:geo:bridge", durationMs: 240000 },
      { id: "world:geo:grove", durationMs: 240000 },
    ]
  };

  const adjusted = Reward.applySupplyToExpeditionState(root, state, { destinationId: "world:geo:bridge" });
  assert.equal(adjusted.destinations[0].durationMs, 168000);
  assert.equal(adjusted.destinations[1].durationMs, 240000);
  assert.equal(state.destinations[0].durationMs, 240000, "must not mutate authoritative input state");

  const effect = Reward.supplyEffect(root, "geo:bridge");
  assert.equal(effect.extraPercent, 30);
  assert.equal(effect.combinedPercent, 55, "30% supply reduction combines with existing 35% foothold support");
});

test("supply dispatch patch is idempotent and reaches the already-patched territory system", () => {
  const root = rootFor();
  Reward.chooseDevelopment(root, "geo:fort", "supply");
  const calls = [];
  root.CrownlessExpeditionSystem = {
    dispatchExpedition(state, input, now) {
      calls.push({ state, input, now });
      return { state };
    }
  };

  assert.equal(Reward.patchSystem(root), true);
  assert.equal(Reward.patchSystem(root), false);
  root.CrownlessExpeditionSystem.dispatchExpedition(
    { destinations: [{ id: "world:geo:bridge", durationMs: 1000 }] },
    { destinationId: "world:geo:bridge" },
    12
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state.destinations[0].durationMs, 700);
});

test("capture celebration is queued and consumed exactly once across reopen/reapply", () => {
  const root = rootFor();
  assert.equal(Reward.queueCelebration(root, "geo:fort"), true);
  assert.equal(Reward.queueCelebration(root, "geo:fort"), false);
  assert.equal(Reward.consumeCelebration(root, "geo:fort"), true);
  assert.equal(Reward.consumeCelebration(root, "geo:fort"), false);
  assert.equal(Reward.queueCelebration(root, "geo:fort"), false);
});

test("reward presentation uses authored marks and bounded choices instead of control XP or generic building economy", () => {
  assert.match(source, /border:3px double/);
  assert.match(source, /border:1px dashed/);
  assert.match(source, /territory-route-ink/);
  assert.match(source, /territory-atlas-summary/);
  assert.match(source, /territory-capture-toast/);
  assert.match(source, /斥候所/);
  assert.match(source, /補給所/);
  assert.doesNotMatch(source, /支配度|control.?xp|buildingLevel|upgradeTimer|woodCost|stoneCost/i);
});
