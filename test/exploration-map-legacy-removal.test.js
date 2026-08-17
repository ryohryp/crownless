const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "exploration-map-presentation.js"), "utf8");

test("direct exploration does not persist duplicate traversal state", () => {
  assert.doesNotMatch(source, /crownless\.map\.v1/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /commitWorld/);
});
