const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
const atlasSource = fs.readFileSync(path.join(__dirname, "../src/world-atlas.js"), "utf8");

test("first wall-map tap is held until the dynamically loaded Atlas is ready", () => {
  assert.match(runtimeSource, /const wallMap = document\.getElementById\("hearth-map-focus"\)/);
  assert.match(runtimeSource, /wallMap\.addEventListener\("click", function holdWallMapUntilAtlasReady\(event\)[\s\S]*if \(atlasReady\) return;[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*atlasReplayQueued = true;[\s\S]*}, true\);/);
  assert.match(runtimeSource, /function finishAtlasReady\(\)[\s\S]*atlasReady = true;[\s\S]*atlasReplayQueued = false;[\s\S]*wallMap\.click\(\);/);
});

test("Atlas readiness is released at the existing success/failure loader boundary", () => {
  assert.match(runtimeSource, /function loadSelectionPreview\(\) \{\s*finishAtlasReady\(\);/);
  assert.match(runtimeSource, /atlas\.onload = loadSelectionPreview;/);
  assert.match(runtimeSource, /atlas\.onerror = loadSelectionPreview;/);
  assert.match(runtimeSource, /existingAtlas\.addEventListener\("load", loadSelectionPreview, \{ once: true \}\);/);
  assert.match(runtimeSource, /existingAtlas\.addEventListener\("error", loadSelectionPreview, \{ once: true \}\);/);
});

test("canonical Atlas still owns the replayed wall-map click in capture phase", () => {
  assert.match(atlasSource, /wallMap\.addEventListener\("click", \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*openAtlas\(document, Core, root\);[\s\S]*}, true\);/);
});
