const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

test("impact feedback emphasizes finishers and techniques", () => {
  assert.match(source, /counter \? 0\.13 : 0\.095/);
  assert.match(source, /finisher \? 0\.075 : 0\.045/);
  assert.match(source, /counter \? 13 : 10/);
  assert.match(source, /finisher \? 7 : 4/);
});

test("defeated enemies are visibly knocked down", () => {
  assert.match(source, /enemy\.deadTimer = 0\.9/);
  assert.match(source, /enemy\.vx \+= toEnemy\.x \* 230/);
  assert.match(source, /battle\.lastDown = \{ x: enemy\.x, y: enemy\.y \}/);
  assert.match(source, /down \? enemy\.strafeDir \* 1\.15 : 0/);
});

test("low-health enemies visibly falter", () => {
  assert.match(source, /hpRatio <= 0\.3/);
  assert.match(source, /const wobble = wounded/);
  assert.match(source, /woundedDrop/);
});

test("victory teases loot in the arena before the result overlay", () => {
  assert.match(source, /battle\.ending = true/);
  assert.match(source, /battle\.lootBeacon =/);
  assert.match(source, /function drawLootBeacon/);
  assert.match(source, /RARE DROP/);
  assert.match(source, /RELIC DROP/);
});
