const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");

test("Grey Hearth shows absence without revealing routine off-screen locations", () => {
  const morning = NpcLife.formatHearthStatus(NpcLife.snapshotAt(7));
  const afternoon = NpcLife.formatHearthStatus(NpcLife.snapshotAt(15));

  assert.match(morning, /マルコ（行商人）/);
  assert.match(morning, /エドガー（不在）/);
  assert.match(morning, /ミラ（不在）/);
  assert.doesNotMatch(morning, /工房|薬草畑/);

  assert.match(afternoon, /不在:/);
  assert.doesNotMatch(afternoon, /工房|市場|川辺|酒場|自宅|宿/);
});

test("Marco's exact route is disclosed by the existing rumor and lead, not the generic absence list", () => {
  const midday = NpcLife.formatHearthStatus(NpcLife.snapshotAt(11));

  assert.match(midday, /ミラ（薬師）/);
  assert.match(midday, /マルコ（不在・旅の途中）/);
  assert.match(midday, /ミラ「マルコなら北の街道へ向かったよ。帰りに薬瓶を運んでくれるって。」/);
  assert.match(midday, /探索の手がかり: 北の街道/);
  assert.doesNotMatch(midday, /マルコ→北の街道/);
});

test("NPC schedule and reunion logic still keep precise locations internally", () => {
  const midday = NpcLife.snapshotAt(11);
  const marco = midday.find((resident) => resident.id === "marco");
  const known = {
    "sim:north-road-ford": {
      key: "sim:north-road-ford",
      name: "北の街道の古い渡し場",
      location: "north-road",
      state: "discovered"
    }
  };

  assert.equal(marco.location, NpcLife.LOCATIONS.ROAD);
  assert.equal(marco.state, NpcLife.STATES.TRAVELING);
  assert.equal(NpcLife.reunionCandidates(midday, known).length, 1);
});
