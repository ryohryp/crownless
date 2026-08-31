const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NpcLife = require("../src/npc-life.js");
const hearthPresentation = fs.readFileSync(path.join(__dirname, "../src/hearth-presentation.js"), "utf8");

const knownNorthRoad = {
  "sim:north-road-ford": {
    key: "sim:north-road-ford",
    name: "北の街道の古い渡し場",
    location: "north-road",
    state: "discovered"
  }
};

test("authoritative known destinations only yield a reunion candidate while Marco is traveling", () => {
  const during = NpcLife.reunionCandidates(NpcLife.snapshotAt(11), knownNorthRoad);
  const before = NpcLife.reunionCandidates(NpcLife.snapshotAt(8), knownNorthRoad);
  const after = NpcLife.reunionCandidates(NpcLife.snapshotAt(15), knownNorthRoad);

  assert.equal(during.length, 1);
  assert.equal(during[0].destinationName, "北の街道の古い渡し場");
  assert.equal(during[0].targetName, "マルコ");
  assert.deepEqual(before, []);
  assert.deepEqual(after, []);
});

test("Grey Hearth connects persisted world knowledge to reunion candidates without adding location tracking", () => {
  assert.match(hearthPresentation, /Core\.loadSafeState\(\)/);
  assert.match(hearthPresentation, /safe\.worldKnowledge\.discoveries/);
  assert.match(hearthPresentation, /NpcLife\.reunionCandidates\(snapshot, knownDestinations\)/);
  assert.match(hearthPresentation, /再会候補:/);
  assert.match(hearthPresentation, /candidate\.destinationName/);
  assert.match(hearthPresentation, /candidate\.targetName/);
  assert.doesNotMatch(hearthPresentation, /navigator\.geolocation/);
  assert.doesNotMatch(hearthPresentation, /setInterval\(/);
});

test("reunion candidate opens the existing world Atlas without triggering a new location scan", () => {
  assert.match(hearthPresentation, /CrownlessWorldAtlas/);
  assert.match(hearthPresentation, /Atlas\.openAtlas\(document, Core, window, \{ view: "world", autoScan: false \}\)/);
  assert.match(hearthPresentation, /world-atlas-marker, \.world-atlas-unplaced button/);
  assert.match(hearthPresentation, /destinationName/);
  assert.match(hearthPresentation, /target\.click\(\)/);
  assert.match(hearthPresentation, /target\.focus\(\)/);
});

test("reunion note is keyboard-operable only while a candidate is active", () => {
  assert.match(hearthPresentation, /residentNote\.setAttribute\("role", "button"\)/);
  assert.match(hearthPresentation, /residentNote\.setAttribute\("tabindex", "0"\)/);
  assert.match(hearthPresentation, /residentNote\.removeAttribute\("role"\)/);
  assert.match(hearthPresentation, /residentNote\.removeAttribute\("tabindex"\)/);
  assert.match(hearthPresentation, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(hearthPresentation, /event\.preventDefault\(\)/);
});

test("existing Hearth resident status remains the base copy when no reunion candidate exists", () => {
  assert.match(hearthPresentation, /NpcLife\.formatHearthStatus\(snapshot\)/);
  assert.match(hearthPresentation, /reunions\.length/);
  assert.match(hearthPresentation, /: "";/);
});
