const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const profiles = fs.readFileSync(path.join(__dirname, "..", "src", "combat-action-profiles.js"), "utf8");

test("main combat removes auto pathing and uses player movement intent", () => {
  assert.doesNotMatch(app, /function updateAutoPilot/);
  assert.match(app, /function updatePlayerIntent/);
  assert.match(app, /combatInputVector/);
  assert.match(app, /p\.moving = magnitude > 0\.08/);
  assert.match(app, /p\.stationary = 0/);
});

test("standing still gates automatic normal attacks", () => {
  assert.match(app, /function updateAutoStrike/);
  assert.match(app, /p\.stationary < profile\.settle/);
  assert.ok(app.includes("if (d > profile.range + target.radius) return;"));
  assert.match(app, /performLight\(\)/);
});

test("fists dagger and sword create different stop rhythms", () => {
  assert.match(app, /CombatActionProfiles\.normalAttackProfile\(battle \? battle\.tuning : null\)/);
  assert.match(profiles, /dagger:.*comboLength: 6/s);
  assert.match(profiles, /sword:.*comboLength: 3.*arc: -0\.16/s);
  assert.match(profiles, /fists:.*comboLength: 4/s);
});

test("enemy ranged telegraphs lock their aim before release", () => {
  assert.match(app, /enemy\.aimX = p\.x/);
  assert.match(app, /enemy\.aimDirX = aim\.x/);
  assert.match(app, /Number\.isFinite\(enemy\.aimDirX\)/);
});

test("main combat supports keyboard and drag movement", () => {
  assert.match(app, /KeyW/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /canvas\.addEventListener\("pointerdown"/);
  assert.match(app, /canvas\.addEventListener\("pointermove"/);
  assert.match(app, /停止 <b>AUTO STRIKE<\/b>/);
});
