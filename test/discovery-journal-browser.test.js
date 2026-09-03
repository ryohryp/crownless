const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const locationVisualSource = fs.readFileSync(path.join(__dirname, "../src/location-visuals.js"), "utf8");

test("location visuals does not inject obsolete discovery-journal-browser script", () => {
  assert.doesNotMatch(locationVisualSource, /discovery-journal-browser\.js/);
  assert.equal(fs.existsSync(path.join(__dirname, "../src/discovery-journal-browser.js")), false);
  assert.equal(fs.existsSync(path.join(__dirname, "../discovery-journal-browser.css")), false);
});
