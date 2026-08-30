const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Presentation = require("../src/world-atlas-lore-presentation.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-lore-presentation.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../world-atlas-lore.css"), "utf8");

test("atlas lore record deepens by discovery state", () => {
  const lore = { expeditionNote: "夜は避けた方がよい。", clearedNote: "帰路を地図に残した。" };
  assert.match(Presentation.explorationRecordText(lore, "discovered"), /未調査/);
  assert.equal(Presentation.explorationRecordText(lore, "investigated"), lore.expeditionNote);
  assert.equal(Presentation.explorationRecordText(lore, "cleared"), lore.clearedNote);
});

test("atlas lore presentation labels fiction and the decision hints", () => {
  assert.match(source, /CROWNLESS LORE \/ 架空の探索録/);
  assert.match(source, /脅威の気配/);
  assert.match(source, /期待できるもの/);
  assert.match(source, /現実の地点の由来・事件を示すものではない/);
  assert.match(source, /buildDiscoveryLore/);
});

test("atlas lore layout wraps hints and collapses to one column on narrow phones", () => {
  assert.match(css, /flex-wrap:wrap/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /@media \(max-width:420px\)/);
  assert.match(css, /grid-template-columns:1fr/);
});
