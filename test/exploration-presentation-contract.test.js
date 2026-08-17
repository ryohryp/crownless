const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "exploration-map-presentation.js"), "utf8");

test("exploration presentation no longer implements node-by-node fog traversal", () => {
  assert.doesNotMatch(source, /chooseFrontierCells/);
  assert.doesNotMatch(source, /travelToSelected/);
  assert.doesNotMatch(source, /霧を、一枚ずつ剥がす/);
  assert.match(source, /どこへ挑むかを選ぶ/);
});

test("legacy expedition route is presentation-only and hidden", () => {
  assert.match(source, /#expedition-route \{ display:none !important; \}/);
});
