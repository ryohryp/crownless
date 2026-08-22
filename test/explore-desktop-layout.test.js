const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const desktopCss = fs.readFileSync(path.join(__dirname, "..", "desktop-layout.css"), "utf8");
const presentationSource = fs.readFileSync(path.join(__dirname, "..", "src", "exploration-map-presentation.js"), "utf8");

test("desktop exploration scrolls main and lets the active screen grow with content", () => {
  assert.match(desktopCss, /@media \(min-width: 901px\)[\s\S]*?body:has\(#explore-screen\.active\) main \{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/);
  assert.match(desktopCss, /body:has\(#explore-screen\.active\) #explore-screen\.screen\.active \{[\s\S]*?display: block !important;[\s\S]*?height: auto !important;[\s\S]*?overflow: visible !important;/);
});

test("desktop exploration header is a normal-flow information block", () => {
  assert.match(desktopCss, /#explore-screen \.expedition-title \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?align-items: start;/);
  assert.match(desktopCss, /#explore-screen \.expedition-title > div:first-child > p:last-child \{[\s\S]*?display: block !important;[\s\S]*?line-height: 1\.5;/);
  assert.doesNotMatch(desktopCss, /@media \(min-width: 901px\) and \(max-height: 820px\)/);
});

test("legacy exploration map panel is content-sized and only its board wrapper clips", () => {
  assert.match(desktopCss, /#exploration-map-panel \{[\s\S]*?height: auto !important;[\s\S]*?overflow: visible !important;/);
  assert.match(desktopCss, /\.exploration-map-layout \{[\s\S]*?height: auto !important;[\s\S]*?overflow: visible;/);
  assert.match(desktopCss, /\.exploration-map-board-wrap \{[\s\S]*?min-height: 420px !important;[\s\S]*?height: auto !important;[\s\S]*?overflow: hidden;/);
  assert.match(desktopCss, /\.exploration-map-board \{[\s\S]*?height: auto !important;[\s\S]*?max-height: none !important;/);
});

test("current nearby manuscript keeps clipping inside the map drawing field", () => {
  assert.match(desktopCss, /#explore-screen \.sketch-map-field \{[\s\S]*?overflow: hidden;/);
  assert.match(presentationSource, /\.sketch-map-field \{ position:relative; height:220px; overflow:hidden;/);
  assert.match(desktopCss, /#explore-screen \.lead-list \{[\s\S]*?overflow: visible;/);
});
