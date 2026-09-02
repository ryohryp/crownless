const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const NpcLife = require("../src/npc-life.js");
const Signals = require("../src/world-atlas-npc-signals.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-npc-signals.js"), "utf8");

test("traveling NPC becomes a coarse unconfirmed nearby signal only after a route rumor is available", () => {
  const hearth = Signals.travelingSignals(NpcLife, 8);
  const beforeRumor = Signals.travelingSignals(NpcLife, 9);
  const road = Signals.travelingSignals(NpcLife, 11);
  const market = Signals.travelingSignals(NpcLife, 15);

  assert.equal(hearth.length, 0);
  assert.equal(beforeRumor.length, 0);
  assert.equal(road.length, 1);
  assert.equal(road[0].residentId, "marco");
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

test("NPC signal model never contains precise coordinates or route persistence fields", () => {
  const signal = Signals.travelingSignals(NpcLife, 11)[0];
  const serialized = JSON.stringify(signal);
  assert.doesNotMatch(serialized, /latitude|longitude|coordinate|mapOrigin|route|locationLabel|north-road/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|saveWorldKnowledge|recordExploredCell/);
});

test("presentation marks NPC signal as rumor rather than a confirmed discovery", () => {
  assert.match(source, /dataset\.atlasSignalSource = "npc-rumor"/);
  assert.match(source, /まだ確認済み地点ではない/);
  assert.match(source, /正確な位置や経路を示す印ではない/);
  assert.match(source, /時間帯ごとに粗く重ねたもの/);
  assert.match(source, /world-atlas-nearby-marker--npc-signal/);
});

test("atlas observer only refreshes when a nearby map is added", () => {
  assert.match(source, /records\.some\(addedNearbyMap\)/);
  assert.doesNotMatch(source, /MutationObserver\(\(\) => refresh\(\)\)/);
});
