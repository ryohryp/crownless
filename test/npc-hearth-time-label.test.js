const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");

test("Hearth time-of-day labels follow deterministic daypart boundaries", () => {
  assert.equal(NpcLife.timeOfDayLabel(0), "深夜");
  assert.equal(NpcLife.timeOfDayLabel(5), "深夜");
  assert.equal(NpcLife.timeOfDayLabel(6), "朝");
  assert.equal(NpcLife.timeOfDayLabel(9), "朝");
  assert.equal(NpcLife.timeOfDayLabel(10), "昼");
  assert.equal(NpcLife.timeOfDayLabel(16), "昼");
  assert.equal(NpcLife.timeOfDayLabel(17), "夕暮れ");
  assert.equal(NpcLife.timeOfDayLabel(20), "夕暮れ");
  assert.equal(NpcLife.timeOfDayLabel(21), "夜");
  assert.equal(NpcLife.timeOfDayLabel(23), "夜");
});

test("Hearth status includes the current daypart without exposing away locations", () => {
  const morning = NpcLife.formatHearthStatus(NpcLife.snapshotAt(7));
  const midday = NpcLife.formatHearthStatus(NpcLife.snapshotAt(11));
  const evening = NpcLife.formatHearthStatus(NpcLife.snapshotAt(18));

  assert.match(morning, /^朝の炉端 — /);
  assert.match(midday, /^昼の炉端 — /);
  assert.match(evening, /^夕暮れの炉端 — /);
  assert.doesNotMatch(morning, /エドガー→工房|ミラ→薬草畑/);
  assert.doesNotMatch(evening, /エドガー→工房|マルコ→市場/);
});

test("snapshots carry normalized hour for presentation without changing NPC state rules", () => {
  const snapshot = NpcLife.snapshotAt(25);
  assert.ok(snapshot.every((resident) => resident.hour === 1));
  assert.equal(snapshot.find((resident) => resident.id === "marco").state, NpcLife.STATES.NORMAL);
});