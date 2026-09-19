const test = require("node:test");
const assert = require("node:assert/strict");
const Rumor = require("../src/campfire-rumor.js");

test("returns at most one short rumor related to the expedition place", () => {
  const rumor = Rumor.rumorFromReport({ place: "囁きの森", died: false, gear: [] });
  assert.equal(typeof rumor.text, "string");
  assert.match(rumor.text, /森|霧|金属音/);
  assert.equal(Array.isArray(rumor), false);
});

test("gear brought home points back toward a deeper loot hunt without promising a drop", () => {
  const rumor = Rumor.rumorFromReport({ place: "鐘なき塔", died: false, gear: ["古い盾"] });
  assert.match(rumor.text, /古い盾/);
  assert.match(rumor.text, /さらに奥/);
  assert.doesNotMatch(rumor.text, /必ず|確定/);
});

test("defeat creates a recovery-flavored clue instead of pretending the expedition succeeded", () => {
  const rumor = Rumor.rumorFromReport({ place: "灰冠の廟", died: true, gear: [] });
  assert.match(rumor.text, /逃げ帰った|失った/);
  assert.doesNotMatch(rumor.text, /生還した|持ち帰った/);
});

test("missing place does not create unrelated rumor noise", () => {
  assert.equal(Rumor.rumorFromReport({}), null);
});
