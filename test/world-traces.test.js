const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const WorldTraces = require("../src/world-traces.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-traces.js"), "utf8");
const bridgeSource = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");

test("NPC tracks age through fresh, fading, and stale coarse time bands", () => {
  assert.equal(WorldTraces.freshnessForHour(10), "fresh");
  assert.equal(WorldTraces.freshnessForHour(11), "fresh");
  assert.equal(WorldTraces.freshnessForHour(12), "fading");
  assert.equal(WorldTraces.freshnessForHour(13), "fading");
  assert.equal(WorldTraces.freshnessForHour(14), "stale");
});

test("anonymous trace stays unidentified while a rumored Marco trace can be followed only while useful", () => {
  const anonymous = WorldTraces.traceFromSignalSource("npc-travel", 10);
  const fresh = WorldTraces.traceFromSignalSource("npc-rumor", 11);
  const fading = WorldTraces.traceFromSignalSource("npc-rumor", 13);
  const stale = WorldTraces.traceFromSignalSource("npc-rumor", 14);

  assert.equal(anonymous.id, WorldTraces.TRACE_ID);
  assert.equal(anonymous.kind, "tracks");
  assert.equal(anonymous.sourceType, "npc");
  assert.equal(anonymous.sourceId, null);
  assert.equal(anonymous.identified, false);
  assert.equal(anonymous.canFollow, false);

  assert.equal(fresh.sourceId, "marco");
  assert.equal(fresh.freshnessLabel, "新しい");
  assert.equal(fresh.canFollow, true);
  assert.equal(fading.freshnessLabel, "薄れかけ");
  assert.equal(fading.canFollow, true);
  assert.equal(stale.freshnessLabel, "古い");
  assert.equal(stale.canFollow, false);
});

test("investigation copy makes freshness and followability player-readable", () => {
  assert.match(WorldTraces.investigationCopy(WorldTraces.traceFromSignalSource("npc-rumor", 11)), /まだ新しい|追いつけ/);
  assert.match(WorldTraces.investigationCopy(WorldTraces.traceFromSignalSource("npc-rumor", 13)), /薄れかけ|最後の機会/);
  assert.match(WorldTraces.investigationCopy(WorldTraces.traceFromSignalSource("npc-rumor", 14)), /古い|危険/);
});

test("trace model does not expose or persist precise real-world location data", () => {
  const trace = WorldTraces.traceFromSignalSource("npc-rumor", 11);
  assert.doesNotMatch(JSON.stringify(trace), /latitude|longitude|coordinate|mapOrigin|locationLabel/);
  assert.doesNotMatch(source, /navigator\.geolocation|watchPosition|localStorage|sessionStorage/);
});

test("trace UI gates the existing expedition action behind investigate / follow or leave", () => {
  assert.match(source, /轍を詳しく調べる/);
  assert.match(source, /触らず立ち去る/);
  assert.match(source, /痕跡を追って遠征する/);
  assert.match(source, /setDispatchState\(dispatch, trace, false\)/);
  assert.match(source, /trace\.canFollow/);
});

test("runtime bridge loads world traces without adding a second application bootstrap", () => {
  assert.match(bridgeSource, /loadWorldTraces\(root\)/);
  assert.match(bridgeSource, /CrownlessWorldTraces/);
  assert.match(bridgeSource, /src\/world-traces\.js/);
});
