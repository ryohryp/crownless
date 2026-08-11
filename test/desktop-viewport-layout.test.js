const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "viewport-fix.css"), "utf8");

test("desktop keeps browser page locked to the viewport", () => {
  assert.match(css, /@media \(min-width: 701px\)[\s\S]*?html,[\s\S]*?body \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /\.app-shell \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/);
  assert.match(css, /main \{[\s\S]*?flex: 1 1 auto;[\s\S]*?overflow: hidden;/);
});

test("desktop screens retain contained scrolling without a browser scrollbar", () => {
  assert.match(css, /\.screen\.active \{[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-width: none;/);
  assert.match(css, /\.screen\.active::-webkit-scrollbar \{[\s\S]*?width: 0;/);
});

test("desktop combat arena scales against available viewport height", () => {
  assert.match(css, /\.combat-screen\.active \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /calc\(\(100dvh - 210px\) \* 16 \/ 9\)/);
  assert.match(css, /calc\(\(100dvh - 155px\) \* 16 \/ 9\)/);
});

test("mobile remains outside the desktop page-lock media query", () => {
  const desktopStart = css.indexOf("@media (min-width: 701px)");
  const mobileStart = css.indexOf("@media (max-width: 700px)");
  assert.ok(desktopStart >= 0);
  assert.ok(mobileStart > desktopStart);
});
