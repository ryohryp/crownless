const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(__dirname, "../src/exploration-map-presentation.js"), "utf8");

test("browser bootstrap loads geography API provider before location runtime", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  assert.match(runtime, /discovery-provider\.js/);
  assert.match(runtime, /geography-api-provider\.js/);
  assert.match(runtime, /location-discovery-runtime\.js/);
  assert.ok(runtime.indexOf("geography-api-provider.js") < runtime.indexOf("location-discovery-runtime.js"));
});

test("location runtime preserves core choice ids while replacing presentation", () => {
  assert.match(runtimeSource, /Object\.assign\(\{\}, choice/);
  assert.match(runtimeSource, /originalGenerate\(state\)/);
  assert.match(runtimeSource, /getCurrentPosition/);
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider/);
  assert.doesNotMatch(runtimeSource, /createLocationDiscoveryProvider/);
});

test("expedition start is intercepted before app renders simulated choices", () => {
  assert.match(runtimeSource, /event\.stopImmediatePropagation\(\)/);
  assert.match(runtimeSource, /locationState = "loading"/);
  assert.match(runtimeSource, /startButton\.disabled = true/);
  assert.match(runtimeSource, /loadGeographicDiscoveries\(\)\.finally/);
  assert.match(runtimeSource, /replayingStart = true;\s*startButton\.click\(\)/);
  assert.doesNotMatch(runtimeSource, /setTimeout\(\(\) => \{ setLeadLoading\(true\)/);
});

test("successful geography is available before the replayed app render", () => {
  assert.match(presentationSource, /REAL-WORLD DISCOVERY/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.ok(runtimeSource.indexOf("geographicDiscoveries = await provider.discover") < runtimeSource.indexOf("replayingStart = true"));
  assert.ok(runtimeSource.indexOf("replayingStart = true") < runtimeSource.indexOf("startButton.click()"));
});

test("failed denied or empty geography replays the normal simulated fallback", () => {
  assert.match(presentationSource, /simulated: "DISCOVERED NEARBY \/ SIMULATED LOCATION"/);
  assert.match(runtimeSource, /geographicDiscoveries = \[\]/);
  assert.match(runtimeSource, /locationState = error && error\.code === 1 \? "denied" : "failed"/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.match(runtimeSource, /startButton\.click\(\)/);
});
