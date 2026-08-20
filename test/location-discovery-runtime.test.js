const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "src/location-discovery-runtime.js"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "src/exploration-map-presentation.js"), "utf8");
const searchStyleSource = fs.readFileSync(path.join(root, "location-discovery.css"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const appRuntimeSource = fs.readFileSync(path.join(root, "src/app-runtime-state.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("browser bootstrap loads location assets explicitly in dependency order", () => {
  assert.match(html, /location-discovery\.css/);
  const discoveryIndex = html.indexOf('src/discovery-provider.js');
  const geographyIndex = html.indexOf('src/geography-api-provider.js');
  const runtimeIndex = html.indexOf('src/location-discovery-runtime.js');
  const appIndex = html.indexOf('src/app.js');
  assert.ok(discoveryIndex >= 0);
  assert.ok(geographyIndex > discoveryIndex);
  assert.ok(runtimeIndex > geographyIndex);
  assert.ok(appIndex > runtimeIndex);
  assert.doesNotMatch(appRuntimeSource, /document\.write/);
  assert.doesNotMatch(appRuntimeSource, /location-discovery-runtime\.js/);
});

test("both expedition entry buttons share the same app start path", () => {
  assert.match(appSource, /getElementById\("start-expedition"\)\.addEventListener\("click", beginNewExpedition\)/);
  assert.match(appSource, /getElementById\("return-again"\)\.addEventListener\("click", beginNewExpedition\)/);
  assert.match(runtimeSource, /Core\.beginExpedition = function beginExpeditionWithLocationDiscovery/);
  assert.match(runtimeSource, /reloadGeographicDiscoveries\(\)/);
  assert.doesNotMatch(runtimeSource, /getElementById\("start-expedition"\)/);
  assert.doesNotMatch(runtimeSource, /getElementById\("return-again"\)/);
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
  const searchPresentationStart = runtimeSource.indexOf("function ensureSearchPresentation");
  const searchPresentationEnd = runtimeSource.indexOf("function showLocationStatus", searchPresentationStart);
  const searchPresentationSource = runtimeSource.slice(searchPresentationStart, searchPresentationEnd);
  assert.ok(searchPresentationStart >= 0 && searchPresentationEnd > searchPresentationStart);
  assert.doesNotMatch(searchPresentationSource, /\d+%|progress-bar|spinner/i);
  assert.match(searchStyleSource, /crownless-search-ink/);
  assert.match(searchStyleSource, /prefers-reduced-motion: reduce/);
});

test("loading presentation is painted before geolocation can start", () => {
  const loadIndex = runtimeSource.indexOf('locationState = "loading"');
  const pendingIndex = runtimeSource.indexOf("setPendingUi();", loadIndex);
  const deferredIndex = runtimeSource.indexOf("beginGeographicDiscoveryAfterPaint();", pendingIndex);
  const gpsIndex = runtimeSource.indexOf("await getCurrentLocation()");
  assert.ok(loadIndex >= 0);
  assert.ok(pendingIndex > loadIndex);
  assert.ok(deferredIndex > pendingIndex);
  assert.ok(gpsIndex >= 0);
  assert.match(runtimeSource, /requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  assert.doesNotMatch(runtimeSource, /queueMicrotask\(setPendingUi\)/);
});

test("geography runs as background enrichment with client headroom", () => {
  assert.match(runtimeSource, /limit: 3/);
  assert.match(runtimeSource, /radius: 650/);
  assert.match(runtimeSource, /timeoutMs: 22000/);
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
  assert.match(runtimeSource, /locationState === "ready" && geographicDiscoveries\.length \? "geographic" : "simulated"/);
});

test("GPS diagnostics classify browser geolocation errors", () => {
  assert.match(runtimeSource, /code === 1.*PERMISSION_DENIED.*denied/);
  assert.match(runtimeSource, /code === 2.*POSITION_UNAVAILABLE.*unavailable/);
  assert.match(runtimeSource, /code === 3.*TIMEOUT.*timeout/);
});

test("GPS diagnostics retain elapsed time and request options", () => {
  assert.match(runtimeSource, /enableHighAccuracy: false, timeout: 8000, maximumAge: 300000/);
  assert.match(runtimeSource, /performance\.now\(\) - startedAt/);
});

test("GPS failure does not start the geography provider", () => {
  const locationCall = runtimeSource.indexOf("await getCurrentLocation()");
  const providerCall = runtimeSource.indexOf("GeographyApi.createProxyLocationDiscoveryProvider", locationCall);
  assert.ok(locationCall >= 0);
  assert.ok(providerCall > locationCall);
});