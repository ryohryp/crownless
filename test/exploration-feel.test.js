const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Feel = require("../src/exploration-feel.js");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("expedition pressure escalates with wounds, loot, and depth", () => {
  assert.equal(Feel.pressureLevel({ hp: 100, loot: 0, depth: 1 }), "calm");
  assert.equal(Feel.pressureLevel({ hp: 60, loot: 1, depth: 2 }), "wary");
  assert.equal(Feel.pressureLevel({ hp: 55, loot: 3, depth: 4 }), "danger");
  assert.equal(Feel.pressureLevel({ hp: 20, loot: 0, depth: 1 }), "critical");
});

test("frontier title exposes only the omen before approach", () => {
  assert.equal(Feel.scoutHintFromTitle("動く影 — 霧を払う"), "動く影");
  assert.equal(Feel.scoutHintFromTitle("強い気配 — 霧を払う"), "強い気配");
  assert.match(Feel.approachCopy("人影"), /影/);
});

test("dangerous discoveries use a deliberate entry label", () => {
  assert.equal(Feel.investigateLabel(2), "この場所を調べる");
  assert.equal(Feel.investigateLabel(3), "警戒して踏み込む");
  assert.equal(Feel.investigateLabel(5), "危険を承知で踏み込む");
});

test("browser loads exploration feel after the fog map", () => {
  const map = index.indexOf('src/exploration-map-presentation.js');
  const feel = index.indexOf('src/exploration-feel.js');
  assert.ok(map >= 0);
  assert.ok(feel > map);
});
