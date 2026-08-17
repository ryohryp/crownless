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
  assert.doesNotMatch(runtimeSource, /stopImmediatePropagation/);
});

test("successful async geography discovery switches the exploration heading away from simulated", () => {
  assert.match(presentationSource, /REAL-WORLD DISCOVERY/);
  assert.match(presentationSource, /function setDiscoverySource/);
  assert.match(runtimeSource, /presentation\.setDiscoverySource\(document, locationState === "ready" && geographicDiscoveries\.length \? "geographic" : "simulated"\)/);
  assert.ok(runtimeSource.indexOf("locationState = geographicDiscoveries.length ? \"ready\" : \"failed\";") < runtimeSource.indexOf("syncExplorationSource();"));
});

test("failed or denied geography discovery keeps the simulated fallback heading", () => {
  assert.match(presentationSource, /simulated: "DISCOVERED NEARBY \/ SIMULATED LOCATION"/);
  assert.match(runtimeSource, /geographicDiscoveries = \[\];/);
  assert.match(runtimeSource, /locationState = error && error\.code === 1 \? "denied" : "failed";/);
});
