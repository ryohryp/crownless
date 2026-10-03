const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("campfire rumor UI targets the current report DOM", () => {
  const source = fs.readFileSync(path.join(root, "src", "campfire-rumor-ui.js"), "utf8");
  assert.match(source, /querySelector\("\.report-scroll"\)/);
  assert.match(source, /text\("\.kicker", reportScroll \|\| panel \|\| root\)/);
  assert.match(source, /const reportBody = reportScroll \|\| panel;/);
  assert.match(source, /reportBody\.appendChild\(section\)/);
  assert.doesNotMatch(source, /text\("\.panel > \.kicker"\)/);
});
