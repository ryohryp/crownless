const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

test("watchtower QA route is explicit opt-in only", () => {
  assert.match(runtimeSource, /new URLSearchParams\(window\.location\.search\)\.get\("qa"\) === "watchtower"/);
  assert.match(runtimeSource, /get qaMode\(\) \{ return QA_WATCHTOWER_MODE \? "watchtower" : ""; \}/);
  assert.doesNotMatch(runtimeSource, /QA_WATCHTOWER_MODE = true/);
});

test("watchtower QA route creates the real watchtower archetype contract", () => {
  assert.match(runtimeSource, /title: "QA固定候補の崩れた物見台"/);
  assert.match(runtimeSource, /baseTitle: "崩れた物見台"/);
  assert.match(runtimeSource, /contentKind: "dungeon"/);
  assert.match(runtimeSource, /features: \["height"\]/);
  assert.match(runtimeSource, /sourceRef: "qa:ruined-watchtower"/);
  assert.match(runtimeSource, /qaInjected: true/);
});

test("watchtower QA route guarantees slot zero without changing the normal path", () => {
  assert.match(runtimeSource, /if \(!QA_WATCHTOWER_MODE\) return source;/);
  assert.match(runtimeSource, /findIndex\(\(item\) => item && item\.baseTitle === "崩れた物見台"\)/);
  assert.match(runtimeSource, /return \[watchtower, \.\.\.source\]\.slice\(0, 3\)/);
  assert.match(runtimeSource, /geographicDiscoveries = ensureQaWatchtowerDiscoveries\(discovered\)/);
});

test("watchtower QA route remains usable even when GPS or OSM fails", () => {
  assert.match(runtimeSource, /catch \(error\) \{ if \(QA_WATCHTOWER_MODE\) \{ geographicDiscoveries = ensureQaWatchtowerDiscoveries\(\[\]\); locationState = "ready"/);
  assert.match(runtimeSource, /QAモード：崩れた物見台を先頭候補に固定中/);
  assert.match(runtimeSource, /QA:watchtower/);
});

test("QA candidate is visibly marked and does not claim real-world source", () => {
  assert.match(runtimeSource, /discovery\.qaInjected \? "qa" : "geographic"/);
  assert.match(runtimeSource, /QA_WATCHTOWER_MODE \? "simulated"/);
});
