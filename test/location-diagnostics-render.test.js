const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("location diagnostics live outside carried-warning and repaint through loading gate", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
  const gate = fs.readFileSync(path.join(__dirname, "../src/expedition-start-gate.js"), "utf8");
  assert.match(source, /id = "location-discovery-status"/);
  assert.match(source, /warning\.parentNode\.insertBefore\(marker, warning\.nextSibling\)/);
  assert.match(source, /showPending: setPendingUi/);
  assert.match(source, /finish\(\) \{ setPendingUi\(\); \}/);
  assert.match(gate, /runtime\.showPending\(\)/);
  assert.match(gate, /runtime\.finish\(\)/);
  assert.doesNotMatch(source, /warning\.appendChild\(marker\)/);
});
