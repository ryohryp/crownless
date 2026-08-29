"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const composition = require("../src/expedition-visual-composition.js");

function reportFixture() {
  return {
    expeditionId: "exp-compose-1",
    outcome: "success",
    destinationId: "ash-forest",
    destinationName: "灰の森",
    companionIds: ["mira", "ed"],
    injuries: ["ed"],
    combat: {
      encounters: [{
        encounterId: "grey-wolf",
        encounterName: "灰狼",
        enemyTags: ["beast"],
        result: "victory",
        initialEnemyCount: 4,
      }],
    },
    log: [
      { type: "combat-encounter", text: "灰狼4体と遭遇。" },
      { type: "combat-victory", text: "灰狼を退けた。" },
      { type: "injury", text: "エドが戦闘で負傷した。" },
      { type: "return", text: "灰炉へ帰還した。" },
    ],
  };
}

const destinations = [{ id: "ash-forest", name: "灰の森", family: "forest" }];

function scene(kind, sourceEventIds, actorIds = ["mira", "ed"]) {
  return {
    kind,
    actorIds,
    visualKey: "combat.beast",
    sourceEventIds,
  };
}

test("combat opening composes allies on one side and caps a pack at three visible enemies", () => {
  const result = composition.buildBattleComposition({
    report: reportFixture(),
    scene: scene("combat-opening", ["log-0"]),
    destinations,
  });

  assert.equal(result.kind, "combat-opening");
  assert.equal(result.terrain, "forest");
  assert.equal(result.allyCount, 2);
  assert.equal(result.enemyCount, 3);
  assert.deepEqual(result.layers.filter((layer) => layer.side === "ally").map((layer) => layer.slot), ["ally-front", "ally-rear"]);
  assert.deepEqual(result.layers.filter((layer) => layer.side === "enemy").map((layer) => layer.slot), ["enemy-front", "enemy-rear", "enemy-rear-2"]);
  assert.ok(result.layers.filter((layer) => layer.side === "ally").every((layer) => layer.assetPath === composition.PLAYER_ASSET));
  assert.ok(result.layers.filter((layer) => layer.side === "enemy").every((layer) => layer.assetPath === composition.ENEMY_ASSETS.rusher));
});

test("the same report and scene always produce the same composition", () => {
  const input = {
    report: reportFixture(),
    scene: scene("combat-opening", ["log-0"]),
    destinations,
  };

  assert.deepEqual(composition.buildBattleComposition(input), composition.buildBattleComposition(input));
});

test("combat climax carries outcome and remains a distinct layout state from opening", () => {
  const report = reportFixture();
  const opening = composition.buildBattleComposition({ report, scene: scene("combat-opening", ["log-0"]), destinations });
  const climax = composition.buildBattleComposition({ report, scene: scene("combat-climax", ["log-1"], ["ed"]), destinations });

  assert.equal(opening.kind, "combat-opening");
  assert.equal(climax.kind, "combat-climax");
  assert.equal(climax.outcome, "victory");
  assert.equal(climax.encounterId, "grey-wolf");
});

test("injury makes the wounded actor focal while preserving the opposing threat", () => {
  const result = composition.buildBattleComposition({
    report: reportFixture(),
    scene: scene("injury", ["log-2"], ["ed"]),
    destinations,
  });

  const focal = result.layers.find((layer) => layer.side === "ally" && layer.focal);
  assert.equal(focal.actorId, "ed");
  assert.equal(focal.slot, "ally-focus");
  assert.ok(result.enemyCount >= 1);
  assert.ok(result.enemyCount <= 2, "injury frame should keep the wounded ally visually dominant");
});

test("retreat and defeat become explicit pressure states", () => {
  const report = reportFixture();
  report.combat.encounters[0].result = "retreat";
  const retreat = composition.buildBattleComposition({ report, scene: scene("retreat", ["log-1"]), destinations });
  const defeat = composition.buildBattleComposition({ report, scene: scene("defeat", ["log-1"]), destinations });

  assert.equal(retreat.kind, "retreat");
  assert.equal(retreat.outcome, "retreat");
  assert.equal(defeat.kind, "defeat");
  assert.equal(defeat.outcome, "defeat");
});

test("unknown enemy roles fall back to CSS silhouettes instead of inventing an asset", () => {
  const report = reportFixture();
  report.combat.encounters[0].enemyTags = ["unknown-horror"];
  const result = composition.buildBattleComposition({ report, scene: scene("combat-opening", ["log-0"]), destinations });

  assert.ok(result.layers.filter((layer) => layer.side === "enemy").every((layer) => layer.assetPath === null));
});
