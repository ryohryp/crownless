const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "hearth.css"), "utf8");
const js = fs.readFileSync(path.join(root, "src", "hearth-presentation.js"), "utf8");

test("Grey Hearth exposes interactive world objects instead of a single CTA card", () => {
  assert.match(html, /id="hearth-scene"/);
  assert.match(html, /id="start-expedition"[^>]*class="hearth-object hearth-gate"/);
  assert.match(html, /id="hearth-fire-interaction"/);
  assert.match(html, /id="hearth-character-interaction"/);
  assert.match(html, /id="hearth-loot-focus"/);
  assert.match(html, /id="hearth-map-focus"/);
});

test("existing hub state ids remain wired for app rendering", () => {
  for (const id of ["equipped-label", "loadout-title", "loadout-description", "secured-count", "secured-loot", "stat-runs", "stat-survived", "stat-kills", "stat-defeats"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("hearth presentation responds to progression and equipment state", () => {
  assert.match(js, /scene\.dataset\.weapon = weaponKind\(\)/);
  assert.match(js, /renown >= 5/);
  assert.match(js, /renown >= 15/);
  assert.match(js, /renown >= 30/);
  assert.match(css, /\.hearth-scene\.rank-1/);
  assert.match(css, /\.hearth-scene\.rank-2/);
  assert.match(css, /\.hearth-scene\.rank-3/);
});

test("ambient interactions are optional play and preserve the expedition action", () => {
  assert.match(js, /spawnEmbers\(12\)/);
  assert.match(js, /temporaryClass\("character-ready"/);
  assert.match(js, /scrollTo\("#hub-screen \.inventory-panel"\)/);
  assert.match(js, /scrollTo\("#hearth-progress"\)/);
  assert.match(html, /src="src\/hearth-presentation\.js"/);
  assert.match(html, /href="hearth\.css"/);
});
