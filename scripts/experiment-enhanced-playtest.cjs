"use strict";

/**
 * Enhanced Playtest Experiment with Top Jev Ideas:
 * 1. Posture Break / Stagger System (reduces combat turns by rewarding correct intent exploitation)
 * 2. Soul Cache / Lost Loot Recovery (mitigates death wipeout motivation collapse)
 * 3. Campfire / Low-Cost Hearth Progression (even 4-6 scrap yields meaningful progression)
 */

const Engine = require("../src/slice-engine.js");
const EnemyAdaptation = require("../src/enemy-adaptation.js");
require("../src/enemy-adaptation-runtime.js")(Engine, EnemyAdaptation);
const { evaluatePlaytest } = require("./evaluate-playtest-jev.cjs");
const { chooseAction, ARCHETYPES } = require("./simulate-playtest.cjs");

/**
 * Simulate an expedition with the enhanced mechanics.
 */
function simulateEnhancedExpedition(options = {}) {
  const archetype = options.archetype || "tactician";
  const placeId = options.place || "wood";
  let state = options.initialState || Engine.initial();
  state.mode = "trial";

  if (placeId === "crypt" && state.cleared.length < 2) {
    state.cleared = ["wood", "tower"];
    if (!state.owned.includes("shield")) state.owned.push("shield");
    if (!state.owned.includes("fang")) state.owned.push("fang");
    if (state.equipped === "rust") state.equipped = "shield";
  }

  if (!state.unlocked.includes(placeId)) {
    state = Engine.discover(state, placeId);
  }

  // Pre-existing soul cache from previous wipeout?
  const hasSoulCache = options.hasSoulCache ?? (archetype === "tactician" || archetype === "greedy");
  const soulCacheScrap = hasSoulCache ? 18 : 0;

  state = Engine.start(state, placeId);
  const maxHp = Engine.maxHp(state);
  let minHp = maxHp;
  let totalTurns = 0;
  let combatTurns = 0;
  const decisions = [];
  const logs = [...state.expedition.log];
  const distinctActions = new Set();
  let correctIntentResponses = 0;
  let totalIntentOpportunities = 0;
  let nearDeathMoments = 0;
  let maxScrapAtRisk = 0;

  // Stagger state for current enemy: 3 posture points
  let enemyPosture = 3;
  let isEnemyStaggered = false;

  const MAX_TURNS = 100;

  while (state.expedition && totalTurns < MAX_TURNS) {
    totalTurns++;
    const x = state.expedition;
    minHp = Math.min(minHp, x.hp);
    if (x.hp <= Math.ceil(maxHp * 0.3)) {
      nearDeathMoments++;
    }
    maxScrapAtRisk = Math.max(maxScrapAtRisk, x.scrap);

    const stage = x.stage;
    let intent = null;
    let dilemmaType = "combat";

    if (stage === "fight" && x.enemy) {
      combatTurns++;
      intent = Engine.intent(x.enemy);
      dilemmaType = "combat";

      // Enhanced Mechanics: Posture Break
      // If enemy was staggered last turn, reset posture and stagger
      if (isEnemyStaggered) {
        isEnemyStaggered = false;
        enemyPosture = 3;
      }
    } else if (stage === "path") {
      dilemmaType = [1, 3].includes(x.room) ? "rest_or_search" : "path_risk";
      enemyPosture = 3;
      isEnemyStaggered = false;

      // Recover Soul Cache if reaching depth 2
      if (x.depth >= 2 && soulCacheScrap > 0 && !x.recoveredSoulCache) {
        x.scrap += soulCacheScrap;
        x.recoveredSoulCache = true;
        logs.push(`【灰の道標】前回の遺品袋を回収！ 鉄片 +${soulCacheScrap}。`);
      }
    } else if (stage === "cleared") {
      dilemmaType = "push_or_return";
    }

    const action = chooseAction(archetype, state);
    if (!action) break;

    distinctActions.add(action);

    // Track posture breaking mechanics
    if (intent && ["strike", "heavy", "guard", "dodge"].includes(action)) {
      totalIntentOpportunities++;
      const isCorrectCounter =
        (intent.id === "heavy" && action === "dodge") ||
        (intent.id === "quick" && action === "guard") ||
        (intent.id === "open" && ["heavy", "strike"].includes(action)) ||
        (intent.id === "guard" && (action === "guard" || (action === "heavy" && Engine.combatProfile(state).pierce)));

      if (isCorrectCounter) {
        correctIntentResponses++;
        enemyPosture -= action === "heavy" ? 2 : 1;
        if (enemyPosture <= 0 && !isEnemyStaggered) {
          isEnemyStaggered = true;
          // Apply stagger bonus: deal instant stagger bonus damage & restore 1 stamina
          if (x.enemy) {
            const staggerDmg = 6;
            x.enemy.hp = Math.max(0, x.enemy.hp - staggerDmg);
            x.stamina = Math.min(3, x.stamina + 1);
            logs.push(`体勢崩し成功！ 敵の体勢が崩れ、隙に追撃 +${staggerDmg} ダメージ！ 気力回復。`);
          }
        }
      }
    }

    decisions.push({
      turn: totalTurns,
      stage,
      dilemmaType,
      action,
      intent: intent ? intent.id : null,
      hpBefore: x.hp,
      staminaBefore: x.stamina,
      enemyHpBefore: x.enemy?.hp ?? null,
    });

    const nextState = Engine.act(state, action);
    if (nextState.expedition) {
      if (nextState.expedition.log?.length) {
        logs.push(...nextState.expedition.log);
      }
    }
    state = nextState;
  }

  const report = state.report || {};
  const died = Boolean(report.died);
  const cleared = Boolean(!died && report.cleared?.length > 0);
  const finalHp = report.hp ?? (state.expedition ? state.expedition.hp : 0);

  // Hearth progression with Campfire Upgrades:
  // Even 6 scrap allows a campfire upgrade (e.g. +1 potion or +5 max HP)
  let canEquipNew = false;
  let newGearEquipped = null;
  let canUpgrade = false;
  const foundGear = report.newGear || [];
  if (!died && foundGear.length > 0) {
    canEquipNew = true;
    newGearEquipped = foundGear[0];
    state = Engine.equip(state, newGearEquipped);
  }

  // If died, 40% scrap is saved as a soul remnant / salvaged
  let scrapGained = report.scrap || 0;
  if (died && maxScrapAtRisk > 0) {
    const salvaged = Math.floor(maxScrapAtRisk * 0.4);
    state.scrap += salvaged;
    scrapGained = salvaged;
    logs.push(`全滅したが、衣服に遺る鉄片を一部 (${salvaged}個) 回収した。`);
  }

  if (state.scrap >= 6) {
    canUpgrade = true;
  }

  const trace = {
    archetype,
    place: placeId,
    startWeapon: options.initialState?.equipped || "rust",
    finalWeapon: state.equipped,
    cleared,
    died,
    retreated: decisions.some((d) => d.action === "flee"),
    depthReached: report.depth || 1,
    roomsCleared: decisions.filter((d) => d.stage === "fight" && d.action === "strike" && d.enemyHpBefore <= 5).length,
    finalHp,
    maxHp,
    minHp,
    scrapGained,
    gearGained: report.gear || [],
    newGearFound: foundGear,
    totalTurns,
    combatTurns,
    decisions,
    metrics: {
      intentResponseAccuracy: totalIntentOpportunities > 0
        ? Number((correctIntentResponses / totalIntentOpportunities).toFixed(2))
        : 1.0,
      tacticalDiversity: distinctActions.size,
      nearDeathMoments,
      lootCarriedAtRisk: maxScrapAtRisk,
      totalDilemmas: decisions.filter((d) => d.dilemmaType !== "combat").length,
    },
    logs: logs.slice(-20),
    hearthOutcome: {
      canEquipNew,
      newGearEquipped,
      canUpgrade,
      scrapRemaining: state.scrap,
      unlockedPlaces: [...state.unlocked],
    },
    finalGameState: state,
  };

  return trace;
}

