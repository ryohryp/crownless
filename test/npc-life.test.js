const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NpcLife = require("../src/npc-life.js");

const root = path.join(__dirname, "..");
const hearthPresentation = fs.readFileSync(path.join(root, "src", "hearth-presentation.js"), "utf8");

test("NPC life MVP defines three named residents without persistent simulation", () => {
  assert.equal(NpcLife.RESIDENTS.length, 3);
  assert.deepEqual(NpcLife.RESIDENTS.map((resident) => resident.name), ["エドガー", "マルコ", "ミラ"]);
  for (const resident of NpcLife.RESIDENTS) {
    assert.ok(resident.role);
    assert.ok(resident.schedule.length >= 4);
  }
});

test("daily schedules are deterministic and change locations across the day", () => {
  const morning = NpcLife.snapshotAt(7);
  const afternoon = NpcLife.snapshotAt(15);
  const repeatedMorning = NpcLife.snapshotAt(7);

  assert.deepEqual(morning, repeatedMorning);
  const changed = morning.filter((resident, index) => resident.location !== afternoon[index].location);
  assert.ok(changed.length >= 2);
});

test("schedule boundaries resolve lazily from the supplied hour", () => {
  const edgar = NpcLife.RESIDENTS.find((resident) => resident.id === "edgar");
  const marco = NpcLife.RESIDENTS.find((resident) => resident.id === "marco");
  const mira = NpcLife.RESIDENTS.find((resident) => resident.id === "mira");

  assert.equal(NpcLife.locationAtHour(edgar, 5), NpcLife.LOCATIONS.HOME);
  assert.equal(NpcLife.locationAtHour(edgar, 6), NpcLife.LOCATIONS.FORGE);
  assert.equal(NpcLife.locationAtHour(marco, 6), NpcLife.LOCATIONS.HEARTH);
  assert.equal(NpcLife.locationAtHour(marco, 9), NpcLife.LOCATIONS.ROAD);
  assert.equal(NpcLife.locationAtHour(mira, 17), NpcLife.LOCATIONS.RIVERBANK);
  assert.equal(NpcLife.locationAtHour(mira, 18), NpcLife.LOCATIONS.HEARTH);
});

test("Marco becomes TRAVELING only while his schedule places him on the north road", () => {
  const marco = NpcLife.RESIDENTS.find((resident) => resident.id === "marco");

  assert.equal(NpcLife.stateAtHour(marco, 8), NpcLife.STATES.NORMAL);
  assert.equal(NpcLife.stateAtHour(marco, 9), NpcLife.STATES.TRAVELING);
  assert.equal(NpcLife.stateAtHour(marco, 13), NpcLife.STATES.TRAVELING);
  assert.equal(NpcLife.stateAtHour(marco, 14), NpcLife.STATES.NORMAL);

  const first = NpcLife.snapshotAt(11).find((resident) => resident.id === "marco");
  const repeated = NpcLife.snapshotAt(11).find((resident) => resident.id === "marco");
  assert.deepEqual(first, repeated);
  assert.equal(first.state, NpcLife.STATES.TRAVELING);
  assert.equal(first.stateLabel, "旅の途中");
});

test("other residents remain NORMAL in the first state-transition slice", () => {
  const snapshots = [7, 11, 20].flatMap((hour) => NpcLife.snapshotAt(hour));
  const others = snapshots.filter((resident) => resident.id !== "marco");
  assert.ok(others.length > 0);
  assert.ok(others.every((resident) => resident.state === NpcLife.STATES.NORMAL));
});

test("Mira's relationship line reacts deterministically to Marco traveling while she is at the Hearth", () => {
  assert.equal(NpcLife.RELATIONSHIPS.length, 1);
  assert.equal(NpcLife.RELATIONSHIPS[0].sourceId, "mira");
  assert.equal(NpcLife.RELATIONSHIPS[0].targetId, "marco");

  const beforeTravel = NpcLife.relationshipLines(NpcLife.snapshotAt(8));
  const duringTravel = NpcLife.relationshipLines(NpcLife.snapshotAt(11));
  const repeated = NpcLife.relationshipLines(NpcLife.snapshotAt(11));
  const afterTravel = NpcLife.relationshipLines(NpcLife.snapshotAt(15));

  assert.deepEqual(duringTravel, repeated);
  assert.equal(beforeTravel.length, 0);
  assert.equal(afterTravel.length, 0);
  assert.equal(duringTravel.length, 1);
  assert.equal(duringTravel[0].speakerName, "ミラ");
  assert.equal(duringTravel[0].targetId, "marco");
  assert.match(duringTravel[0].text, /マルコ/);
  assert.match(duringTravel[0].text, /北の街道/);
});

test("relationship rumor becomes a deterministic exploration lead only during Marco's road travel", () => {
  const beforeTravel = NpcLife.explorationLeads(NpcLife.snapshotAt(8));
  const duringTravel = NpcLife.explorationLeads(NpcLife.snapshotAt(11));
  const repeated = NpcLife.explorationLeads(NpcLife.snapshotAt(11));
  const afterTravel = NpcLife.explorationLeads(NpcLife.snapshotAt(15));

  assert.equal(beforeTravel.length, 0);
  assert.equal(afterTravel.length, 0);
  assert.deepEqual(duringTravel, repeated);
  assert.equal(duringTravel.length, 1);
  assert.equal(duringTravel[0].location, "north-road");
  assert.equal(duringTravel[0].locationLabel, "北の街道");
  assert.equal(duringTravel[0].targetId, "marco");
  assert.match(duringTravel[0].reason, /マルコ/);
  assert.equal(Object.hasOwn(duringTravel[0], "latitude"), false);
  assert.equal(Object.hasOwn(duringTravel[0], "longitude"), false);
});

test("known north-road discoveries become deterministic Marco reunion candidates", () => {
  const known = {
    "sim:north-road-ford": {
      key: "sim:north-road-ford",
      name: "北の街道の古い渡し場",
      location: "north-road",
      state: "discovered"
    },
    "sim:ruined-chapel": {
      key: "sim:ruined-chapel",
      name: "崩れた礼拝堂",
      location: "old-hill",
      state: "discovered"
    }
  };

  const first = NpcLife.reunionCandidates(NpcLife.snapshotAt(11), known);
  const repeated = NpcLife.reunionCandidates(NpcLife.snapshotAt(11), known);

  assert.deepEqual(first, repeated);
  assert.equal(first.length, 1);
  assert.equal(first[0].targetId, "marco");
  assert.equal(first[0].targetName, "マルコ");
  assert.equal(first[0].location, "north-road");
  assert.equal(first[0].discoveryKey, "sim:north-road-ford");
  assert.equal(first[0].destinationName, "北の街道の古い渡し場");
  assert.match(first[0].reason, /再会/);
  assert.equal(Object.hasOwn(first[0], "latitude"), false);
  assert.equal(Object.hasOwn(first[0], "longitude"), false);
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
  assert.doesNotMatch(hearthPresentation, /setInterval\(/);
});
