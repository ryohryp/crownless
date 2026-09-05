const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "hearth-home-shell.css"), "utf8");
const shell = fs.readFileSync(path.join(root, "src", "hearth-home-shell.js"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src", "hearth-presentation.js"), "utf8");

test("Grey Hearth overrides dashboard scrolling with a bounded play surface", () => {
  assert.match(css, /body:has\(#hub-screen\.active\) main\s*\{[\s\S]*?overflow:\s*hidden !important/);
  assert.match(css, /#hub-screen\.screen\.active[\s\S]*?height:\s*100% !important[\s\S]*?overflow:\s*hidden !important/);
  assert.match(css, /#hub-screen \.hearth-scene[\s\S]*?height:\s*100%[\s\S]*?min-height:\s*0 !important/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?body:has\(#hub-screen\.active\) footer\s*\{\s*display:\s*none/);
});

test("secured loot and expedition record move into a local-scroll folio", () => {
  assert.match(shell, /const inventory = hubGrid\?\.querySelector\("\.inventory-panel"\)/);
  assert.match(shell, /const chronicle = hubGrid\?\.querySelector\("\.chronicle"\)/);
  assert.match(shell, /body\.append\(inventory, chronicle\)/);
  assert.match(shell, /hubGrid\.remove\(\)/);
  assert.match(css, /\.hearth-folio__pane \.loot-list[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.hearth-folio__pane\.chronicle[\s\S]*?overflow-y:\s*auto/);
});

test("room objects open the folio and keyboard users can leave it", () => {
  assert.match(shell, /lootShelf\?\.addEventListener\("click", \(\) => open\("loot", lootShelf\)\)/);
  assert.match(shell, /journal\.addEventListener\("click", \(\) => open\("record", journal\)\)/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /returnFocus\.focus\(\)/);
  assert.match(shell, /event\.key !== "Tab"/);
});

test("Hearth presentation installs the follow-up shell without changing save or game systems", () => {
  assert.match(presentation, /ensureStylesheet\("hearth-home-shell\.css"\)/);
  assert.match(presentation, /ensureScript\("src\/hearth-home-shell\.js"\)/);
  assert.doesNotMatch(shell, /localStorage|saveSafeState|saveRunState|CrownlessExpeditionCore/);
});
