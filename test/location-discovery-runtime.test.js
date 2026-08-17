const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("browser bootstrap loads location discovery before app.js", () => {
  const runtime = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  assert.match(runtime, /discovery-provider\.js/);
  assert.match(runtime, /location-discovery-runtime\.js/);
});

test("location runtime preserves core choice ids while replacing presentation", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
  assert.match(source, /Object\.assign\(\{\}, choice/);
  assert.match(source, /originalGenerate\(state\)/);
  assert.match(source, /getCurrentPosition/);
  assert.match(source, /createLocationDiscoveryProvider/);
  assert.doesNotMatch(source, /stopImmediatePropagation/);
});
