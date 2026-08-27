"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const narrative = require("../src/expedition-narrative.js");

function resolve({ seed = 44, policyId = "standard", companionIds = ["ed"], equipmentIds = [], destinationId = "ashen-wood" } = {}) {
  const state = system.dispatchExpedition(system.initialState(), {
    destinationId,
    companionIds,
    equipmentIds,
    policyId,
    objective: "explore",
    seed,
    durationMs: 0,
  }, 1_000_000);
  return system.resolveExpedition(state.activeExpedition, state);
}

function build(report) {
  return narrative.buildExpeditionNarrative({ report, companions: system.companions, policies: system.policies });
}

function syntheticCombat(result = "victory") {
  return {
    encounterId: "wolves",
    encounterName: "灰狼の群れ",
    initialEnemyCount: 4,
    remainingEnemyCount: result === "victory" ? 0 : 1,
    enemyTags: ["beast", "fast"],
    result,
    hpBefore: 100,
    hpAfter: result === "defeat" ? 0 : result === "retreat" ? 22 : 41,
    maxHp: 100,
    causes: ["woodsman", "ranged", "strong", "cut"],
    rounds: [
      { round: 1, hpBefore: 100, hpAfter: 82, damage: 18, healed: 0, enemyCountBefore: 4, enemiesDefeated: 1, remainingEnemyCount: 3, events: ["ranged-opener", "read-beast"], causes: ["woodsman", "ranged"] },
      { round: 2, hpBefore: 82, hpAfter: 58, damage: 24, healed: 0, enemyCountBefore: 3, enemiesDefeated: 0, remainingEnemyCount: 3, events: [], causes: ["strong", "cut"] },
      { round: 3, hpBefore: 58, hpAfter: 50, damage: 13, healed: 5, enemyCountBefore: 3, enemiesDefeated: 2, remainingEnemyCount: 1, events: ["heal", "strong-finish"], causes: ["strong", "cut"] },
      { round: 4, hpBefore: 50, hpAfter: 41, damage: 9, healed: 0, enemyCountBefore: 1, enemiesDefeated: result === "victory" ? 1 : 0, remainingEnemyCount: result === "victory" ? 0 : 1, events: [], causes: ["strong", "cut"] },
    ],
  };
}

test("same resolved report produces the same narrative without mutating combat state", () => {
  const options = { seed: 92, policyId: "greedy", companionIds: ["ed"], equipmentIds: ["old-knife", "herb-kit"], destinationId: "hollow-village" };
  const first = resolve(options);
  const second = resolve(options);
  const rawBefore = JSON.parse(JSON.stringify(first.combat));
  const firstNarrative = build(first);
  const secondNarrative = build(second);

  assert.deepEqual(firstNarrative, secondNarrative);
  assert.deepEqual(first.combat, rawBefore);
  assert.deepEqual(first.combat, second.combat);
});

test("narrative events retain structured actor enemy consequence HP and cause data", () => {
  const report = resolve({ seed: 31, companionIds: ["mira"], equipmentIds: ["shortbow"], destinationId: "ashen-wood" });
  const generated = build(report);
  assert.ok(generated.battles.length >= 1);
  const lines = generated.battles[0].lines;
  assert.ok(lines.some((line) => line.actorId === "mira"));
  for (const line of lines) {
    assert.ok(["opening", "pressure", "turning-point", "finish", "aftermath"].includes(line.phase));
    assert.ok(line.actorId);
    assert.ok(line.enemyId);
    assert.equal(typeof line.remainingEnemyCount, "number");
    assert.ok(line.action);
    assert.ok(line.reaction);
    assert.ok(line.consequence);
    assert.equal(typeof line.hpBefore, "number");
    assert.equal(typeof line.hpAfter, "number");
    assert.ok(Array.isArray(line.causes));
  }
});

