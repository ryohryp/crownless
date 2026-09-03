const test = require("node:test");
const assert = require("node:assert/strict");

const NpcInteraction = require("../src/npc-interaction.js");
const NpcLife = require("../src/npc-life.js");

test("NPC interaction defines at least talk, ask-info, and part actions with extensible types", () => {
  const actions = NpcInteraction.getAvailableActions({ npcId: "marco" });
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((a) => a.id), ["talk", "ask-info", "part"]);
  assert.deepEqual(actions.map((a) => a.label), ["話す", "情報を聞く", "別れる"]);

  assert.equal(NpcInteraction.ACTION_TYPES.TALK, "talk");
  assert.equal(NpcInteraction.ACTION_TYPES.ASK_INFO, "ask-info");
  assert.equal(NpcInteraction.ACTION_TYPES.PART, "part");

  // Reserved types for future extensibility
  assert.ok(NpcInteraction.ACTION_TYPES.TRADE);
  assert.ok(NpcInteraction.ACTION_TYPES.QUEST);
  assert.ok(NpcInteraction.ACTION_TYPES.RECRUIT);
  assert.ok(NpcInteraction.ACTION_TYPES.GIFT);
  assert.ok(NpcInteraction.ACTION_TYPES.HOSTILE);
});

test("talk dialogue differs per NPC according to role", () => {
  const marco = NpcInteraction.resolveAction("talk", { npcId: "marco", npcName: "マルコ", location: "north-road" });
  const mira = NpcInteraction.resolveAction("talk", { npcId: "mira", npcName: "ミラ", location: "forest" });
  const edgar = NpcInteraction.resolveAction("talk", { npcId: "edgar", npcName: "エドガー", location: "ruins" });

  assert.match(marco.text, /荷|街道|商売/);
  assert.match(mira.text, /薬草|魔物/);
  assert.match(edgar.text, /得物|岩場|留め具/);

  assert.notEqual(marco.text, mira.text);
  assert.notEqual(mira.text, edgar.text);
  assert.notEqual(marco.text, edgar.text);
});

test("talk dialogue for the same NPC differs between Grey Hearth and travel destination", () => {
  const marcoHearth = NpcInteraction.resolveAction("talk", {
    npcId: "marco",
    npcName: "マルコ",
    isHearth: true,
    location: "grey-hearth",
    activity: "荷支度中"
  });
  const marcoTravel = NpcInteraction.resolveAction("talk", {
    npcId: "marco",
    npcName: "マルコ",
    isHearth: false,
    location: "north-road",
    destinationName: "北の街道の古い渡し場"
  });

  assert.notEqual(marcoHearth.text, marcoTravel.text);
  assert.match(marcoHearth.text, /灰炉/);
  assert.match(marcoTravel.text, /街道/);

  const miraHearth = NpcInteraction.resolveAction("talk", {
    npcId: "mira",
    npcName: "ミラ",
    isHearth: true,
    location: "grey-hearth",
    activity: "火の番"
  });
  const miraTravel = NpcInteraction.resolveAction("talk", {
    npcId: "mira",
    npcName: "ミラ",
    isHearth: false,
    location: "herb-garden",
    destinationName: "古い森"
  });

  assert.notEqual(miraHearth.text, miraTravel.text);
  assert.match(miraHearth.text, /灰炉/);
  assert.match(miraTravel.text, /薬草/);
});

test("ask-info reuses rumor / lead / environmental information without mutating world discoveries", () => {
  const initialDiscoveries = Object.freeze({
    "sim:north-road-ford": {
      key: "sim:north-road-ford",
      name: "北の街道の古い渡し場",
      location: "north-road",
      state: "discovered"
    }
  });
  const worldState = {
    worldKnowledge: {
      discoveries: { ...initialDiscoveries }
    }
  };

  const marcoInfo = NpcInteraction.resolveAction("ask-info", {
    npcId: "marco",
    npcName: "マルコ",
    location: "north-road",
    destinationName: "北の街道の古い渡し場",
    discoveryKey: "sim:north-road-ford"
  }, worldState);

  assert.ok(marcoInfo.text);
  assert.match(marcoInfo.text, /渡し場|街道|浅瀬|物音/);
  assert.equal(marcoInfo.topic, "rumor");

  // Verify world discoveries are NOT mutated or auto-discovered
  assert.deepEqual(Object.keys(worldState.worldKnowledge.discoveries), ["sim:north-road-ford"]);
  assert.equal(Object.keys(worldState.worldKnowledge.discoveries).length, 1);
});

test("part action returns a polite farewell and isComplete true without state side-effects", () => {
  const outcome = NpcInteraction.resolveAction("part", {
    npcId: "marco",
    npcName: "マルコ",
    location: "north-road"
  });

  assert.equal(outcome.actionId, "part");
  assert.equal(outcome.isComplete, true);
  assert.match(outcome.text, /気をつけて/);
});

test("interaction models and record keys never contain raw GPS or coordinates", () => {
  const context = {
    npcId: "marco",
    npcName: "マルコ",
    location: "north-road",
    discoveryKey: "sim:north-road-ford",
    latitude: 35.1234,
    longitude: 139.5678,
    coordinates: [35.1234, 139.5678]
  };

  const norm = NpcInteraction.normalizeContext(context);
  assert.equal("latitude" in norm, false);
  assert.equal("longitude" in norm, false);
  assert.equal("coordinates" in norm, false);

  const key = NpcInteraction.interactionRecordKey(context);
  assert.equal(key, "marco|sim:north-road-ford");
  assert.doesNotMatch(key, /35\.|139\./);

  const outcome = NpcInteraction.resolveAction("talk", context);
  assert.equal("latitude" in outcome, false);
  assert.equal("longitude" in outcome, false);
  assert.equal("coordinates" in outcome, false);
});
