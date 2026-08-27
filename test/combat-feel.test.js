const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const profileSource = fs.readFileSync(path.join(__dirname, "..", "src", "combat-action-profiles.js"), "utf8");

test("stop-to-strike starts sooner across weapon profiles", () => {
  assert.match(source, /CombatActionProfiles\.normalAttackProfile\(battle \? battle\.tuning : null\)/);
  assert.match(profileSource, /dagger:.*settle: 0\.06.*duration: 0\.17.*activeAt: 0\.046/s);
  assert.match(profileSource, /sword:.*settle: 0\.14.*duration: 0\.39.*activeAt: 0\.145/s);
  assert.match(profileSource, /fists:.*settle: 0\.085.*duration: 0\.215.*activeAt: 0\.06/s);
});

test("impact feedback keeps clear normal finisher technique hierarchy", () => {
  assert.match(source, /counter \? 0\.14 : 0\.105/);
  assert.match(source, /finisher \? 0\.082 : 0\.052/);
  assert.match(source, /counter \? 14 : 11/);
  assert.match(source, /finisher \? 8 : 4/);
  assert.match(source, /battle\.hitStop = 0\.035/);
});

test("ordinary hits create more visible space without turning every hit into a launch", () => {
  assert.match(source, /technique \? 0\.44 \* staggerScale : finisher \? 0\.32 : 0\.16/);
  assert.match(source, /technique \? 54 \* staggerScale \* \(attack\.knockMultiplier \|\| 1\) : finisher \? 44 : 18/);
  assert.match(source, /enemy\.vx \+= toEnemy\.x \* knock \* 3\.2/);
  assert.match(source, /enemy\.vy \+= toEnemy\.y \* knock \* 3\.2/);
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
