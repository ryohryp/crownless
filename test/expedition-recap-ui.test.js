const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("expedition recap UI targets the current report DOM", () => {
  const source = fs.readFileSync(path.join(root, "src", "expedition-recap-ui.js"), "utf8");
  assert.match(source, /querySelector\("\.report-scroll"\)/);
  assert.match(source, /text\("\.kicker", reportScroll \|\| panel \|\| root\)/);
  assert.match(source, /const reportBody = reportScroll \|\| panel;/);
  assert.match(source, /reportBody\.appendChild\(section\)/);
  assert.doesNotMatch(source, /text\("\.panel > \.kicker"\)/);
  assert.doesNotMatch(source, /querySelector\("\.button-stack"\)/);
});

test("recap UI remains loaded after the report renderer", () => {
  const html = fs.readFileSync(path.join(root, "expedition.html"), "utf8");
  assert.match(html, /src\/slice-app\.js[^]*src\/expedition-recap-ui\.js/);
});
