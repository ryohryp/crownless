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

test("Hearth status tells the player who is present and where absent residents went", () => {
  const morning = NpcLife.formatHearthStatus(NpcLife.snapshotAt(7));
  const midday = NpcLife.formatHearthStatus(NpcLife.snapshotAt(11));

  assert.match(morning, /マルコ（行商人）/);
  assert.match(morning, /エドガー→工房/);
  assert.match(midday, /ミラ（薬師）/);
  assert.match(midday, /マルコ→北の街道/);
});

test("Grey Hearth loads NPC life on demand and refreshes the existing room annotation", () => {
  assert.match(hearthPresentation, /ensureScript\("src\/npc-life\.js"/);
  assert.match(hearthPresentation, /scene\.querySelector\("\.hearth-room-note"\)/);
  assert.match(hearthPresentation, /NpcLife\.snapshotAt\(now\)/);
  assert.match(hearthPresentation, /NpcLife\.formatHearthStatus/);
  assert.match(hearthPresentation, /if \(residentNote\.textContent !== next\)/);
  assert.doesNotMatch(hearthPresentation, /setInterval\(/);
});
