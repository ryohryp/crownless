"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const system = require("../src/expedition-system.js");
const narrative = require("../src/expedition-narrative.js");

function syntheticCombat(result = "victory") {
  return {
    encounterId: "grey-wolves",
    encounterName: "灰狼",
    enemyCount: 4,
    initialEnemyCount: 4,
    remainingEnemyCount: result === "victory" ? 0 : 1,
    enemyTags: ["beast"],
    result,
    hpBefore: 100,
    hpAfter: result === "defeat" ? 0 : result === "retreat" ? 28 : 61,
    maxHp: 100,
    damage: result === "defeat" ? 100 : result === "retreat" ? 72 : 39,
    healed: 0,
    causes: ["woodsman", "ranged", "strong", "cut"],
    rounds: [
      { round: 1, hpBefore: 100, hpAfter: 88, damage: 12, healed: 0, enemyCountBefore: 4, enemiesDefeated: 1, remainingEnemyCount: 3, causes: ["woodsman", "ranged"], events: ["ranged-opener", "read-beast"] },
      { round: 2, hpBefore: 88, hpAfter: 70, damage: 18, healed: 0, enemyCountBefore: 3, enemiesDefeated: 1, remainingEnemyCount: 2, causes: ["strong", "cut"], events: ["strong-finish"] },
      { round: 3, hpBefore: 70, hpAfter: result === "defeat" ? 0 : result === "retreat" ? 28 : 61, damage: result === "defeat" ? 70 : result === "retreat" ? 42 : 9, healed: 0, enemyCountBefore: 2, enemiesDefeated: result === "victory" ? 2 : 1, remainingEnemyCount: result === "victory" ? 0 : 1, causes: ["strong", "cut"], events: ["strong-finish"] },
    ],
  };
}

const mira = { id: "mira", name: "ミラ", traits: ["woodsman", "cautious"] };
const ed = { id: "ed", name: "エド", traits: ["strong", "brave"] };
const sella = { id: "sella", name: "セラ", traits: ["keen-eye", "greedy", "stubborn"] };

test("same resolved report produces the same narrative without mutating combat state", () => {
  const report = {
    expeditionId: "exp-1",
    seed: 44,
    companionIds: ["mira", "ed"],
    policyId: "standard",
    policyName: "通常",
    combat: { encounters: [syntheticCombat()] },
  };
  const before = JSON.parse(JSON.stringify(report));
  const input = { report, companions: [mira, ed, sella], policies: system.policies };
  const first = narrative.buildExpeditionNarrative(input);
  const second = narrative.buildExpeditionNarrative(input);
  assert.deepEqual(first, second);
  assert.deepEqual(report, before);
});

test("narrative events retain structured actor enemy consequence HP and cause data", () => {
  const battle = narrative.buildBattleNarrative({ combat: syntheticCombat(), party: [mira, ed], policy: system.policies.standard, seed: 44 });
  assert.equal(battle.outcome, "victory");
  assert.ok(battle.lines.length >= 3);
  battle.lines.forEach((line) => {
    assert.ok(line.phase);
    assert.ok(line.actorId);
    assert.equal(line.enemyId, "grey-wolves");
    assert.ok(line.action);
    assert.ok(line.reaction);
    assert.ok(line.consequence);
    assert.equal(typeof line.hpBefore, "number");
    assert.equal(typeof line.hpAfter, "number");
    assert.ok(Array.isArray(line.causes));
    assert.ok(line.text.length > 0);
  });
});

test("battle arc compresses raw rounds into opening pressure turning point and finish", () => {
  const combat = syntheticCombat();
  combat.rounds.push({ round: 4, hpBefore: 61, hpAfter: 57, damage: 4, healed: 0, enemyCountBefore: 1, enemiesDefeated: 1, remainingEnemyCount: 0, causes: ["strong"], events: [] });
  combat.remainingEnemyCount = 0;
  combat.hpAfter = 57;
  const battle = narrative.buildBattleNarrative({ combat, party: [mira, ed], policy: system.policies.standard, seed: 44 });
  const phases = battle.lines.map((line) => line.phase);
  assert.equal(phases[0], "opening");
  assert.ok(phases.includes("pressure"));
  assert.ok(phases.includes("turning-point"));
  assert.ok(phases.includes("finish"));
  assert.ok(battle.lines.length <= 7, "narrative should compress long raw round sequences");
});

test("Mira Ed and Sella produce visibly different battle voices", () => {
  const miraBattle = narrative.buildBattleNarrative({ combat: syntheticCombat(), party: [mira], policy: system.policies.cautious, seed: 7 });
  const edBattle = narrative.buildBattleNarrative({ combat: syntheticCombat(), party: [ed], policy: system.policies.standard, seed: 7 });
  const sellaCombat = syntheticCombat();
  sellaCombat.causes = ["conceal", "greedy"];
  sellaCombat.rounds[0].events = ["ambush"];
  const sellaBattle = narrative.buildBattleNarrative({ combat: sellaCombat, party: [sella], policy: system.policies.greedy, seed: 7 });
  const text = (battle) => battle.lines.map((line) => line.text).join(" ");
  assert.match(text(miraBattle), /ミラ/);
  assert.match(text(edBattle), /エド/);
  assert.match(text(sellaBattle), /セラ/);
  assert.notEqual(text(miraBattle), text(edBattle));
  assert.notEqual(text(edBattle), text(sellaBattle));
});

