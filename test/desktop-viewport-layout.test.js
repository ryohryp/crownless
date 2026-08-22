const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "viewport-fix.css"), "utf8");
const desktopCss = fs.readFileSync(path.join(__dirname, "..", "desktop-layout.css"), "utf8");

test("desktop base stylesheet locks browser page and active screen to one viewport", () => {
  assert.match(css, /@media \(min-width: 701px\)[\s\S]*?html,[\s\S]*?body \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /\.app-shell \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/);
  assert.match(css, /\.screen\.active \{[\s\S]*?height: 100%;[\s\S]*?overflow: hidden;/);
  assert.doesNotMatch(css, /\.screen\.active \{[\s\S]{0,160}?overflow-y: auto;/);
});

test("desktop hub is split into viewport-sized rows in the base stylesheet", () => {
  assert.match(css, /#hub-screen\.active \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows:/);
  assert.match(css, /#hub-screen \.hub-hero \{[\s\S]*?min-height: 0;[\s\S]*?height: 100%;/);
  assert.match(css, /#hub-screen \.hub-grid \{[\s\S]*?min-height: 0;[\s\S]*?height: 100%;/);
});

test("desktop exploration overrides the viewport base with document flow", () => {
  assert.match(css, /#explore-screen\.active \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/);
  assert.match(desktopCss, /body:has\(#explore-screen\.active\) main[\s\S]*?overflow-y: auto;/);
  assert.match(desktopCss, /body:has\(#explore-screen\.active\) #explore-screen\.screen\.active[\s\S]*?display: block !important;[\s\S]*?height: auto !important;[\s\S]*?overflow: visible !important;/);
  assert.match(desktopCss, /#exploration-map-panel[\s\S]*?height: auto !important;[\s\S]*?overflow: visible !important;/);
});

test("decision and return screens use fixed viewport rows", () => {
  assert.match(css, /#decision-screen\.active \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;/);
  assert.match(css, /#return-screen\.active \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;/);
});

test("only unbounded loot collections retain local scrolling in the viewport base", () => {
  assert.match(css, /inventory-panel \.loot-list \{[\s\S]*?overflow-y: auto;/);
  assert.match(css, /carried-panel \.loot-list \{[\s\S]*?overflow-y: auto;/);
  assert.match(css, /return-spoils \.loot-list \{[\s\S]*?overflow-y: auto;/);
});

test("desktop combat arena scales against available viewport height", () => {
  assert.match(css, /\.combat-screen\.active \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /calc\(\(100dvh - 190px\) \* 16 \/ 9\)/);
  assert.match(css, /calc\(\(100dvh - 140px\) \* 16 \/ 9\)/);
});

test("mobile remains outside the desktop page-lock media query", () => {
  const desktopStart = css.indexOf("@media (min-width: 701px)");
  const mobileStart = css.indexOf("@media (max-width: 700px)");
  assert.ok(desktopStart >= 0);
  assert.ok(mobileStart > desktopStart);
});
