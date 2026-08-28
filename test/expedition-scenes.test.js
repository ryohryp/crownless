"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const scenes = require("../src/expedition-scenes.js");

function richReport() {
  return {
    expeditionId: "exp-scene-1",
    seed: 4242,
    outcome: "success",
    destinationId: "ash-forest",
    destinationName: "灰の森",
    companionIds: ["mira", "ed"],
    policyId: "standard",
    policyName: "通常",
    injuries: ["ed"],
    loot: [{ id: "old-sword", name: "古い軍用剣", tags: ["cut", "authority"] }],
    discoveries: [{ id: "deep-mark", name: "灰の森の奥へ続く印" }],
    combat: {
      encounters: [{
        encounterId: "grey-wolf",
        encounterName: "灰狼",
        enemyTags: ["beast"],
        result: "victory",
        initialEnemyCount: 4,
        damage: 34,
        hpBefore: 200,
        hpAfter: 166,
        maxHp: 200,
      }],
    },
    log: [
      { minute: 0, time: "06:00", type: "departure", text: "ミラ、エドが灰の森へ向かった。", causes: [] },
      { minute: 18, time: "06:18", type: "arrival", text: "灰の森へ到着。獣の気配がある。", causes: ["beast"] },
      { minute: 43, time: "06:43", type: "combat-encounter", text: "灰狼4体と遭遇。", causes: ["grey-wolf", "beast"] },
      { minute: 54, time: "06:54", type: "combat-victory", text: "灰狼を退けた。", causes: [] },
      { minute: 55, time: "06:55", type: "combat-loot", text: "古い軍用剣を戦利品として回収した。", causes: ["cut", "authority"] },
      { minute: 56, time: "06:56", type: "injury", text: "エドが戦闘で負傷した。", causes: ["combat damage"] },
      { minute: 104, time: "07:44", type: "discovery", text: "灰の森の奥へ続く印を記録した。", causes: ["learned value"] },
      { minute: 110, time: "07:50", type: "return", text: "灰炉へ帰還した。", causes: ["returned"] },
    ],
  };
}

function battleNarrative() {
  return {
    battles: [{
      encounterId: "grey-wolf",
      encounterName: "灰狼",
      outcome: "victory",
      actorIds: ["mira", "ed"],
      lines: [
        { phase: "opening", actorId: "mira", text: "ミラが先に足を止めた。灰狼が間合いを詰める前に狩り弓を引く。" },
        { phase: "turning-point", actorId: "ed", text: "エドが前へ出て一頭を押し返し、群れの勢いが止まった。" },
        { phase: "finish", actorId: "ed", text: "残った灰狼も森の奥へ退いた。" },
      ],
    }],
  };
}

const destinations = [{ id: "ash-forest", name: "灰の森", family: "forest" }];

function combatScenes(deck) {
  return deck.scenes.filter((scene) => scene.kind === "combat" || scene.kind.startsWith("combat-"));
}

test("completed expedition projects to a deterministic 3-5 scene deck", () => {
  const report = richReport();
  const before = JSON.parse(JSON.stringify(report));
  const input = { report, narrative: battleNarrative(), destinations };
  const first = scenes.buildExpeditionScenes(input);
  const second = scenes.buildExpeditionScenes(input);

  assert.deepEqual(first, second);
  assert.deepEqual(report, before, "scene projection must not mutate the completed report");
  assert.ok(first.scenes.length >= 3 && first.scenes.length <= 5);
  assert.equal(first.scenes.at(-1).phase, "ending");
  assert.equal(first.scenes.at(-1).kind, "return");
});

test("departure and arrival no longer consume representative scene slots", () => {
  const deck = scenes.buildExpeditionScenes({ report: richReport(), narrative: battleNarrative(), destinations });
  const kinds = deck.scenes.map((scene) => scene.kind);

  assert.ok(!kinds.includes("departure"));
  assert.ok(!kinds.includes("arrival"));
  assert.ok(combatScenes(deck).length >= 1, "a combat expedition must show at least one battle scene");
});

test("high-consequence events remain visible beside battle scenes", () => {
  const deck = scenes.buildExpeditionScenes({ report: richReport(), narrative: battleNarrative(), destinations });
  const kinds = deck.scenes.map((scene) => scene.kind);

  assert.ok(kinds.includes("injury"), "injury should become a representative scene");
  assert.ok(combatScenes(deck).length >= 1, "battle should not disappear behind consequence scoring");
  assert.ok(kinds.some((kind) => ["loot", "discovery"].includes(kind)), "another meaningful expedition result should remain visible");
});

