"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/slice-engine");
const C = require("../src/loot-comparison");
const fs = require("node:fs");
const path = require("node:path");

const variantsByFamily = {
  fang: ["fang_blood", "fang_moon"],
  shield: ["shield_thorn", "shield_oath"],
  bow: ["bow_hunter", "bow_recurve"],
};

function deepGuardianState(place = "wood") {
  const s = E.initial();
  s.mode = "demo";
  s.runs = 1;
  s.expedition = {
    place,
    depth: 2,
    room: 4,
    hp: E.maxHp(s),
    stamina: 3,
    focus: 0,
    potions: 2,
    scrap: 0,
    gear: [],
    seals: [],
    enemy: {
      kind: E.place(place).enemy,
      hp: 1,
      maxHp: 27,
      turn: 0,
      depth: 2,
      elite: true,
      risky: false,
    },
    stage: "fight",
    log: [],
  };
  return s;
}

test("loot hunt has two handcrafted variants for three weapon families", () => {
  for (const [family, ids] of Object.entries(variantsByFamily)) {
    assert.equal(ids.length, 2);
    for (const id of ids) {
      assert.equal(E.gearFamily(id), family);
      assert.ok(E.GEAR[id]);
      assert.notEqual(E.GEAR[id].trait, E.GEAR[family]?.trait);
    }
  }

  assert.deepEqual(E.VARIANT_LOOT.wood, variantsByFamily.fang);
  assert.deepEqual(E.VARIANT_LOOT.tower, variantsByFamily.shield);
  assert.deepEqual(E.VARIANT_LOOT.fen, variantsByFamily.bow);
});

test("same-family variants change combat behavior instead of only gear score", () => {
  const s = E.initial();

  const blood = E.combatProfile(s, "fang_blood");
  const moon = E.combatProfile(s, "fang_moon");
  assert.equal(blood.lowHpBonus, 2);
  assert.equal(moon.dodgeCost, 0);

  const thorn = E.combatProfile(s, "shield_thorn");
  const oath = E.combatProfile(s, "shield_oath");
  assert.ok(thorn.counter > oath.counter);
  assert.ok(oath.block > thorn.block);

  const hunter = E.combatProfile(s, "bow_hunter");
  const recurve = E.combatProfile(s, "bow_recurve");
  assert.equal(hunter.openBonus, 3);
  assert.equal(recurve.heavyCost, 1);
  assert.equal(recurve.pierce, false);
});

test("depth 2 guardian can drop a variant that remains at risk until safe return", () => {
  const s = deepGuardianState("wood");
  const afterWin = E.act(s, "strike");

  assert.equal(afterWin.expedition.stage, "cleared");
  assert.equal(afterWin.expedition.gear.length, 1);
  const found = afterWin.expedition.gear[0];
  assert.ok(E.VARIANT_LOOT.wood.includes(found));
  assert.equal(afterWin.owned.includes(found), false);

  const returned = E.act(afterWin, "return");
  assert.equal(returned.expedition, null);
  assert.equal(returned.owned.includes(found), true);
  assert.ok(returned.report.newGear.includes(found));
});

test("returned variant and its reinforcement survive save/load", () => {
  let s = deepGuardianState("wood");
  s = E.act(s, "strike");
  const found = s.expedition.gear[0];
  s = E.act(s, "return");
  s.scrap = 100;
  s = E.upgrade(s, found);

  const restored = E.parse(E.serialize(s));
  assert.ok(restored);
  assert.ok(restored.owned.includes(found));
  assert.equal(E.weaponLevel(restored, found), 1);
});

test("loot cue hides the exact item while comparison explains the tactical difference", () => {
  const cue = E.lootCue("wood", 2);
  for (const id of E.VARIANT_LOOT.wood) {
    assert.equal(cue.includes(E.GEAR[id].name), false);
  }

  const s = E.initial();
  const comparison = C.compare("fang", "fang_moon", E, s);
  assert.ok(comparison);
  assert.ok(comparison.rows.length <= 3);
  assert.ok(comparison.rows.some(row => /気力消費 0/.test(row.value)));
  assert.ok(comparison.rows.some(row => /生還/.test(row.value)));
});

test("playable slice loads compact loot comparison UI", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "expedition.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "loot-comparison.css"), "utf8");

  assert.match(html, /src\/loot-comparison\.js/);
  assert.match(html, /src\/loot-comparison-ui\.js/);
  assert.match(html, /loot-comparison\.css/);
  assert.match(css, /\.loot-comparison-rows/);
  assert.doesNotMatch(css, /min-width\s*:\s*\d{3,}px/);
});


test("loot comparison UI reads the explicit equipped gear marker", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "slice-app.js"), "utf8");
  const ui = fs.readFileSync(path.join(__dirname, "..", "src", "loot-comparison-ui.js"), "utf8");

  assert.match(app, /data-current-gear-id=/);
  assert.match(app, /data-found-gear-id=/);
  assert.match(ui, /querySelector\('\[data-current-gear-id\]'\)/);
  assert.match(ui, /querySelector\('\[data-found-gear-id\]'\)/);
  assert.doesNotMatch(ui, /ledger\.querySelector\('small'\)/);
  assert.doesNotMatch(ui, /textContent\.trim\(\)/);
  assert.match(ui, /querySelector\('\.loot-comparison-moment'\)\) return/);
  assert.doesNotMatch(ui, /querySelectorAll\('\.loot-comparison-moment'\).*remove/);
  assert.match(ui, /ledger\.closest\('\.path-desktop-details'\) \|\| ledger/);
  assert.match(ui, /comparisonAnchor\.insertAdjacentHTML\('afterend'/);
});
