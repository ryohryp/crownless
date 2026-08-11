const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "combat-lab.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "combat-lab.js"), "utf8");

test("combat lab keeps the stop-to-strike loop", () => {
  assert.match(html, /BAIT → MOVE → STOP → PUNISH/);
  assert.match(html, /STOP<\/b> 自動攻撃/);
  assert.match(app, /resetAttackCommitment\(\)/);
  assert.match(app, /p\.stationary < profile\.settle/);
});

test("archer and brute telegraphs lock their aim before the player moves", () => {
  assert.match(app, /e\.aimX = game\.player\.x;/);
  assert.match(app, /e\.aimY = game\.player\.y;/);
  assert.match(app, /const locked = normal\(e\.aimX - e\.x, e\.aimY - e\.y\)/);
  assert.match(app, /game\.projectiles\.push\(\{ x: e\.x, y: e\.y, vx: locked\.x/);
  assert.match(app, /e\.dashX = locked\.x; e\.dashY = locked\.y/);
});

test("fists dagger and sword create different stand-to-strike rhythms", () => {
  assert.match(app, /fists: \{/);
  assert.match(app, /dagger: \{/);
  assert.match(app, /sword: \{/);
  assert.match(app, /combo === 4 \? 22/);
  assert.match(app, /combo === 6 \? 17/);
  assert.match(app, /profile\.cleave/);
  assert.match(html, /data-weapon="fists"/);
  assert.match(html, /data-weapon="dagger"/);
  assert.match(html, /data-weapon="sword"/);
});

test("weapon switching works on keyboard and touch UI", () => {
  assert.match(app, /Digit1/);
  assert.match(app, /Digit2/);
  assert.match(app, /Digit3/);
  assert.match(app, /querySelectorAll\("\[data-weapon\]"\)/);
});

test("combat still exposes melee ranged and charge pressures", () => {
  assert.match(app, /kind === "archer"/);
  assert.match(app, /kind === "brute"/);
  assert.match(app, /"shot"/);
  assert.match(app, /"charge"/);
  assert.match(app, /"slash"/);
});
