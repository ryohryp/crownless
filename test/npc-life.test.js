const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NpcLife = require("../src/npc-life.js");

const hearthPresentation = fs.readFileSync(path.join(__dirname, "../src/hearth-presentation.js"), "utf8");

test("NPC life MVP defines three named residents without persistent simulation", () => {
  assert.equal(NpcLife.RESIDENTS.length, 3);
  assert.deepEqual(
    NpcLife.RESIDENTS.map((resident) => resident.name),
    ["エドガー", "マルコ", "ミラ"]
  );
  for (const resident of NpcLife.RESIDENTS) {
    assert.ok(resident.role);
    assert.ok(Array.isArray(resident.schedule));
    assert.ok(resident.schedule.length >= 4);
  }
});

test("daily schedules are deterministic and change locations across the day", () => {
  const edgar = NpcLife.RESIDENTS.find((resident) => resident.id === "edgar");
  assert.equal(NpcLife.locationAtHour(edgar, 7), NpcLife.LOCATIONS.FORGE);
  assert.equal(NpcLife.locationAtHour(edgar, 11), NpcLife.LOCATIONS.MARKET);
  assert.equal(NpcLife.locationAtHour(edgar, 15), NpcLife.LOCATIONS.FORGE);
  assert.equal(NpcLife.locationAtHour(edgar, 20), NpcLife.LOCATIONS.TAVERN);
  assert.equal(NpcLife.locationAtHour(edgar, 23), NpcLife.LOCATIONS.HOME);
});

test("schedule boundaries resolve lazily from the supplied hour", () => {
  const marco = NpcLife.RESIDENTS.find((resident) => resident.id === "marco");
  assert.equal(NpcLife.locationAtHour(marco, 5), NpcLife.LOCATIONS.INN);
  assert.equal(NpcLife.locationAtHour(marco, 6), NpcLife.LOCATIONS.HEARTH);
  assert.equal(NpcLife.locationAtHour(marco, 9), NpcLife.LOCATIONS.ROAD);
  assert.equal(NpcLife.locationAtHour(marco, 14), NpcLife.LOCATIONS.MARKET);
  assert.equal(NpcLife.locationAtHour(marco, 19), NpcLife.LOCATIONS.TAVERN);
  assert.equal(NpcLife.locationAtHour(marco, 23), NpcLife.LOCATIONS.INN);
});

test("Marco becomes TRAVELING only while his schedule places him on the north road", () => {
  const marco = NpcLife.RESIDENTS.find((resident) => resident.id === "marco");
  assert.equal(NpcLife.stateAtHour(marco, 8), NpcLife.STATES.NORMAL);
  assert.equal(NpcLife.stateAtHour(marco, 9), NpcLife.STATES.TRAVELING);
  assert.equal(NpcLife.stateAtHour(marco, 13), NpcLife.STATES.TRAVELING);
  assert.equal(NpcLife.stateAtHour(marco, 14), NpcLife.STATES.NORMAL);
});

test("other residents remain NORMAL in the first state-transition slice", () => {
  const edgar = NpcLife.RESIDENTS.find((resident) => resident.id === "edgar");
  const mira = NpcLife.RESIDENTS.find((resident) => resident.id === "mira");
  for (const hour of [0, 7, 11, 15, 20, 23]) {
    assert.equal(NpcLife.stateAtHour(edgar, hour), NpcLife.STATES.NORMAL);
    assert.equal(NpcLife.stateAtHour(mira, hour), NpcLife.STATES.NORMAL);
  }
});

test("Mira's relationship line reacts deterministically to Marco traveling while she is at the Hearth", () => {
  const morning = NpcLife.relationshipLines(NpcLife.snapshotAt(8));
  const midday = NpcLife.relationshipLines(NpcLife.snapshotAt(11));
  const afternoon = NpcLife.relationshipLines(NpcLife.snapshotAt(15));

  assert.deepEqual(morning, []);
  assert.equal(midday.length, 1);
  assert.equal(midday[0].speakerId, "mira");
  assert.equal(midday[0].targetId, "marco");
  assert.match(midday[0].text, /北の街道/);
  assert.deepEqual(afternoon, []);
});

