const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "desktop-layout.css"), "utf8");

test("desktop Grey Hearth uses main as the explicit scroll container", () => {
  assert.match(css, /body:has\(#hub-screen\.active\) main[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;/);
  assert.match(css, /body:has\(#hub-screen\.active\) main[\s\S]*?overscroll-behavior-y: contain;/);
  assert.doesNotMatch(css, /html:has\(#hub-screen\.active\),[\s\S]*?body:has\(#hub-screen\.active\)[\s\S]*?overflow-y: auto;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen\.screen\.active[\s\S]*?display: block !important;[\s\S]*?height: auto !important;[\s\S]*?overflow: visible !important;/);
});

test("desktop Grey Hearth restores unconstrained hero sizing", () => {
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen \.hub-hero[\s\S]*?min-height: 520px;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen \.hub-copy[\s\S]*?min-height: 480px;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen \.loadout-card[\s\S]*?min-height: 430px;/);
});

test("Grey Hearth and exploration keep independent desktop scroll scopes", () => {
  assert.match(css, /body:has\(#hub-screen\.active\) main[\s\S]*?overflow-y: auto;/);
  assert.match(css, /body:has\(#explore-screen\.active\) main[\s\S]*?overflow-y: auto;/);
  assert.match(css, /body:has\(#hub-screen\.active\) #hub-screen\.screen\.active[\s\S]*?height: auto !important;/);
  assert.match(css, /body:has\(#explore-screen\.active\) #explore-screen\.screen\.active[\s\S]*?height: auto !important;/);
});
