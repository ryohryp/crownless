const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "hearth.css"), "utf8");
const viewportCss = fs.readFileSync(path.join(root, "hearth-viewport.css"), "utf8");
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

test("discovery journal is surfaced through the physical wall map instead of another dashboard panel", () => {
  assert.match(js, /document\.getElementById\("world-knowledge-panel"\)/);
  assert.match(js, /knowledgePanel\.hidden = true/);
  assert.match(js, /numberFrom\("#world-knowledge-count"\)/);
  assert.match(js, /RENOWN \$\{renown\} \/ 探索録 \$\{discovered\}/);
  assert.match(js, /最近の墨印/);
  assert.match(js, /map\?\.addEventListener\("click"/);
});

test("discovered location art unlocks on the wall map only after the static asset loads", () => {
  assert.match(html, /src="src\/location-visuals\.js"[\s\S]*src="src\/location-discovery-runtime\.js"/);
  assert.match(js, /window\.CrownlessLocationVisuals/);
  assert.match(js, /resolveLatestDiscoveredVisual/);
  assert.match(js, /new Image\(\)/);
  assert.match(js, /image\.onload/);
  assert.match(js, /image\.onerror/);
  assert.match(js, /classList\.add\("has-location-visual"\)/);
  assert.match(js, /mapPaper\.style\.backgroundImage/);
  assert.match(js, /clearMapVisual\(\)/);
});

test("ambient interactions are optional play and preserve the expedition action", () => {
  assert.match(js, /spawnEmbers\(12\)/);
  assert.match(js, /temporaryClass\("character-ready"/);
  assert.match(js, /scrollTo\("#hub-screen \.inventory-panel"\)/);
  assert.match(js, /scrollTo\("#hearth-progress"\)/);
  assert.match(html, /src="src\/hearth-presentation\.js"/);
  assert.match(html, /href="hearth\.css"/);
});

test("interactive Hearth remains scroll-safe at tablet widths", () => {
  assert.match(js, /hearth-viewport\.css/);
  assert.match(viewportCss, /@media \(min-width: 701px\) and \(max-width: 900px\)/);
  assert.match(viewportCss, /body:has\(#hub-screen\.active\) main[\s\S]*?overflow-y: auto/);
  assert.match(viewportCss, /#hub-screen\.screen\.active[\s\S]*?display: block/);
});
