const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
const gateSource = fs.readFileSync(path.join(__dirname, "../src/expedition-start-gate.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(__dirname, "../src/exploration-map-presentation.js"), "utf8");

test("browser bootstrap loads location runtime and start gate before app", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  assert.match(runtime, /discovery-provider\.js/);
  assert.match(runtime, /geography-api-provider\.js/);
  assert.match(runtime, /location-discovery-runtime\.js/);
  assert.match(runtime, /expedition-start-gate\.js/);
  assert.ok(runtime.indexOf("location-discovery-runtime.js") < runtime.indexOf("expedition-start-gate.js"));
});

test("location runtime preserves core choice ids while replacing presentation", () => {
  assert.match(runtimeSource, /Object\.assign\(\{\}, choice/);
  assert.match(runtimeSource, /originalGenerate\(state\)/);
  assert.match(runtimeSource, /getCurrentPosition/);
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider/);
  assert.doesNotMatch(runtimeSource, /createLocationDiscoveryProvider/);
});

test("expedition start enters a visible loading screen before app renders choices", () => {
  assert.match(gateSource, /event\.stopImmediatePropagation\(\)/);
  assert.match(gateSource, /runtime\.begin\(\)/);
  assert.match(gateSource, /explore\.classList\.add\("active"\)/);
  assert.match(gateSource, /runtime\.showPending\(\)/);
  assert.match(runtimeSource, /leadList\.style\.display = locationState === "loading" \? "none" : ""/);
});

test("successful geography is available before the replayed app render", () => {
  assert.match(presentationSource, /REAL-WORLD DISCOVERY/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.ok(gateSource.indexOf("discovery.finally") < gateSource.indexOf("startButton.click()"));
});

test("failed denied or empty geography replays the normal simulated fallback", () => {
  assert.match(presentationSource, /simulated: "DISCOVERED NEARBY \/ SIMULATED LOCATION"/);
  assert.match(runtimeSource, /geographicDiscoveries = \[\]/);
  assert.match(runtimeSource, /locationState = error && error\.code === 1 \? "denied" : "failed"/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.match(gateSource, /startButton\.click\(\)/);
});
