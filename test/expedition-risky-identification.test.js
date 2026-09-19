const test = require("node:test");
const assert = require("node:assert/strict");
const risky = require("../src/expedition-risky-identification.js");

test("unknown loot presents a readable field-test versus safe-return choice", () => {
  const item = risky.createUnknownLoot();
  const choice = risky.describeChoice(item);
  assert.equal(item.identified, false);
  assert.equal(choice.choices.length, 2);
  assert.match(choice.choices[0].consequence, /次の戦闘/);
  assert.match(choice.choices[1].consequence, /帰還/);
});

test("field testing reveals the trait only after combat", () => {
  const item = risky.choose(risky.createUnknownLoot(), "field-test");
  assert.equal(item.identified, false);
  assert.equal(item.decision, "field-test");
  assert.equal(risky.describeChoice(item).selected, "field-test");
  const revealed = risky.revealAfterCombat(item);
  assert.equal(revealed.identified, true);
  assert.equal(revealed.trait, "beast-edge");
  assert.equal(risky.traitBonus(revealed, ["beast"]), 2);
  assert.equal(risky.traitBonus(revealed, ["undead"]), 0);
});

test("carrying home reveals the same trait without field testing", () => {
  const item = risky.choose(risky.createUnknownLoot(), "carry-home");
  assert.equal(item.decision, "carry-home");
  assert.equal(risky.describeChoice(item).selected, "carry-home");
  assert.equal(risky.revealAfterCombat(item).identified, false);
  const appraised = risky.appraiseOnSafeReturn(item);
  assert.equal(appraised.identified, true);
  assert.equal(appraised.trait, "beast-edge");
});

test("known loot no longer asks for identification choice", () => {
  const known = risky.appraiseOnSafeReturn(risky.createUnknownLoot());
  assert.equal(risky.describeChoice(known), null);
});


test("legacy field-tested loot still renders as a selected field test", () => {
  const legacy = { id: risky.UNKNOWN_RELIC.id, name: risky.UNKNOWN_RELIC.name, identified: false, fieldTested: true };
  assert.equal(risky.describeChoice(legacy).selected, "field-test");
});

test("unknown choice does not silently change the decision", () => {
  const item = risky.createUnknownLoot();
  assert.equal(risky.choose(item, "invalid"), item);
});
