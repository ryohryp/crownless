const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findBrokenSpear,
  useImprovisedWeapon,
  discardOnReturn,
  describe,
} = require("../src/expedition-improvised-weapon");

test("broken spear is a readable expedition-only choice", () => {
  const weapon = findBrokenSpear({ kind: "battlefield-remains" });
  assert.equal(weapon.usesLeft, 3);
  assert.match(describe(weapon), /残り3回/);
  assert.match(describe(weapon), /獣に強い/);
  assert.match(describe(weapon), /帰還時に失う/);
});

test("broken spear rewards choosing it against beasts and breaks after three uses", () => {
  let weapon = findBrokenSpear({ kind: "battlefield-remains" });
  let result = useImprovisedWeapon(weapon, { kind: "soldier" });
  assert.equal(result.bonusDamage, 0);
  weapon = result.weapon;

  result = useImprovisedWeapon(weapon, { kind: "beast" });
  assert.equal(result.bonusDamage, 2);
  weapon = result.weapon;

  result = useImprovisedWeapon(weapon, { kind: "beast" });
  assert.equal(result.bonusDamage, 2);
  assert.equal(result.broke, true);
  assert.equal(result.weapon, null);
});

test("temporary weapon never becomes return-alive inventory", () => {
  const weapon = findBrokenSpear({ kind: "battlefield-remains" });
  assert.equal(discardOnReturn(weapon), null);
  assert.equal(findBrokenSpear({ kind: "ordinary-road" }), null);
});
