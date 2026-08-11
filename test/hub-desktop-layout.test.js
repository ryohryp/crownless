const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "desktop-layout.css"), "utf8");

test("desktop Grey Hearth returns to normal document scrolling", () => {
  assert.match(css, /html:has\(#hub-screen\.active\),[\s\S]*?body:has\(#hub-screen\.active\)[\s\S]*?overflow-y: auto;/);
  assert.match(css, /body:has\(#hub-screen\.active\) \.app-shell[\s\S]*?height: auto;[\s\S]*?overflow: visible;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen\.screen\.active[\s\S]*?display: block !important;[\s\S]*?height: auto !important;[\s\S]*?overflow: visible !important;/);
});

test("desktop Grey Hearth restores unconstrained hero sizing", () => {
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen \.hub-hero[\s\S]*?min-height: 520px;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen \.hub-copy[\s\S]*?min-height: 480px;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen \.loadout-card[\s\S]*?min-height: 430px;/);
});

test("exploration keeps its one-screen desktop layout", () => {
  assert.match(css, /#explore-screen\.screen\.active[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden;/);
  assert.match(css, /#exploration-map-panel[\s\S]*?height: 100%;[\s\S]*?overflow: hidden;/);
});
