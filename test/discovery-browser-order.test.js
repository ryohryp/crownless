const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "exploration-map-presentation.js"), "utf8");

test("direct discovery remains playable when provider script is not loaded", () => {
  assert.match(source, /if \(Discovery && typeof Discovery\.createSimulatedDiscoveryProvider === "function"\)/);
  assert.match(source, /return leads\.slice\(0, DESTINATION_LIMIT\)/);
});
