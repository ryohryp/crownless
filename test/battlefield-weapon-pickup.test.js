const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");

test("defeated enemies drop battlefield weapons", () => {
  assert.match(app, /function dropEnemyWeapon/);
  assert.match(app, /dropEnemyWeapon\(enemy\)/);
  assert.match(app, /enemy\.kind === "guard".*type: "sword"/s);
  assert.match(app, /enemy\.kind === "skirmisher".*type: "dagger"/s);
});

test("touching a dropped weapon picks it up without a stationary hold", () => {
  assert.match(app, /function updateBattlefieldPickup\(\)/);
  assert.match(app, /dist\(drop, p\) <= 64/);
  assert.doesNotMatch(app, /target\.pickup \+= dt/);
  assert.doesNotMatch(app, /target\.pickup >= 0\.18/);
  assert.match(app, /const pickedWeapon = updateBattlefieldPickup\(\)/);
  assert.match(app, /if \(!p\.moving && !pickedWeapon\) updateAutoStrike\(\)/);
});

test("battlefield weapons only replace combat tuning", () => {
  assert.match(app, /battle\.tuning = battlefieldWeaponTuning\(drop\.type\)/);
  assert.match(app, /battle\.heldBattlefieldWeapon =/);
  assert.match(app, /baseTuning: \{ \.\.\.tuning \}/);
  const pickupBlock = app.slice(app.indexOf("function equipBattlefieldWeapon"), app.indexOf("function updateBattlefieldPickup"));
  assert.doesNotMatch(pickupBlock, /Core\.equipItem|state\.equippedItemId|securedLoot/);
});

test("the last kill leaves a short chance to cross a dropped weapon", () => {
  assert.match(app, /function beginVictoryPickupWindow/);
  assert.match(app, /battle\.victoryPickupTimer = unpicked\.length \? 0\.7 : 0\.35/);
  assert.match(app, /battle\.enemies\.every\(\(enemy\) => enemy\.hp <= 0\)\) beginVictoryPickupWindow\(\)/);
  assert.match(app, /if \(battle\.victoryPickupTimer <= 0\) \{\s*finishVictory\(\)/s);
});

test("dropped weapons are visible and explain touch pickup", () => {
  assert.match(app, /function drawDroppedWeapon/);
  assert.match(app, /触れれば拾う/);
  assert.match(app, /武器に触れる <b>PICK UP<\/b>/);
  assert.match(app, /battle\.droppedWeapons\.filter\(\(drop\) => !drop\.picked\)\.forEach\(drawDroppedWeapon\)/);
});
