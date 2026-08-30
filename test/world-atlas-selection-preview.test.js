const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Preview = require("../src/world-atlas-selection-preview.js");
const LocationVisuals = require("../src/location-visuals.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-selection-preview.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("selected watchtower resolves its own artwork instead of the latest discovery artwork", () => {
  const model = Preview.previewModel({
    key: "watchtower",
    name: "崩れた物見台",
    baseTitle: "崩れた物見台",
    contentKind: "dungeon",
    terrain: ["height"]
  }, LocationVisuals);

  assert.equal(model.state, "visual");
  assert.equal(model.name, "崩れた物見台");
  assert.equal(model.visual.assetPath, "assets/locations/ruined-watchtower.png");
});

test("a selected discovery without registered artwork becomes an explicit empty preview", () => {
  const model = Preview.previewModel({
    key: "river-crossing",
    name: "綾瀬川の血濡れの渡し場",
    contentKind: "encounter",
    terrain: ["water", "crossing"]
  }, LocationVisuals);

  assert.equal(model.state, "empty");
  assert.equal(model.visual, null);
  assert.equal(model.name, "綾瀬川の血濡れの渡し場");
});

test("atlas preview controller follows nearby, world, and unplaced selection clicks", () => {
  assert.match(source, /world-atlas-nearby-marker/);
  assert.match(source, /world-atlas-marker/);
  assert.match(source, /world-atlas-unplaced button/);
  assert.match(source, /resolveLocationVisual/);
  assert.match(source, /選択地点の墨絵/);
  assert.match(source, /この地点の墨絵はまだ記録されていない/);
  assert.match(source, /document\.addEventListener\("click"/);
});

test("runtime loads selected-location preview only after world atlas", () => {
  assert.match(runtimeSource, /atlas\.onload = loadSelectionPreview/);
  assert.match(runtimeSource, /src\/world-atlas-selection-preview\.js/);
});