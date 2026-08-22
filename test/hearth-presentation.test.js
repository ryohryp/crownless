const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "hearth.css"), "utf8");
const viewportCss = fs.readFileSync(path.join(root, "hearth-viewport.css"), "utf8");
const locationVisualCss = fs.readFileSync(path.join(root, "hearth-location-visual.css"), "utf8");
const js = fs.readFileSync(path.join(root, "src", "hearth-presentation.js"), "utf8");

test("Grey Hearth exposes interactive world objects instead of a single CTA card", () => {
  assert.match(html, /id="hearth-scene"/);
  assert.match(html, /class="hearth-scene hearth-scene--empty-room"/);
  assert.match(html, /class="hearth-scene-art"/);
  assert.match(html, /assets\/combat\/minimal-v0\.1\/actors\/player-unarmed\.png/);
  assert.match(html, /id="start-expedition"[^>]*class="hearth-object hearth-gate"/);
  assert.match(html, /id="hearth-fire-interaction"/);
  assert.match(html, /id="hearth-character-interaction"/);
  assert.match(html, /id="hearth-loot-focus"/);
  assert.match(html, /id="hearth-map-focus"/);
});

test("Issue 166 keeps the room visual primary and reveals secondary labels on interaction", () => {
  assert.match(html, /data-visual="grey-hearth-empty-room-v0\.2"/);
  assert.match(html, /<h1>灰炉<em>帰る場所が、<br>少しずつ育つ。<\/em><\/h1>/);
  assert.match(css, /\.hearth-scene-copy\s*\{[\s\S]*?width:\s*min\(290px,\s*32%\)/);
  assert.match(css, /\.hearth-object \.object-label\s*\{[\s\S]*?opacity:\s*0[\s\S]*?visibility:\s*hidden/);
  assert.match(css, /\.hearth-object:hover \.object-label/);
  assert.match(css, /\.hearth-object:focus \.object-label/);
  assert.match(css, /\.hearth-gate \.object-label\s*\{[\s\S]*?opacity:\s*1[\s\S]*?visibility:\s*visible/);
  assert.match(css, /\.hearth-scene-art::after\s*\{[\s\S]*?animation:\s*hearthRoomMist/);
  assert.match(css, /\.hearth-scene-art::after,[\s\S]*?animation:\s*none\s*!important/);
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
  assert.match(css, /\.hearth-scene-art/);
  assert.match(css, /grey-hearth-empty-room-v0\.2\.png/);
  assert.match(css, /background-position:\s*56% center/);
});

test("discovery journal is surfaced through the physical wall map instead of another dashboard panel", () => {
  assert.match(js, /document\.getElementById\("world-knowledge-panel"\)/);
  assert.match(js, /knowledgePanel\.hidden = true/);
  assert.match(js, /numberFrom\("#world-knowledge-count"\)/);
  assert.match(js, /RENOWN \$\{renown\} \/ 探索録 \$\{discovered\}/);
  assert.match(js, /画像付きの発見はまだない/);
  assert.match(js, /map\?\.addEventListener\("click"/);
});

test("discovered location art opens from the physical wall map without a second permanent map layer", () => {
  assert.match(html, /src="src\/location-visuals\.js"[\s\S]*src="src\/location-discovery-runtime\.js"/);
  assert.match(js, /window\.CrownlessLocationVisuals/);
  assert.match(js, /resolveLatestDiscoveredVisual/);
  assert.match(js, /new Image\(\)/);
  assert.match(js, /image\.onload/);
  assert.match(js, /image\.onerror/);
  assert.match(js, /classList\.add\("has-location-visual"\)/);
  assert.doesNotMatch(js, /mapPaper\.style\.backgroundImage/);
  assert.match(js, /clearMapVisual\(\)/);
});

test("unlocked wall-map art can be opened as a phone-readable discovery folio", () => {
  assert.match(js, /ensureStylesheet\("hearth-location-visual\.css"\)/);
  assert.match(js, /function openLocationVisualViewer\(\)/);
  assert.match(js, /viewer\.id = "hearth-location-visual-viewer"/);
  assert.match(js, /assetPath !== mapVisualAsset/);
  assert.match(js, /map\?\.classList\.contains\("has-location-visual"\)/);
  assert.match(js, /image\.src = assetPath/);
  assert.match(js, /event\.key === "Escape"/);
  assert.match(js, /map\.classList\.contains\("has-location-visual"\) && openLocationVisualViewer\(\)/);
  assert.match(locationVisualCss, /\.hearth-location-visual-viewer\s*\{[\s\S]*position:\s*fixed/);
  assert.match(locationVisualCss, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(locationVisualCss, /@media \(max-width:\s*560px\)/);
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
