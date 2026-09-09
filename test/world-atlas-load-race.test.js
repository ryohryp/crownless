const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const atlasSource = fs.readFileSync(path.join(__dirname, "../src/world-atlas.js"), "utf8");

test("canonical Atlas owns the replayed wall-map click in capture phase", () => {
  assert.match(atlasSource, /wallMap\.addEventListener\("click", \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopImmediatePropagation\(\);[\s\S]*openAtlas\(document, Core, root\);[\s\S]*}, true\);/);
});
