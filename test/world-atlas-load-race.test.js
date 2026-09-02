const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
const atlasSource = fs.readFileSync(path.join(__dirname, "../src/world-atlas.js"), "utf8");

test("wall-map taps stay captured until the dynamically loaded Atlas is ready", () => {
  assert.match(runtimeSource, /const wallMap = document\.getElementById\("hearth-map-focus"\)/);
  assert.match(runtimeSource, /wallMap\.addEventListener\("click", function holdWallMapUntilAtlasReady\(event\)[\s\S]*if \(atlasReady\) return;[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*atlasReplayQueued = true;[\s\S]*if \(atlasLoadFailed\)[\s\S]*loadAtlas\(\);[\s\S]*}, true\);/);
  assert.match(runtimeSource, /function finishAtlasReady\(\)[\s\S]*atlasReady = true;[\s\S]*atlasReplayQueued = false;[\s\S]*wallMap\.click\(\);/);
});

test("Atlas dynamic assets inherit the Pages deploy fingerprint", () => {
  assert.match(runtimeSource, /document\.currentScript/);
  assert.match(runtimeSource, /searchParams\.get\("v"\)/);
  assert.match(runtimeSource, /const atlasAsset = \(path\) => runtimeVersion \? `\$\{path\}\?v=\$\{encodeURIComponent\(runtimeVersion\)\}` : path;/);
  assert.match(runtimeSource, /atlas\.src = atlasAsset\("src\/world-atlas\.js"\);/);
  assert.match(runtimeSource, /preview\.src = atlasAsset\("src\/world-atlas-selection-preview\.js"\);/);
});

test("Atlas load failure never replays the wall-map click into the legacy discovery UI", () => {
  assert.match(runtimeSource, /function failAtlasLoad\(event\)[\s\S]*atlasReady = false;[\s\S]*atlasLoadFailed = true;/);
  assert.match(runtimeSource, /existingAtlas\.addEventListener\("error", failAtlasLoad, \{ once: true \}\);/);
  assert.match(runtimeSource, /atlas\.onerror = failAtlasLoad;/);
  assert.doesNotMatch(runtimeSource, /atlas\.onerror = loadSelectionPreview;/);
  assert.match(runtimeSource, /function loadSelectionPreview\(event\)[\s\S]*if \(!window\.CrownlessWorldAtlas\) \{[\s\S]*failAtlasLoad\(event\);[\s\S]*return;/);
});

test("canonical Atlas owns the replayed wall-map click in capture phase", () => {
  assert.match(atlasSource, /wallMap\.addEventListener\("click", \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*openAtlas\(document, Core, root\);[\s\S]*}, true\);/);
});
