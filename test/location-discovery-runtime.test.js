const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(__dirname, "../src/exploration-map-presentation.js"), "utf8");

test("browser bootstrap loads location runtime without a navigation gate", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  assert.match(runtime, /discovery-provider\.js/);
  assert.match(runtime, /geography-api-provider\.js/);
  assert.match(runtime, /location-discovery-runtime\.js/);
  assert.doesNotMatch(runtime, /expedition-start-gate\.js/);
});

test("location runtime preserves core choice ids while replacing presentation", () => {
  assert.match(runtimeSource, /Object\.assign\(\{\}, choice/);
  assert.match(runtimeSource, /originalGenerate\(state\)/);
  assert.match(runtimeSource, /getCurrentPosition/);
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider/);
  assert.doesNotMatch(runtimeSource, /createLocationDiscoveryProvider/);
});

test("expedition start never blocks app navigation while geography loads", () => {
  assert.match(runtimeSource, /startButton\.addEventListener\("click", \(\) =>/);
  assert.match(runtimeSource, /const discovery = loadGeographicDiscoveries\(\)/);
  assert.match(runtimeSource, /queueMicrotask\(setPendingUi\)/);
  assert.doesNotMatch(runtimeSource, /stopImmediatePropagation/);
  assert.doesNotMatch(runtimeSource, /startButton\.click\(\)/);
  assert.match(runtimeSource, /leadList\.style\.display = locationState === "loading" \? "none" : ""/);
});

test("successful geography refreshes leads after discovery without replaying navigation", () => {
  assert.match(presentationSource, /REAL-WORLD DISCOVERY/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.match(runtimeSource, /discovery\.finally\(\(\) =>/);
  assert.match(runtimeSource, /refreshLeadCards\(\);\s*setPendingUi\(\);/);
});

test("failed denied or empty geography reveals the simulated fallback", () => {
  assert.match(presentationSource, /simulated: "DISCOVERED NEARBY \/ SIMULATED LOCATION"/);
  assert.match(runtimeSource, /geographicDiscoveries = \[\]/);
  assert.match(runtimeSource, /locationState = error && error\.code === 1 \? "denied" : "failed"/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.match(runtimeSource, /setPendingUi\(\);/);
});
