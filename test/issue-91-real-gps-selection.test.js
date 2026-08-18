const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

test("real GPS choices keep the existing choice id and are indexed for selection", () => {
  assert.match(runtimeSource, /Object\.assign\(\{\}, choice/);
  assert.match(runtimeSource, /geographicChoicesById\.set\(merged\.choiceId, merged\)/);
  assert.match(runtimeSource, /card\.dataset\.choiceId = choice\.choiceId/);
  assert.match(runtimeSource, /card\.dataset\.discoverySource = choice\.geographicDiscovery \? "geographic" : "simulated"/);
});

test("real GPS cards show a game terrain label instead of only debug geography", () => {
  assert.match(runtimeSource, /TERRAIN_LABELS/);
  assert.match(runtimeSource, /signal: `地形：\$\{terrainLabel\(discovery\)\}`/);
  assert.match(runtimeSource, /signal\.textContent = choice\.signal/);
  assert.match(runtimeSource, /setRiskPips\(card, choice\.risk\)/);
});

test("selecting a real GPS card carries geographic metadata into the existing exploration result", () => {
  assert.match(runtimeSource, /const originalDiscoverLocation = Core\.discoverLocation\.bind\(Core\)/);
  assert.match(runtimeSource, /Core\.discoverLocation = function discoverLocationAware/);
  assert.match(runtimeSource, /const selected = geographicChoicesById\.get\(choiceId\)/);
  assert.match(runtimeSource, /applySelectedGeography\(result, selected\)/);
  assert.match(runtimeSource, /geographicDiscovery: metadata/);
  assert.match(runtimeSource, /realPlaceName: discovery\.realPlaceName/);
  assert.match(runtimeSource, /features: Array\.isArray\(discovery\.features\)/);
});

test("async GPS refresh reuses the last exploration state instead of relying on a global app state", () => {
  assert.match(runtimeSource, /let lastExplorationState = null/);
  assert.match(runtimeSource, /lastExplorationState = state/);
  assert.match(runtimeSource, /Core\.generateExplorationChoices\(lastExplorationState\)/);
  assert.doesNotMatch(runtimeSource, /window\.CrownlessAppState/);
});