test("battle arc compresses raw rounds into opening pressure turning point and finish", () => {
  const result = narrative.buildBattleNarrative({
    combat: syntheticCombat("victory"),
    party: system.companions,
    policy: system.policies.standard,
    seed: 7,
    battleIndex: 0,
  });
  assert.equal(result.lines[0].phase, "opening");
  assert.ok(result.lines.some((line) => line.phase === "pressure"));
  assert.ok(result.lines.some((line) => line.phase === "turning-point"));
  assert.ok(result.lines.some((line) => line.phase === "finish"));
  assert.ok(result.lines.length <= 7, "low-value round events should be compressed");
});

test("Mira Ed and Sella produce visibly different battle voices", () => {
  const raw = syntheticCombat("victory");
  const mira = narrative.buildBattleNarrative({ combat: raw, party: [system.companions.find((x) => x.id === "mira")], policy: system.policies.standard, seed: 8 });
  const ed = narrative.buildBattleNarrative({ combat: raw, party: [system.companions.find((x) => x.id === "ed")], policy: system.policies.standard, seed: 8 });
  const sella = narrative.buildBattleNarrative({ combat: raw, party: [system.companions.find((x) => x.id === "sella")], policy: system.policies.greedy, seed: 8 });

  const miraText = mira.lines.map((line) => line.text).join(" ");
  const edText = ed.lines.map((line) => line.text).join(" ");
  const sellaText = sella.lines.map((line) => line.text).join(" ");
  assert.match(miraText, /ミラ/);
  assert.match(miraText, /周囲|回り込み|深追い|狩り弓/);
  assert.match(edText, /エド/);
  assert.match(edText, /前|仲間|押し/);
  assert.match(sellaText, /セラ/);
  assert.match(sellaText, /出口|品|戦利品|持ち帰る/);
  assert.notEqual(miraText, edText);
  assert.notEqual(edText, sellaText);
});

test("trait and equipment causes read as authored events instead of system jargon", () => {
  const report = resolve({ seed: 31, companionIds: ["mira"], equipmentIds: ["shortbow"], destinationId: "ashen-wood" });
  const generated = build(report);
  const text = generated.battles.flatMap((battle) => battle.lines).map((line) => line.text).join(" ");
  assert.match(text, /狩り弓|矢|群れ|傷/);
  assert.doesNotMatch(text, /ranged|woodsman|strong|conceal|heal|cut/);
  assert.ok(generated.battles.flatMap((battle) => battle.lines).some((line) => line.causes.includes("ranged") || line.causes.includes("woodsman")));
});

test("victory retreat and defeat finish with different aftertastes", () => {
  const ed = system.companions.find((x) => x.id === "ed");
  const victory = narrative.buildBattleNarrative({ combat: syntheticCombat("victory"), party: [ed], policy: system.policies.standard, seed: 1 });
  const retreat = narrative.buildBattleNarrative({ combat: syntheticCombat("retreat"), party: [ed], policy: system.policies.cautious, seed: 1 });
  const defeat = narrative.buildBattleNarrative({ combat: syntheticCombat("defeat"), party: [ed], policy: system.policies.standard, seed: 1 });
  const finish = (value) => value.lines.find((line) => line.phase === "finish").text;
  assert.notEqual(finish(victory), finish(retreat));
  assert.notEqual(finish(retreat), finish(defeat));
  assert.match(finish(retreat), /ここまで|帰る|距離を切/);
  assert.match(finish(defeat), /支えきれ|膝|崩れ/);
});

test("report UI loads the narrative layer first and keeps raw chronology collapsed", () => {
  const root = path.join(__dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "src", "app-runtime-state.js"), "utf8");
  const presentation = fs.readFileSync(path.join(root, "src", "expedition-presentation.js"), "utf8");
  const narrativeLoad = runtime.indexOf('narrative.src = "src/expedition-narrative.js"');
  const domainLoad = runtime.indexOf('domain.src = "src/expedition-system.js"');
  assert.ok(narrativeLoad >= 0 && domainLoad >= 0);
  assert.match(runtime, /narrative\.onload = loadExpeditionDomain/);
  assert.match(presentation, /buildExpeditionNarrative/);
  assert.match(presentation, /BATTLE NARRATIVE/);
  assert.match(presentation, /遠征記/);
  assert.match(presentation, /時系列と戦闘数値を確認する/);
  assert.doesNotMatch(presentation, /details\.open = true/);
});
