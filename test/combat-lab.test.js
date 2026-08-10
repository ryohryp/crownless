const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "combat-lab.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "combat-lab.js"), "utf8");

test("combat lab exposes stop-to-strike controls", () => {
  assert.match(html, /MOVE → STOP → STRIKE/);
  assert.match(html, /移動中は通常攻撃しない/);
  assert.match(html, /id="technique"/);
  assert.match(html, /id="evade"/);
});

test("movement cancels the normal attack and standing enables auto strike", () => {
  assert.match(app, /p\.stationary = 0;\s+p\.attackWindup = 0;\s+p\.attackTarget = null;/);
  assert.match(app, /p\.stationary < \.12/);
  assert.match(app, /nearestEnemy\(112\)/);
  assert.match(app, /hitEnemy\(locked, 20, 120\)/);
});

test("prototype has three readable enemy pressures", () => {
  assert.match(app, /kind === "archer"/);
  assert.match(app, /kind === "brute"/);
  assert.match(app, /"shot"/);
  assert.match(app, /"charge"/);
  assert.match(app, /"slash"/);
});

test("touch drag and keyboard movement are both supported", () => {
  assert.match(app, /pointerdown/);
  assert.match(app, /pointermove/);
  assert.match(app, /pointerup/);
  assert.match(app, /KeyW/);
  assert.match(app, /ArrowUp/);
});
