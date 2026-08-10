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

test("picking a weapon reuses the stand-to-strike stop decision", () => {
  assert.match(app, /function updateBattlefieldPickup\(dt\)/);
  assert.match(app, /dist\(drop, p\) <= 48/);
  assert.match(app, /target\.pickup \+= dt/);
  assert.match(app, /target\.pickup >= 0\.18/);
  assert.match(app, /if \(!updateBattlefieldPickup\(dt\)\) updateAutoStrike\(\)/);
});

test("battlefield weapons only replace combat tuning", () => {
  assert.match(app, /battle\.tuning = battlefieldWeaponTuning\(drop\.type\)/);
  assert.match(app, /battle\.heldBattlefieldWeapon =/);
  assert.match(app, /baseTuning: \{ \.\.\.tuning \}/);
  const pickupBlock = app.slice(app.indexOf("function equipBattlefieldWeapon"), app.indexOf("function updateBattlefieldPickup"));
  assert.doesNotMatch(pickupBlock, /Core\.equipItem|state\.equippedItemId|securedLoot/);
});

test("the last kill leaves time to grab a dropped weapon", () => {
  assert.match(app, /function beginVictoryPickupWindow/);
  assert.match(app, /battle\.victoryPickupTimer = unpicked\.length \? 1\.6 : 0\.35/);
  assert.match(app, /battle\.enemies\.every\(\(enemy\) => enemy\.hp <= 0\)\) beginVictoryPickupWindow\(\)/);
  assert.match(app, /if \(battle\.victoryPickupTimer <= 0\) \{\s*finishVictory\(\)/s);
});

test("dropped weapons are visible and explain how to pick them up", () => {
  assert.match(app, /function drawDroppedWeapon/);
  assert.match(app, /止まって拾う/);
  assert.match(app, /武器の上で停止 <b>PICK UP<\/b>/);
  assert.match(app, /battle\.droppedWeapons\.filter\(\(drop\) => !drop\.picked\)\.forEach\(drawDroppedWeapon\)/);
});