test("relationship rumor becomes a deterministic exploration lead only during Marco's road travel", () => {
  const morning = NpcLife.explorationLeads(NpcLife.snapshotAt(8));
  const midday = NpcLife.explorationLeads(NpcLife.snapshotAt(11));
  const afternoon = NpcLife.explorationLeads(NpcLife.snapshotAt(15));

  assert.deepEqual(morning, []);
  assert.equal(midday.length, 1);
  assert.equal(midday[0].sourceId, "mira");
  assert.equal(midday[0].targetId, "marco");
  assert.equal(midday[0].location, NpcLife.LOCATIONS.ROAD);
  assert.equal(midday[0].locationLabel, "北の街道");
  assert.match(midday[0].reason, /マルコ/);
  assert.deepEqual(afternoon, []);
});

test("known north-road discoveries become deterministic Marco reunion candidates", () => {
  const known = {
    "sim:north-road-ford": {
      key: "sim:north-road-ford",
      name: "北の街道の古い渡し場",
      location: "north-road",
      state: "discovered"
    },
    "sim:chapel": {
      key: "sim:chapel",
      name: "崩れた礼拝堂",
      location: "old-hill",
      state: "discovered"
    }
  };
  const candidates = NpcLife.reunionCandidates(NpcLife.snapshotAt(11), known);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].targetId, "marco");
  assert.equal(candidates[0].discoveryKey, "sim:north-road-ford");
  assert.equal(candidates[0].destinationName, "北の街道の古い渡し場");
  assert.equal("latitude" in candidates[0], false);
  assert.equal("longitude" in candidates[0], false);
});

test("reunion candidates stay empty without a matching known place or outside travel time", () => {
  const unrelated = [{ key: "sim:chapel", name: "崩れた礼拝堂", location: "old-hill" }];
  const labelOnly = [{ key: "sim:road-marker", name: "北の街道・道標" }];

  assert.deepEqual(NpcLife.reunionCandidates(NpcLife.snapshotAt(11), unrelated), []);
  assert.equal(NpcLife.reunionCandidates(NpcLife.snapshotAt(11), labelOnly).length, 1);
  assert.deepEqual(NpcLife.reunionCandidates(NpcLife.snapshotAt(8), labelOnly), []);
  assert.deepEqual(NpcLife.reunionCandidates(NpcLife.snapshotAt(15), labelOnly), []);
  assert.deepEqual(NpcLife.reunionCandidates(NpcLife.snapshotAt(11), null), []);
});

test("Hearth status shows presence and absence while rumors disclose relevant travel details", () => {
  const morning = NpcLife.formatHearthStatus(NpcLife.snapshotAt(7));
  const midday = NpcLife.formatHearthStatus(NpcLife.snapshotAt(11));
  const afternoon = NpcLife.formatHearthStatus(NpcLife.snapshotAt(15));

  assert.match(morning, /マルコ（行商人）/);
  assert.match(morning, /エドガー（鍛冶屋・不在）/);
  assert.doesNotMatch(morning, /エドガー→工房/);
  assert.doesNotMatch(morning, /旅の途中/);
  assert.doesNotMatch(morning, /ミラ「/);
  assert.doesNotMatch(morning, /探索の手がかり/);

  assert.match(midday, /ミラ（薬師）/);
  assert.match(midday, /マルコ（行商人・不在・旅の途中）/);
  assert.doesNotMatch(midday, /マルコ→北の街道/);
  assert.match(midday, /ミラ「マルコなら北の街道へ向かったよ。帰りに薬瓶を運んでくれるって。」/);
  assert.match(midday, /探索の手がかり: 北の街道/);
  assert.match(midday, /旅の途中のマルコを追えば/);

  assert.match(afternoon, /不在:/);
  assert.doesNotMatch(afternoon, /エドガー→|マルコ→|ミラ→/);
  assert.doesNotMatch(afternoon, /ミラ「/);
  assert.doesNotMatch(afternoon, /探索の手がかり/);
});

test("Grey Hearth loads NPC life on demand and refreshes the existing room annotation", () => {
  assert.match(hearthPresentation, /ensureScript\("src\/npc-life\.js"/);
  assert.match(hearthPresentation, /scene\.querySelector\("\.hearth-room-note"\)/);
  assert.match(hearthPresentation, /NpcLife\.snapshotAt\(now\)/);
  assert.match(hearthPresentation, /NpcLife\.formatHearthStatus/);
  assert.match(hearthPresentation, /if \(residentNote\.textContent !== next\)/);
});
