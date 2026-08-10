const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

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
  assert.match(app, /weapon === "dagger"/);
  assert.match(app, /comboLength: 6/);
  assert.match(app, /weapon === "sword"/);
  assert.match(app, /comboLength: 3/);
  assert.match(app, /comboLength: 4/);
  assert.match(app, /arc: -0\.16/);
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