test("trait and equipment causes read as authored events instead of system jargon", () => {
  const battle = narrative.buildBattleNarrative({ combat: syntheticCombat(), party: [mira, ed], policy: system.policies.standard, seed: 44 });
  const text = battle.lines.map((line) => line.text).join(" ");
  assert.match(text, /弓|藪|包囲|狼|灰狼/);
  assert.match(text, /エド|押し|刃|前へ/);
  assert.doesNotMatch(text, /ranged bonus|woodsman bonus|strong bonus|cut bonus/i);
});

test("victory retreat and defeat finish with different aftertastes", () => {
  const victory = narrative.buildBattleNarrative({ combat: syntheticCombat("victory"), party: [ed], policy: system.policies.standard, seed: 1 });
  const retreat = narrative.buildBattleNarrative({ combat: syntheticCombat("retreat"), party: [ed], policy: system.policies.cautious, seed: 1 });
  const defeat = narrative.buildBattleNarrative({ combat: syntheticCombat("defeat"), party: [ed], policy: system.policies.standard, seed: 1 });
  const finish = (value) => value.lines.find((line) => line.phase === "finish").text;
  assert.notEqual(finish(victory), finish(retreat));
  assert.notEqual(finish(retreat), finish(defeat));
  assert.match(finish(retreat), /ここまで|帰る|距離を切/);
  assert.match(finish(defeat), /支えきれ|膝|崩れ/);
});

test("report UI uses narrative through the scroll only and keeps raw chronology collapsed", () => {
  const root = path.join(__dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "src", "app-runtime-state.js"), "utf8");
  const presentation = fs.readFileSync(path.join(root, "src", "expedition-presentation.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "expedition.css"), "utf8");
  const narrativeLoad = runtime.indexOf('narrative.src = "src/expedition-narrative.js"');
  const sceneLoad = runtime.indexOf('scenes.src = "src/expedition-scenes.js"');
  const compositionLoad = runtime.indexOf('composition.src = "src/expedition-visual-composition.js"');
  const domainLoad = runtime.indexOf('domain.src = "src/expedition-system.js"');
  assert.ok(narrativeLoad >= 0 && sceneLoad >= 0 && compositionLoad >= 0 && domainLoad >= 0);
  assert.match(runtime, /narrative\.onload = loadExpeditionScenes/);
  assert.match(runtime, /scenes\.onload = loadExpeditionComposition/);
  assert.match(runtime, /composition\.onload = loadExpeditionDomain/);
  assert.match(presentation, /buildExpeditionNarrative/);
  assert.match(presentation, /renderKamishibai\(content, report, generatedNarrative\)/);
  assert.match(presentation, /EXPEDITION SCENES/);
  assert.match(presentation, /遠征絵巻/);
  assert.doesNotMatch(presentation, /BATTLE NARRATIVE/);
  assert.doesNotMatch(presentation, /遠征記/);
  assert.doesNotMatch(presentation, /renderBattleNarrative/);
  assert.doesNotMatch(css, /\.expedition-narrative/);
  assert.match(presentation, /時系列と戦闘数値を確認する/);
  assert.match(presentation, /details\.dataset\.expeditionDetails/);

  const reportStart = presentation.indexOf("function renderReport");
  const reportEnd = presentation.indexOf("document.addEventListener", reportStart);
  assert.ok(reportStart >= 0 && reportEnd > reportStart);
  const reportBody = presentation.slice(reportStart, reportEnd);
  const scrollPosition = reportBody.indexOf("renderKamishibai(content, report, generatedNarrative)");
  const summaryPosition = reportBody.indexOf("content.append(summary)");
  const detailsPosition = reportBody.indexOf("details.dataset.expeditionDetails");
  assert.ok(scrollPosition >= 0 && summaryPosition > scrollPosition && detailsPosition > summaryPosition, "report should read as scroll → summary → details");
  assert.match(reportBody, /details\.open = false/);
});

test("active expedition UI progressively reveals only elapsed log entries", () => {
  const root = path.join(__dirname, "..");
  const presentation = fs.readFileSync(path.join(root, "src", "expedition-presentation.js"), "utf8");
  assert.doesNotThrow(() => new Function(presentation));
  assert.match(presentation, /function activeLogEntries/);
  assert.match(presentation, /const progress = elapsed \/ duration/);
  assert.match(presentation, /const preview = system\.resolveExpedition\(expedition, state\)/);
  assert.match(presentation, /entry\.type !== "return" && entry\.minute <= cutoffMinute/);
  assert.match(presentation, /liveTime: formatLiveClock/);
  assert.match(presentation, /遠征中の記録/);
  assert.match(presentation, /最新の記録を確認する/);
  assert.match(presentation, /details\.open = true/);
});
