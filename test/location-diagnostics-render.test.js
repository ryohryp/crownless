const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("location diagnostics live outside carried-warning and repaint after app render", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
  assert.match(source, /id = "location-discovery-status"/);
  assert.match(source, /warning\.parentNode\.insertBefore\(marker, warning\.nextSibling\)/);
  assert.match(source, /setTimeout\(showLocationStatus, 0\)/);
  assert.doesNotMatch(source, /warning\.appendChild\(marker\)/);
});
