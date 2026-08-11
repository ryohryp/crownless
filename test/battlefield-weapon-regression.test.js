const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

test("battlefield weapons use touch pickup instead of stationary hold", () => {
  assert.match(app, /dist\(drop, p\) <= 64/);
  assert.doesNotMatch(app, /drop\.pickup \/ 0\.18/);
  assert.doesNotMatch(app, /止まって拾う/);
  assert.match(app, /触れれば拾う/);
});

test("battlefield weapon pickup is checked after player movement", () => {
  const clampY = app.indexOf("p.y = clamp(p.y, 92, canvas.height - 58);");
  const pickup = app.indexOf("const pickedWeapon = updateBattlefieldPickup();", clampY);
  const autoStrike = app.indexOf("if (!p.moving && !pickedWeapon) updateAutoStrike();", pickup);
  assert.ok(clampY >= 0);
  assert.ok(pickup > clampY);
  assert.ok(autoStrike > pickup);
});

test("combat camera is arena-centered so floor drops stay visually anchored", () => {
  assert.match(app, /const focusX = canvas\.width \/ 2;/);
  assert.match(app, /const focusY = canvas\.height \/ 2;/);
  assert.doesNotMatch(app, /battle\.player\.x \* 0\.52 \+ target\.x \* 0\.48/);
});
