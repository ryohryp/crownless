const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("atlas action model and presentation load after lore presentation", () => {
  assert.match(runtimeSource, /lorePresentation\.src = "src\/world-atlas-lore-presentation\.js"/);
  assert.match(runtimeSource, /actions\.src = "src\/discovery-actions\.js"/);
  assert.match(runtimeSource, /presentation\.src = "src\/world-atlas-actions-presentation\.js"/);
  assert.match(runtimeSource, /lorePresentation\.onload = loadActionsDomain/);
  assert.match(runtimeSource, /actions\.onload = loadActionsPresentation/);
});
