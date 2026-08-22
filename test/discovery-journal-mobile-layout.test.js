const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssSource = fs.readFileSync(path.join(__dirname, "../discovery-journal-browser.css"), "utf8");
const journalSource = fs.readFileSync(path.join(__dirname, "../src/discovery-journal-browser.js"), "utf8");

function mobileBlock(source) {
  const start = source.indexOf("@media (max-width: 700px)");
  const end = source.indexOf("@media (max-width: 420px)", start);
  assert.ok(start >= 0, "mobile discovery-journal media query should exist");
  assert.ok(end > start, "420px refinement should follow the main mobile block");
  return source.slice(start, end);
}

test("mobile discovery journal keeps the coarse map compact and preserves first-view list space", () => {
  const mobile = mobileBlock(cssSource);

  assert.match(mobile, /\.discovery-area-map\s*\{[\s\S]*width:\s*clamp\(200px,\s*58vw,\s*220px\)/);
  assert.match(mobile, /\.discovery-area-cell\s*\{[\s\S]*min-height:\s*0/);
  assert.match(mobile, /\.discovery-journal-body\s*\{[\s\S]*grid-template-rows:\s*minmax\(86px,\s*24%\)\s*minmax\(0,\s*1fr\)/);
  assert.match(mobile, /\.discovery-journal-media,[\s\S]*min-height:\s*135px/);
});

test("mobile discovery journal places the all-records action below the map instead of beside the heading", () => {
  const mobile = mobileBlock(cssSource);

  assert.match(mobile, /\.discovery-area-copy\s*\{\s*display:\s*contents/);
  assert.match(mobile, /\.discovery-area-map-wrap\s*\{[\s\S]*grid-row:\s*2/);
  assert.match(mobile, /\.discovery-area-all\s*\{[\s\S]*grid-row:\s*3/);
  assert.match(mobile, /\.discovery-area-all\s*\{[\s\S]*width:\s*clamp\(200px,\s*58vw,\s*220px\)/);
});

test("area filtering remains tap-driven while desktop keeps the five-by-five map contract", () => {
  assert.match(journalSource, /selectedAreaId\s*=\s*area\.id/);
  assert.match(journalSource, /all\.addEventListener\("click",[\s\S]*selectedAreaId\s*=\s*""/);
  assert.match(cssSource, /\.discovery-area-map\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(cssSource, /\.discovery-area-map\s*\{[\s\S]*width:\s*min\(100%,\s*390px\)/);
});
