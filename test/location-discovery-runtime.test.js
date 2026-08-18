const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(__dirname, "../src/exploration-map-presentation.js"), "utf8");
const searchStyleSource = fs.readFileSync(path.join(__dirname, "../location-discovery.css"), "utf8");

test("browser bootstrap loads location runtime without a navigation gate", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  assert.match(runtime, /discovery-provider\.js/);
  assert.match(runtime, /geography-api-provider\.js/);
  assert.match(runtime, /location-discovery-runtime\.js/);
  assert.doesNotMatch(runtime, /expedition-start-gate\.js/);
});

test("location runtime keeps app navigation and simulated choices usable while geography loads", () => {
  assert.match(runtimeSource, /getCurrentPosition/);
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider/);
  assert.doesNotMatch(runtimeSource, /stopImmediatePropagation/);
  assert.match(runtimeSource, /leadList\.style\.display = ""/);
  assert.match(runtimeSource, /leadList\.setAttribute\("aria-busy", String\(locationState === "loading"\)\)/);
  assert.match(runtimeSource, /通常の探索はそのまま始められる/);
});

test("pending location discovery presents manuscript ink until real-world discovery completes", () => {
  assert.match(runtimeSource, /location-discovery-search/);
  assert.match(runtimeSource, /現実の痕跡を照合中/);
  assert.match(runtimeSource, /const searching = locationState === "loading"/);
  assert.match(runtimeSource, /geographicDiscoveries = await provider\.discover\(\{ location \}\)/);
  assert.match(runtimeSource, /locationState = geographicDiscoveries\.length \? "ready" : "failed"/);
  assert.doesNotMatch(runtimeSource, /\d+%|progress-bar|spinner/i);
  assert.match(searchStyleSource, /crownless-search-ink/);
  assert.match(searchStyleSource, /prefers-reduced-motion: reduce/);
});

test("loading presentation is painted before geolocation can start", () => {
  assert.match(runtimeSource, /locationState = "loading"; diagnostics = emptyDiagnostics\("requesting"\); setPendingUi\(\)/);
  assert.match(runtimeSource, /requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  const uiIndex = runtimeSource.indexOf("setPendingUi(); locationPromise = beginGeographicDiscoveryAfterPaint()");
  const gpsIndex = runtimeSource.indexOf("const location = await getCurrentLocation()");
  assert.ok(uiIndex >= 0);
  assert.ok(gpsIndex >= 0);
  assert.ok(uiIndex > gpsIndex, "source order is not execution order: discovery is deferred by rAF");
  assert.doesNotMatch(runtimeSource, /queueMicrotask\(setPendingUi\)/);
});

test("geography runs as background enrichment with client headroom", () => {
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider\(\{ limit: 3, radius: 650, timeoutMs: 22000/);
  assert.match(runtimeSource, /beginGeographicDiscoveryAfterPaint/);
  assert.match(runtimeSource, /discovery\.finally\(\(\) =>/);
  assert.match(runtimeSource, /refreshLeadCards\(\)/);
});

test("successful geography replaces visible cards with real discovered destinations", () => {
  assert.match(presentationSource, /REAL-WORLD DISCOVERY/);
  assert.match(runtimeSource, /title\.textContent = discovery\.title/);
  assert.match(runtimeSource, /card\.dataset\.discoverySource = discovery \? "geographic" : "simulated"/);
});

test("selected GPS destination is attached to the existing exploration result", () => {
  assert.match(runtimeSource, /Core\.discoverLocation = function discoverLocationWithGeography/);
  assert.match(runtimeSource, /geographicDiscoveries\[choiceSlot\(choiceId\)\]/);
  assert.match(runtimeSource, /target\.geographicDiscovery = JSON\.parse\(JSON\.stringify\(geographic\)\)/);
  assert.match(runtimeSource, /target\.realPlaceName = geographic\.realPlaceName \|\| ""/);
});

test("failed denied or empty geography leaves the simulated fallback available", () => {
  assert.match(presentationSource, /simulated: "DISCOVERED NEARBY \/ SIMULATED LOCATION"/);
  assert.match(runtimeSource, /locationState = error && error\.code === 1 \? "denied" : "failed"/);
  assert.match(runtimeSource, /presentation\.setDiscoverySource\(document, locationState === "ready" && geographicDiscoveries\.length \? "geographic" : "simulated"\)/);
});

test("GPS diagnostics classify browser geolocation errors", () => {
  assert.match(runtimeSource, /code === 1.*PERMISSION_DENIED.*denied/);
  assert.match(runtimeSource, /code === 2.*POSITION_UNAVAILABLE.*unavailable/);
  assert.match(runtimeSource, /code === 3.*TIMEOUT.*timeout/);
});

test("GPS diagnostics retain elapsed time and request options", () => {
  assert.match(runtimeSource, /GEOLOCATION_OPTIONS = Object\.freeze\(\{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 \}\)/);
  assert.match(runtimeSource, /performance\.now\(\) - startedAt/);
});

test("GPS failure does not start the geography provider", () => {
  const locationCall = runtimeSource.indexOf("await getCurrentLocation()");
  const providerCall = runtimeSource.indexOf("GeographyApi.createProxyLocationDiscoveryProvider", locationCall);
  assert.ok(locationCall >= 0);
  assert.ok(providerCall > locationCall);
});
