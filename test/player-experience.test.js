const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const Core = require("../src/game-core.js");
const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("edge is deterministic, bounded, and only readies at the maximum", () => {
  assert.equal(Core.nextEdge(0, 28), 28);
  assert.equal(Core.nextEdge(92, 20), Core.EDGE_MAX);
  assert.equal(Core.nextEdge(20, -99), 0);
  assert.equal(Core.edgeTechnique(99).ready, false);
  assert.equal(Core.edgeTechnique(100).ready, true);
});

test("a ready edge technique is a faster high-impact commitment", () => {
  const ordinary = Core.edgeTechnique(60);
  const ready = Core.edgeTechnique(100);

  assert.equal(ordinary.damageMultiplier, 1);
  assert.equal(ordinary.cooldown, null);
  assert.ok(ready.damageMultiplier > ordinary.damageMultiplier);
  assert.ok(ready.staggerMultiplier > ordinary.staggerMultiplier);
  assert.ok(ready.cooldown > 0);
});

test("the playable page exposes route, edge, sound, and return feedback", () => {
  for (const id of ["expedition-route", "edge-bar", "edge-text", "sound-toggle", "return-screen", "return-again"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(app, /renderRoute\(exp\)/);
  assert.match(app, /renderReturn\(report\)/);
  assert.match(app, /gainEdge\(28\)/);
  assert.match(app, /CROWNLESS — 決着打/);
});

test("the initial mobile controls match the two-decision combat model", () => {
  assert.match(html, /MOVE \+ ATTACK/);
  assert.match(html, /id="touch-evade"/);
  assert.match(html, /id="touch-heavy"/);
  assert.doesNotMatch(html, /class="dpad"/);
  assert.doesNotMatch(html, /id="touch-light"/);
});
