const test = require("node:test");
const assert = require("node:assert/strict");
const Lore = require("../src/discovery-lore.js");

const crossing = {
  key: "geo:way:901:encounter:crossing+water",
  name: "綾瀬川の渡し場",
  terrain: ["water", "crossing"],
  contentKind: "encounter",
  state: "discovered",
  latitude: 35.7,
  longitude: 139.8
};

test("same discovery identity always produces the same lore without coordinates", () => {
  const first = Lore.buildDiscoveryLore(crossing);
  const second = Lore.buildDiscoveryLore({ ...crossing });
  assert.deepEqual(first, second);
  assert.ok(first.discoveryText);
  assert.ok(first.rumorText);
  assert.ok(first.threatHints.length >= 1);
  assert.ok(first.rewardHints.length >= 1);
  assert.equal(first.expeditionNote, null);
  assert.equal(first.clearedNote, null);
  assert.doesNotMatch(JSON.stringify(first), /latitude|longitude|35\.7|139\.8/);
});

test("terrain and content kind change the generated lore", () => {
  const waterEncounter = Lore.buildDiscoveryLore(crossing);
  const towerDungeon = Lore.buildDiscoveryLore({
    key: crossing.key,
    terrain: ["height"],
    contentKind: "dungeon",
    state: "discovered"
  });
  assert.notDeepEqual(waterEncounter, towerDungeon);
  assert.notEqual(waterEncounter.rumorText, towerDungeon.rumorText);
});

test("representative existing discoveries do not collapse into the same copy", () => {
  const park = Lore.buildDiscoveryLore({
    key: "geo:node:yotsugi-park:event:woods+settlement",
    name: "四つ木公園",
    terrain: ["woods", "settlement"],
    contentKind: "event",
    state: "discovered"
  });
  const river = Lore.buildDiscoveryLore(crossing);
  const tower = Lore.buildDiscoveryLore({
    key: "geo:node:watchtower:dungeon:height",
    name: "崩れた物見台",
    terrain: ["height"],
    contentKind: "dungeon",
    state: "discovered"
  });
  assert.equal(new Set([park.rumorText, river.rumorText, tower.rumorText]).size, 3);
  assert.equal(new Set([park.discoveryText, river.discoveryText, tower.discoveryText]).size, 3);
});

test("multiple terrain features are normalized and combination templates are used", () => {
  assert.deepEqual(Lore.normalizeTerrain(["bridge", "river", "water", "bridge"]), ["crossing", "water"]);
  const lore = Lore.buildDiscoveryLore(crossing);
  assert.match(lore.rumorText, /渡し賃|古銭/);
  assert.ok(lore.threatHints.some((hint) => ["亡霊", "水難", "足止め"].includes(hint)));
  assert.ok(lore.rewardHints.some((hint) => ["古銭", "川守の印", "旅人の護符"].includes(hint)));
});

test("state deepens the record without persistence", () => {
  const discovered = Lore.buildDiscoveryLore(crossing);
  const investigated = Lore.buildDiscoveryLore({ ...crossing, state: "investigated" });
  const cleared = Lore.buildDiscoveryLore({ ...crossing, state: "cleared" });
  assert.equal(discovered.expeditionNote, null);
  assert.ok(investigated.expeditionNote);
  assert.ok(cleared.expeditionNote);
  assert.ok(cleared.clearedNote);
  assert.equal(discovered.rumorText, investigated.rumorText);
  assert.equal(investigated.rumorText, cleared.rumorText);
});
