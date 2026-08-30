const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("atlas loads deterministic discovery lore before atlas presentation", () => {
  const loreIndex = runtimeSource.indexOf('lore.src = "src/discovery-lore.js"');
  const atlasIndex = runtimeSource.indexOf('atlas.src = "src/world-atlas.js"');
  const previewIndex = runtimeSource.indexOf('preview.src = "src/world-atlas-selection-preview.js"');
  const presentationIndex = runtimeSource.indexOf('lorePresentation.src = "src/world-atlas-lore-presentation.js"');
  assert.ok(loreIndex >= 0);
  assert.ok(atlasIndex >= 0);
  assert.ok(previewIndex >= 0);
  assert.ok(presentationIndex >= 0);
  assert.match(runtimeSource, /lore\.onload = loadAtlas/);
  assert.match(runtimeSource, /atlas\.onload = loadSelectionPreview/);
  assert.match(runtimeSource, /preview\.onload = loadLorePresentation/);
});