test("battle-heavy expeditions may use multiple combat frames but never more than three", () => {
  const report = richReport();
  report.injuries = [];
  report.discoveries = [];
  report.loot = [];
  report.combat.encounters.push({
    encounterId: "bandit-guard",
    encounterName: "落人兵",
    enemyTags: ["bandit"],
    result: "victory",
    initialEnemyCount: 3,
    damage: 12,
    hpBefore: 166,
    hpAfter: 154,
    maxHp: 200,
  });
  report.log = report.log.filter((entry) => !["injury", "discovery", "combat-loot"].includes(entry.type));
  report.log.splice(report.log.length - 1, 0,
    { minute: 70, time: "07:10", type: "combat-encounter", text: "落人兵3体と遭遇。", causes: ["bandit-guard", "bandit"] },
    { minute: 82, time: "07:22", type: "combat-victory", text: "落人兵を退けた。", causes: [] }
  );
  const narrative = battleNarrative();
  narrative.battles.push({
    encounterId: "bandit-guard",
    encounterName: "落人兵",
    outcome: "victory",
    actorIds: ["mira", "ed"],
    lines: [
      { phase: "opening", actorId: "mira", text: "落人兵が道を塞ぐ。ミラが弓を引き、足を止めさせた。" },
      { phase: "turning-point", actorId: "ed", text: "エドが盾役を崩し、隊が一気に前へ出た。" },
      { phase: "finish", actorId: "ed", text: "残る落人兵が武器を捨てて逃げた。" },
    ],
  });

  const deck = scenes.buildExpeditionScenes({ report, narrative, destinations });
  const battles = combatScenes(deck);
  assert.ok(battles.length >= 2, "multiple battles should be allowed to occupy multiple frames");
  assert.ok(battles.length <= scenes.MAX_COMBAT_SCENES);
  assert.equal(scenes.MAX_COMBAT_SCENES, 3);
});

test("raw combat logs still produce battle scenes when narrative generation is unavailable", () => {
  const deck = scenes.buildExpeditionScenes({ report: richReport(), narrative: null, destinations });
  const battles = combatScenes(deck);

  assert.ok(battles.length >= 1);
  assert.ok(battles.some((scene) => /灰狼|接敵|退け/.test(`${scene.headline}${scene.caption}`)));
});

test("early return is represented as a decision before the ending", () => {
  const report = richReport();
  report.outcome = "early-return";
  report.injuries = [];
  report.discoveries = [];
  report.loot = [];
  report.combat.encounters[0].result = "retreat";
  report.log = report.log.filter((entry) => !["injury", "discovery", "combat-loot", "combat-victory"].includes(entry.type));
  report.log.splice(report.log.length - 1, 0, {
    minute: 70,
    time: "07:10",
    type: "combat-retreat",
    text: "通常方針の撤退基準に達し戦闘から離脱した。",
    causes: ["standard"],
  });
  report.log[report.log.length - 1] = { minute: 80, time: "07:20", type: "return", text: "予定より早く灰炉へ戻った。", causes: ["early return"] };
  const narrative = battleNarrative();
  narrative.battles[0].outcome = "retreat";

  const deck = scenes.buildExpeditionScenes({ report, narrative, destinations });
  assert.ok(deck.scenes.some((scene) => scene.kind === "retreat"));
  assert.ok(combatScenes(deck).length >= 1);
  assert.equal(deck.scenes.at(-1).headline, "早い帰還");
});

test("scene records carry stable source references, captions, and visual keys", () => {
  const deck = scenes.buildExpeditionScenes({ report: richReport(), narrative: battleNarrative(), destinations });
  deck.scenes.forEach((scene) => {
    assert.ok(scene.sceneId);
    assert.ok(scene.visualKey);
    assert.ok(scene.caption.length > 0 && scene.caption.length <= 170);
    assert.ok(Array.isArray(scene.sourceEventIds) && scene.sourceEventIds.length > 0);
    assert.ok(Array.isArray(scene.actorIds));
  });
});

test("combat visual keys resolve to fixed canon assets when an existing asset is appropriate", () => {
  const hearth = scenes.resolveVisual("hearth.return");
  const beast = scenes.resolveVisual("combat.beast");
  const bandit = scenes.resolveVisual("combat.bandit");
  const weapon = scenes.resolveVisual("loot.weapon");

  assert.equal(hearth.assetPath, "assets/hearth/concepts/grey-hearth-empty-room-v0.2.png");
  assert.equal(hearth.assetRole, "backdrop");
  assert.equal(beast.assetPath, "assets/combat/minimal-v0.1/actors/enemy-rusher.png");
  assert.equal(beast.assetRole, "figure");
  assert.equal(bandit.assetPath, "assets/combat/minimal-v0.1/actors/enemy-guard.png");
  assert.equal(weapon.assetPath, "assets/combat/minimal-v0.1/weapons/dropped-sword.png");
});