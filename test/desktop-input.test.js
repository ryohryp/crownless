const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const input = fs.readFileSync(path.join(root, "src", "desktop-input.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("desktop input layer loads after exploration map presentation", () => {
  const map = index.indexOf('src/exploration-map-presentation.js');
  const desktop = index.indexOf('src/desktop-input.js');
  assert.ok(map >= 0);
  assert.ok(desktop > map);
});

test("desktop non-combat flow supports WASD arrows and Enter", () => {
  assert.match(input, /\["KeyW", \{ x: 0, y: -1 \}\]/);
  assert.match(input, /\["KeyA", \{ x: -1, y: 0 \}\]/);
  assert.match(input, /\["KeyS", \{ x: 0, y: 1 \}\]/);
  assert.match(input, /\["KeyD", \{ x: 1, y: 0 \}\]/);
  assert.match(input, /\["ArrowUp", \{ x: 0, y: -1 \}\]/);
  assert.match(input, /event\.code === "Enter"/);
  assert.match(input, /target\.click\(\)/);
});

test("live combat keeps the existing combat keyboard handler", () => {
  assert.match(input, /const liveCombat = screen && screen\.id === "combat-screen" && !overlay;/);
  assert.match(input, /if \(liveCombat\) return;/);
});

test("combat overlays are intercepted for keyboard-only decisions", () => {
  assert.match(input, /document\.querySelector\("\.loot-reveal\.show"\)/);
  assert.match(input, /#loot-reveal-items button:not\(:disabled\)/);
  assert.match(input, /event\.stopImmediatePropagation\(\)/);
});

test("exploration defaults to contextual map actions before the current cell", () => {
  const explore = input.slice(input.indexOf('screen.id === "explore-screen"'), input.indexOf('screen.id === "decision-screen"'));
  const investigate = explore.indexOf('document.getElementById("map-investigate")');
  const travel = explore.indexOf('document.getElementById("map-travel")');
  const current = explore.indexOf('button.exploration-map-cell.current');
  assert.ok(investigate >= 0);
  assert.ok(travel > investigate);
  assert.ok(current > travel);
});
