const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const NpcLife = require("../src/npc-life.js");
const Signals = require("../src/world-atlas-npc-signals.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-npc-signals.js"), "utf8");

test("traveling NPC is visible anonymously before a rumor and upgrades when the route rumor is available", () => {
  const hearth = Signals.travelingSignals(NpcLife, 8);
  const beforeRumor = Signals.travelingSignals(NpcLife, 9);
  const road = Signals.travelingSignals(NpcLife, 11);
  const market = Signals.travelingSignals(NpcLife, 15);

  assert.equal(hearth.length, 0);
  assert.equal(beforeRumor.length, 1);
  assert.equal(beforeRumor[0].residentId, "marco");
  assert.equal(beforeRumor[0].hasRumor, false);
  assert.equal(beforeRumor[0].signalSource, "npc-travel");
  assert.equal(beforeRumor[0].name, "旅人らしき気配");
  assert.equal(beforeRumor[0].shortName, "旅人");
  assert.equal(beforeRumor[0].stateLabel, "未確認 / 人の気配");
  assert.equal(beforeRumor[0].direction, "北寄り");
  assert.equal(beforeRumor[0].movementHint, "移動しているらしい");
  assert.doesNotMatch(JSON.stringify({
    name: beforeRumor[0].name,
    shortName: beforeRumor[0].shortName,
    distanceBand: beforeRumor[0].distanceBand,
    movementHint: beforeRumor[0].movementHint,
    stateLabel: beforeRumor[0].stateLabel
  }), /マルコ|行商人|北の街道|街道/);

  assert.equal(road.length, 1);
  assert.equal(road[0].residentId, "marco");
  assert.equal(road[0].hasRumor, true);
  assert.equal(road[0].signalSource, "npc-rumor");
  assert.equal(road[0].name, "マルコの気配");
  assert.equal(road[0].stateLabel, "未確認 / 噂の足取り");
  assert.equal(road[0].direction, "北寄り");
  assert.equal(road[0].x, 50);
  assert.equal(road[0].y, 19);
  assert.equal(road[0].movementHint, "街道を進んでいる");
  assert.equal(market.length, 0);
});

test("north-road traveler signal advances in coarse time bands without exposing an exact route", () => {
  const early = Signals.travelingSignals(NpcLife, 10)[0];
  const middle = Signals.travelingSignals(NpcLife, 11)[0];
  const late = Signals.travelingSignals(NpcLife, 13)[0];

  assert.deepEqual(
    [early.x, early.y, early.direction, early.movementHint],
    [44, 28, "北寄り", "街道へ出たばかり"]
  );
  assert.deepEqual(
    [middle.x, middle.y, middle.direction, middle.movementHint],
    [50, 19, "北寄り", "街道を進んでいる"]
  );
  assert.deepEqual(
    [late.x, late.y, late.direction, late.movementHint],
    [56, 13, "北寄り", "さらに北へ進んだ気配"]
  );
  assert.notDeepEqual([early.x, early.y], [middle.x, middle.y]);
  assert.notDeepEqual([middle.x, middle.y], [late.x, late.y]);
});

test("anonymous traveler signal cannot match a known destination until the rumor is available", () => {
  const knownRoad = {
    key: "known-north-road",
    name: "北の街道・古い関所跡",
    location: NpcLife.LOCATIONS.ROAD,
    state: "discovered"
  };
  const safe = { worldKnowledge: { discoveries: { [knownRoad.key]: knownRoad } } };
  const root = { CrownlessCore: { loadSafeState: () => safe } };
  const anonymousSignal = Signals.travelingSignals(NpcLife, 9)[0];

  assert.equal(anonymousSignal.hasRumor, false);
  assert.equal(Signals.knownDestinationForSignal(root, NpcLife, anonymousSignal, 9), null);
});

test("traveler signal can be matched to an already-known reunion destination without creating discovery state", () => {
  const knownRoad = {
    key: "known-north-road",
    name: "北の街道・古い関所跡",
    location: NpcLife.LOCATIONS.ROAD,
    state: "discovered"
  };
  const safe = { worldKnowledge: { discoveries: { [knownRoad.key]: knownRoad } } };
  const before = JSON.stringify(safe);
  const root = { CrownlessCore: { loadSafeState: () => safe } };
  const signal = Signals.travelingSignals(NpcLife, 11)[0];

  const match = Signals.knownDestinationForSignal(root, NpcLife, signal, 11);

  assert.equal(match.candidate.targetId, "marco");
  assert.equal(match.candidate.discoveryKey, knownRoad.key);
  assert.equal(match.entry, knownRoad);
  assert.equal(JSON.stringify(safe), before);
});

test("traveler signal stays rumor-only when no known destination matches", () => {
  const root = { CrownlessCore: { loadSafeState: () => ({ worldKnowledge: { discoveries: {} } }) } };
  const signal = Signals.travelingSignals(NpcLife, 11)[0];
  assert.equal(Signals.knownDestinationForSignal(root, NpcLife, signal, 11), null);
});

test("known destination bridge reuses existing atlas detail, actions, and reunion presentations", () => {
  const calls = [];
  const root = {
    CrownlessWorldAtlasPreview: { syncSelection: (_document, _root, entry) => { calls.push(["preview", entry.key]); return true; } },
    CrownlessWorldAtlasActionsPresentation: { syncActions: (_document, _root, entry) => { calls.push(["actions", entry.key]); return true; } },
    CrownlessWorldAtlasReunionPresentation: { syncReunion: (_document, _root, entry) => { calls.push(["reunion", entry.key]); return true; } }
  };
  const match = { entry: { key: "known-north-road" } };

  assert.equal(Signals.openKnownDestination({}, root, match, 11), true);
  assert.deepEqual(calls, [
    ["preview", "known-north-road"],
    ["actions", "known-north-road"],
    ["reunion", "known-north-road"]
  ]);
});

test("NPC signal model never contains precise coordinates or route persistence fields", () => {
  const anonymousSignal = Signals.travelingSignals(NpcLife, 9)[0];
  const rumoredSignal = Signals.travelingSignals(NpcLife, 11)[0];
  for (const signal of [anonymousSignal, rumoredSignal]) {
    const serialized = JSON.stringify(signal);
    assert.doesNotMatch(serialized, /latitude|longitude|coordinate|mapOrigin|locationLabel|north-road/);
  }
  assert.doesNotMatch(source, /localStorage|sessionStorage|saveWorldKnowledge|recordExploredCell/);
  assert.doesNotMatch(source, /SAVE_VERSION/);
});

test("presentation distinguishes anonymous travel presence from route rumor without confirming discovery", () => {
  assert.match(source, /signalSource: hasRumor \? "npc-rumor" : "npc-travel"/);
  assert.match(source, /dataset\.atlasSignalSource = signal\.signalSource/);
  assert.match(source, /旅人らしき気配/);
  assert.match(source, /人物や行き先はまだ分からない/);
  assert.match(source, /まだ確認済み地点ではない/);
  assert.match(source, /正確な位置や経路を示す印ではない/);
  assert.match(source, /時間帯ごとに粗く重ねたもの/);
  assert.match(source, /既知の探索地点を開く/);
  assert.match(source, /world-atlas-nearby-marker--npc-signal/);
});

test("atlas observer only refreshes when a nearby map is added", () => {
  assert.match(source, /records\.some\(addedNearbyMap\)/);
  assert.doesNotMatch(source, /MutationObserver\(\(\) => refresh\(\)\)/);
});
