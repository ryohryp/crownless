const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("atlas action model and presentation load after lore presentation", () => {
  const lorePresentationIndex = runtimeSource.indexOf('lorePresentation.src = "src/world-atlas-lore-presentation.js"');
  const actionsIndex = runtimeSource.indexOf('actions.src = "src/discovery-actions.js"');
  const actionsPresentationIndex = runtimeSource.indexOf('presentation.src = "src/world-atlas-actions-presentation.js"');
  assert.ok(lorePresentationIndex >= 0);
  assert.ok(actionsIndex > lorePresentationIndex);
  assert.ok(actionsPresentationIndex >= 0);
  assert.match(runtimeSource, /lorePresentation\.onload = loadActionsDomain/);
  assert.match(runtimeSource, /actions\.onload = loadActionsPresentation/);
});
