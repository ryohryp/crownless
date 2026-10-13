"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const field = require("../src/expedition-field.js");

const treasureSide = () => ({
  ...field.initial(),
  pos: field.TREASURE,
  // The previously discovered bit can exist in a save before the player
  // actually uncovers the vines. That must not leak the secret on the map.
  seen: 2 ** field.TREASURE + 2 ** field.SECRET,
});

test("forest secret stays under fog even with its seen bit set", () => {
  const before = treasureSide();
  assert.equal(field.valid(before), true);
  assert.equal(field.visible(before, field.SECRET), false);
  assert.equal(field.canMove(before, field.SECRET), false);
  assert.equal(field.move(before, field.SECRET), null);

  const discovered = field.uncover(before, field.SECRET);
  assert.ok(discovered);
  assert.equal(discovered.pos, field.TREASURE, "uncovering is not movement");
  assert.equal(field.visible(discovered, field.SECRET), true);
  assert.equal(field.canMove(discovered, field.SECRET), true);
  const entered = field.move(discovered, field.SECRET);
  assert.equal(entered.pos, field.SECRET);
  assert.equal(field.valid(entered), true);
});

test("the discovered passage remains visible after a current-save roundtrip", () => {
  const discovered = field.uncover(treasureSide(), field.SECRET);
  const restored = JSON.parse(JSON.stringify(discovered));
  assert.equal(field.valid(restored), true);
  assert.equal(field.visible(restored, field.SECRET), true);
  assert.equal(field.move(restored, field.SECRET).pos, field.SECRET);
});
