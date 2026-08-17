const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "exploration-map-presentation.js"), "utf8");

test("exploration tells the player discovery is already done", () => {
  assert.match(source, /DISCOVERED NEARBY/);
  assert.match(source, /地図を一歩ずつ進める必要はない/);
});
