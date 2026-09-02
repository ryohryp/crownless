const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");

function residentAt(hour, id) {
  return NpcLife.snapshotAt(hour).find((resident) => resident.id === id);
}

test("Hearth residents expose small deterministic activities that change with time", () => {
  const morningMarco = residentAt(7, "marco");
  const middayMira = residentAt(11, "mira");
  const eveningMira = residentAt(20, "mira");

  assert.equal(morningMarco.atHearth, true);
  assert.equal(morningMarco.activity, "荷支度中");
  assert.equal(middayMira.atHearth, true);
  assert.equal(middayMira.activity, "薬瓶を整理中");
  assert.equal(eveningMira.atHearth, true);
  assert.equal(eveningMira.activity, "薬草を選り分け中");
  assert.notEqual(middayMira.activity, eveningMira.activity);
  assert.deepEqual(NpcLife.snapshotAt(11), NpcLife.snapshotAt(11));
});

test("Hearth status presents activities without leaking routine off-screen locations", () => {
  const morning = NpcLife.formatHearthStatus(NpcLife.snapshotAt(7));
  const midday = NpcLife.formatHearthStatus(NpcLife.snapshotAt(11));
  const evening = NpcLife.formatHearthStatus(NpcLife.snapshotAt(20));

  assert.match(morning, /マルコ（行商人）・荷支度中/);
  assert.match(midday, /ミラ（薬師）・薬瓶を整理中/);
  assert.match(evening, /ミラ（薬師）・薬草を選り分け中/);

  assert.doesNotMatch(morning, /エドガー→工房|ミラ→薬草畑/);
  assert.doesNotMatch(midday, /マルコ→北の街道/);
  assert.match(midday, /ミラ「マルコなら北の街道へ向かったよ。帰りに薬瓶を運んでくれるって。」/);
  assert.match(midday, /探索の手がかり: 北の街道/);
});

test("Hearth-only activities disappear when the same NPC is away", () => {
  const travelingMarco = residentAt(11, "marco");
  const riverbankMira = residentAt(15, "mira");

  assert.equal(travelingMarco.atHearth, false);
  assert.equal(travelingMarco.activity, "");
  assert.equal(travelingMarco.state, NpcLife.STATES.TRAVELING);
  assert.equal(riverbankMira.atHearth, false);
  assert.equal(riverbankMira.activity, "");
});
