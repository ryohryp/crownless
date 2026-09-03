const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const locationVisualSource = fs.readFileSync(path.join(root, "src", "location-visuals.js"), "utf8");
const atlasSource = fs.readFileSync(path.join(root, "src", "world-atlas.js"), "utf8");

test("wall map has one canonical browser owner: World Atlas", () => {
  assert.equal(fs.existsSync(path.join(root, "src", "discovery-journal-browser.js")), false);
  assert.equal(fs.existsSync(path.join(root, "discovery-journal-browser.css")), false);
  assert.doesNotMatch(locationVisualSource, /discovery-journal-browser/);
  assert.match(atlasSource, /document\.getElementById\("hearth-map-focus"\)/);
  assert.match(atlasSource, /openAtlas\(document, Core, root\)/);
  assert.match(atlasSource, /event\.stopImmediatePropagation\(\)/);
});
