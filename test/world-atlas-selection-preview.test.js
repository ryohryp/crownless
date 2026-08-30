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

test("marker identity is resolved by the marker's discovery name rather than DOM index", () => {
  const marker = {
    getAttribute(name) {
      return name === "aria-label" ? "四つ木公園。南東、少し先。発見済み / 遠征候補。" : "";
    },
    querySelector() { return null; },
    textContent: ""
  };
  const safe = {
    worldKnowledge: {
      discoveries: {
        park: {
          key: "park",
          name: "四つ木公園",
          contentKind: "encounter",
          terrain: ["woods"]
        }
      }
    }
  };

  assert.equal(Preview.markerName(marker), "四つ木公園");
  assert.equal(Preview.rememberedByName(safe, Preview.markerName(marker)).key, "park");
});

test("atlas preview controller updates detail and artwork from label clicks", () => {
  assert.match(source, /world-atlas-nearby-marker/);
  assert.match(source, /world-atlas-marker/);
  assert.match(source, /world-atlas-unplaced button/);
  assert.match(source, /syncDetail/);
  assert.match(source, /syncSelection/);
  assert.match(source, /resolveLocationVisual/);
  assert.match(source, /選択地点の墨絵/);
  assert.match(source, /この地点の墨絵はまだ記録されていない/);
  assert.match(source, /pointer-events:auto !important/);
  assert.match(source, /document\.addEventListener\("click"[\s\S]*true\);/);
});

test("runtime loads selected-location preview only after world atlas", () => {
  assert.match(runtimeSource, /atlas\.onload = loadSelectionPreview/);
  assert.match(runtimeSource, /src\/world-atlas-selection-preview\.js/);
});
