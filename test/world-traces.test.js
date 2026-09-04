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

test("tracking knowledge makes the same stale identified trace readable and followable", () => {
  const stale = WorldTraces.traceFromSignalSource("npc-rumor", 16);
  const learned = WorldTraces.applyTrackingKnowledge(stale, true);

  assert.equal(stale.canFollow, false);
  assert.equal(learned.trackingKnown, true);
  assert.equal(learned.canFollow, true);
  assert.match(WorldTraces.investigationCopy(learned), /古い轍|北の街道|追える/);
});

test("anonymous tracks remain unfollowable even after tracking knowledge is learned", () => {
  const anonymous = WorldTraces.applyTrackingKnowledge(WorldTraces.traceFromSignalSource("npc-travel", 16), true);
  assert.equal(anonymous.identified, false);
  assert.equal(anonymous.canFollow, false);
});

test("tracking knowledge grows from distinct追跡 experiences instead of the first click", () => {
  const safe = { worldKnowledge: { discoveries: {} } };
  let saves = 0;
  const root = {
    CrownlessCore: {
      loadSafeState: () => safe,
      sanitizeWorldKnowledge: (value) => value,
      saveWorldKnowledge: () => { saves += 1; return true; }
    }
  };

  const first = WorldTraces.rememberTrackingKnowledge(root, 12345, "trace:first");
  const duplicate = WorldTraces.rememberTrackingKnowledge(root, 22345, "trace:first");
  const second = WorldTraces.rememberTrackingKnowledge(root, 32345, "trace:second");
  const learned = safe.worldKnowledge.discoveries[WorldTraces.TRACKING_KNOWLEDGE_KEY];
  const practice = safe.worldKnowledge.discoveries[WorldTraces.TRACKING_PRACTICE_KEY];

  assert.deepEqual(first, { changed: true, known: false, practiceCount: 1 });
  assert.deepEqual(duplicate, { changed: false, known: false, practiceCount: 1 });
  assert.deepEqual(second, { changed: true, known: true, practiceCount: 2 });
  assert.equal(saves, 2);
  assert.equal(practice.practiceCount, 2);
  assert.deepEqual(practice.lessonIds, ["trace:first", "trace:second"]);
  assert.equal(learned.name, "《轍読み》");
  assert.equal(learned.contentKind, "knowledge");
  assert.equal(learned.firstDiscoveredAt, 32345);
  assert.equal(WorldTraces.trackingKnowledgeKnown(root), true);
  assert.equal(WorldTraces.trackingPracticeCount(root), 2);
});

test("trace lesson identity prevents reload from counting the same observed trace twice", () => {
  const trace = WorldTraces.traceFromSignalSource("npc-rumor", 11);
  assert.equal(WorldTraces.lessonIdForTrace(trace, 11), WorldTraces.lessonIdForTrace(trace, 11));
  assert.notEqual(WorldTraces.lessonIdForTrace(trace, 11), WorldTraces.lessonIdForTrace(trace, 12));
});

test("investigation copy makes freshness, experience, and followability player-readable", () => {
  assert.match(WorldTraces.investigationCopy(WorldTraces.traceFromSignalSource("npc-rumor", 11)), /まだ新しい|追いつけ/);
  assert.match(WorldTraces.investigationCopy(WorldTraces.traceFromSignalSource("npc-rumor", 13)), /薄れかけ|最後の機会/);
  assert.match(WorldTraces.investigationCopy(WorldTraces.traceFromSignalSource("npc-rumor", 14)), /古い|危険/);
  const experienced = WorldTraces.applyTrackingKnowledge(WorldTraces.traceFromSignalSource("npc-rumor", 11), true);
  assert.match(WorldTraces.investigationCopy(experienced), /轍の沈み方|北へ急いで/);
});

test("trace model does not expose or persist precise real-world location data", () => {
  const trace = WorldTraces.traceFromSignalSource("npc-rumor", 11);
  assert.doesNotMatch(JSON.stringify(trace), /latitude|longitude|coordinate|mapOrigin|locationLabel/);
  assert.doesNotMatch(source, /navigator\.geolocation|watchPosition|localStorage|sessionStorage/);
});

test("trace UI exposes partial experience before the learned knowledge changes later decisions", () => {
  assert.match(source, /前にも見た荷車の轍が残っている/);
  assert.match(source, /一度この手の轍を追った/);
  assert.match(source, /古い痕跡を読むにはまだ経験が足りない/);
  assert.match(source, /TRACKING_REQUIRED_PRACTICES = 2/);
  assert.match(source, /lessonIdForTrace\(result, input\)/);
});

test("trace UI gates the existing expedition action behind investigate / follow or leave", () => {
  assert.match(source, /轍を詳しく調べる/);
  assert.match(source, /触らず立ち去る/);
  assert.match(source, /痕跡を追って遠征する/);
  assert.match(source, /setDispatchState\(dispatch, trace, false\)/);
  assert.match(source, /trace\.canFollow/);
  assert.match(source, /bindTrackingLesson\(dispatch, root, lessonIdForTrace\(result, input\)\)/);
  assert.match(source, /《轍読み》で詳しく調べる/);
});

test("runtime bridge loads world traces without adding a second application bootstrap", () => {
  assert.match(bridgeSource, /loadWorldTraces\(root\)/);
  assert.match(bridgeSource, /CrownlessWorldTraces/);
  assert.match(bridgeSource, /src\/world-traces\.js/);
});
