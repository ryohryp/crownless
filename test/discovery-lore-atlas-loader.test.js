const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("atlas loads fingerprinted discovery lore and NPC layers before lore presentation", () => {
  const loreIndex = runtimeSource.indexOf('lore.src = atlasAsset("src/discovery-lore.js")');
  const atlasIndex = runtimeSource.indexOf('atlas.src = atlasAsset("src/world-atlas.js")');
  const previewIndex = runtimeSource.indexOf('preview.src = atlasAsset("src/world-atlas-selection-preview.js")');
  const npcLifeIndex = runtimeSource.indexOf('npcLife.src = atlasAsset("src/npc-life.js")');
  const signalsIndex = runtimeSource.indexOf('signals.src = atlasAsset("src/world-atlas-npc-signals.js")');
  const encounterIndex = runtimeSource.indexOf('encounter.src = atlasAsset("src/npc-reunion-encounter.js")');
  const reunionIndex = runtimeSource.indexOf('presentation.src = atlasAsset("src/world-atlas-reunion-presentation.js")');
  const presentationIndex = runtimeSource.indexOf('lorePresentation.src = atlasAsset("src/world-atlas-lore-presentation.js")');
  assert.ok(loreIndex >= 0);
  assert.ok(atlasIndex >= 0);
  assert.ok(previewIndex >= 0);
  assert.ok(npcLifeIndex >= 0);
  assert.ok(signalsIndex >= 0);
  assert.ok(encounterIndex >= 0);
  assert.ok(reunionIndex >= 0);
  assert.ok(presentationIndex >= 0);
  assert.match(runtimeSource, /lore\.onload = loadAtlas/);
  assert.match(runtimeSource, /atlas\.onload = loadSelectionPreview/);
  assert.match(runtimeSource, /atlas\.onerror = failAtlasLoad/);
  assert.match(runtimeSource, /function loadSelectionPreview\(event\) \{\s*if \(!window\.CrownlessWorldAtlas\)/);
  assert.match(runtimeSource, /preview\.onload = loadNpcLifeForAtlas/);
  assert.match(runtimeSource, /npcLife\.onload = loadNpcSignals/);
  assert.match(runtimeSource, /signals\.onload = loadReunionEncounter/);
  assert.match(runtimeSource, /encounter\.onload = loadReunionPresentation/);
  assert.match(runtimeSource, /presentation\.onload = loadLorePresentation/);
});