async function runEnhancedPlaytest() {
  console.log("============================================================");
  console.log("  Crownless 改善アイデア適用後 テストプレイ検証 (TypeSafe Jev)");
  console.log("  適用メカニクス: 体勢崩し (Posture Break) + 遺品回収 + 焚き火少額強化");
  console.log("============================================================\n");

  const traces = [];
  for (const arch of ARCHETYPES) {
    const trace = simulateEnhancedExpedition({ archetype: arch, place: "wood" });
    traces.push(trace);
  }

  const report = await evaluatePlaytest({ traces, apiKey: process.env.TYPESAFE_API_KEY });
  const { printReport } = require("./evaluate-playtest-jev.cjs");
  // Print standard report
  require("./evaluate-playtest-jev.cjs");

  console.log("【プレイヤースタイル別 遠征結果 (改善後)】");
  for (const { trace, eval: evaluation } of report.results) {
    const outcomeIcon = trace.cleared ? "✅ 生還踏破" : trace.died ? "💀 全滅死亡" : "🏃 撤退";
    console.log(`\n▶ [${trace.archetype.toUpperCase()}] 目的地: ${trace.place} (${outcomeIcon})`);
    console.log(
      `  到達深層: ${trace.depthReached} | ターン数: ${trace.totalTurns} (戦闘: ${trace.combatTurns}) | 最終HP: ${trace.finalHp}/${trace.maxHp} | 獲得鉄片: +${trace.scrapGained}`
    );
    console.log(`  戦術的選択の深さ (Tactical Depth)   : [${(evaluation.tactical_depth?.score || 0).toFixed(1)}/5.0]`);
    console.log(`  リスクと報酬の緊張感 (Risk-Reward)    : [${(evaluation.risk_reward_tension?.score || 0).toFixed(1)}/5.0]`);
    console.log(`  再遠征へのモチベーション (Motivation): [${(evaluation.one_more_run_motivation?.score || 0).toFixed(1)}/5.0]`);
    console.log(`  中だるみ・作業感リスク (Drag Risk)   : ${(((evaluation.pacing_drag_risk?.noul || 0)) * 100).toFixed(0)}%`);
    console.log(`  ループ健全性判定 (Fun Loop Status)   : ${evaluation.fun_loop_status?.choice}`);
  }

  console.log("\n------------------------------------------------------------");
  console.log("【改善前後 比較サマリー】");
  console.log(`  総遠征回数: ${report.summary.totalRuns} 回 (生還率: ${(report.summary.winRate * 100).toFixed(0)}%)`);
  console.log(`  平均戦術性: ${report.summary.avgTacticalDepth} / 5.0`);
  console.log(`  平均緊張感: ${report.summary.avgRiskTension} / 5.0`);
  console.log(`  平均再遠征欲: ${report.summary.avgMotivation} / 5.0`);
  console.log(`  平均中だるみリスク: ${(report.summary.avgPacingDragRisk * 100).toFixed(0)}%`);
  console.log(`  検知警告数: ${report.summary.warnings.length} 件`);
  console.log("============================================================\n");
}

if (require.main === module) {
  runEnhancedPlaytest().catch(console.error);
}

module.exports = { simulateEnhancedExpedition, runEnhancedPlaytest };
