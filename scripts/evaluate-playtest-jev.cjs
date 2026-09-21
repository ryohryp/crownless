"use strict";

const { runPlaytestSuite, ARCHETYPES } = require("./simulate-playtest.cjs");

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/**
 * Builds the structured state payload for Jev evaluation.
 */
function buildJevState(trace) {
  return {
    game: "Crownless",
    genre: "Location-discovery medieval fantasy expedition RPG",
    core_loop_objective:
      "Explore -> Fight -> Loot -> Return alive -> Improve -> Explore farther. AGENTS.md goal: Can someone play for 15 minutes and want one more expedition?",
    player_archetype: trace.archetype,
    destination: trace.place,
    run_outcome: {
      cleared: trace.cleared,
      died: trace.died,
      retreated: trace.retreated,
      depth_reached: trace.depthReached,
      total_turns: trace.totalTurns,
      combat_turns: trace.combatTurns,
      scrap_gained: trace.scrapGained,
      gear_acquired: trace.gearGained,
      new_gear_found: trace.newGearFound,
    },
    health_and_tension: {
      max_hp: trace.maxHp,
      min_hp_reached: trace.minHp,
      final_hp: trace.finalHp,
      near_death_turns: trace.metrics.nearDeathMoments,
      loot_at_risk: trace.metrics.lootCarriedAtRisk,
      total_dilemmas_faced: trace.metrics.totalDilemmas,
    },
    combat_tactics: {
      intent_counter_accuracy: trace.metrics.intentResponseAccuracy,
      actions_diversity_count: trace.metrics.tacticalDiversity,
    },
    progression_at_hearth: {
      equipped_weapon: trace.finalWeapon,
      new_gear_equipped: trace.hearthOutcome.newGearEquipped,
      upgraded_weapon: trace.hearthOutcome.canUpgrade,
      scrap_held: trace.hearthOutcome.scrapRemaining,
      unlocked_destinations: trace.hearthOutcome.unlockedPlaces,
    },
    narrative_log_excerpt: trace.logs.slice(-8),
  };
}

/**
 * Builds typed questions for TypeSafe Jev System One.
 */
function buildJevQuestions() {
  return {
    tactical_depth: {
      type: "score",
      instructions:
        "How meaningful and consequential were the player's combat decisions against enemy intents and stamina limits?",
      criteria: [
        "Mindless button mashing; enemy intents can be completely ignored without penalty.",
        "Minimal adaptation; choices feel mostly superficial or obvious.",
        "Moderate tactical adaptation; responding to intents provides noticeable survival advantage.",
        "Solid strategic depth; weapon traits, defense, dodge, and stamina create consequential trade-offs.",
        "Deep tactical richness; deliberate risk management and intent reading are critical to survival.",
      ],
    },
    risk_reward_tension: {
      type: "score",
      instructions:
        "How effectively did this run create tension between the risk of dying with unreturned loot and the greed to push deeper or search ruins?",
      criteria: [
        "Zero tension; outcome is completely trivial or purely arbitrary.",
        "Mild stakes; death or survival feels largely inconsequential.",
        "Noticeable tension; player has to weigh HP loss against scrap and loot gains.",
        "High stakes; unreturned gear and low HP create genuine push-your-luck drama.",
        "Exceptional tension; every decision to delve deeper or search ruins feels nail-biting.",
      ],
    },
    one_more_run_motivation: {
      type: "score",
      instructions:
        "Does the outcome of this run (gear found, upgrades purchased, next area unlocked) create strong motivation to embark on one more expedition?",
      criteria: [
        "Dead end; no clear progression or reason to explore again.",
        "Weak pull; repetitive outcome with minimal sense of advancement.",
        "Moderate interest; player can upgrade or try a new weapon.",
        "Strong motivation; visible gear change and distinct new challenges waiting.",
        "Irresistible pull; compelling upgrade loop and immediate desire to venture into the next unknown area.",
      ],
    },
    fun_loop_status: {
      type: "choice",
      instructions:
        "What is the primary health status of the core gameplay loop (Explore -> Fight -> Loot -> Return -> Upgrade) in this run?",
      criteria: {
        healthy_loop:
          "The loop is engaging, balanced, and creates clear motivation for the next expedition.",
        mindless_combat:
          "Combat is too easy or allows pure attack spam without tactical consideration.",
        unrewarding_loot:
          "Loot or scrap rewards do not justify the risk or difficulty of the run.",
        punishing_spike:
          "Sudden unfair difficulty wall causing frustrating and unpreventable wipeouts.",
        monotonous_pacing:
          "The run drags or feels repetitive without dynamic changes in tension.",
      },
    },
    pacing_drag_risk: {
      type: "noul",
      instructions:
        "Is there a significant risk that the player experiences pacing drag, boredom, or repetitive fatigue in this run? Note that in Crownless, each turn is a fast 1-2 second tap decision, so an expedition typically takes 20-40 turns over 2-3 minutes.",
      criteria: {
        true: "The run feels repetitive, tedious, or drags out without sufficient variety.",
        false: "The pacing is crisp, engaging, and maintains interest throughout the run.",
      },
    },
  };
}

/**
 * Calls TypeSafe Jev System One API.
 */
async function callJevSystemOne(state, questions, options = {}) {
  const apiKey = options.apiKey || process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    return { available: false, reason: "no_api_key" };
  }

  const fetchFn = options.fetchFn || globalThis.fetch;
  const endpoint = options.endpoint || JEV_ENDPOINT;
  const timeoutMs = options.timeoutMs || 8000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { available: false, status: res.status, error: errText };
    }

    const data = await res.json();
    return { available: true, data };
  } catch (err) {
    clearTimeout(timer);
    return { available: false, error: err.message };
  }
}

/**
 * Offline heuristic fallback for when Jev API is unavailable or dry-run.
 */
function fallbackEvaluation(trace) {
  const isTactician = trace.archetype === "tactician";
  const isRusher = trace.archetype === "rusher";
  const hasLoot = trace.newGearFound.length > 0 || trace.scrapGained >= 15;

  let tacticalDepth = isTactician ? 4.0 : isRusher ? 1.5 : 3.0;
  if (trace.metrics.intentResponseAccuracy > 0.7) tacticalDepth += 0.5;
  if (trace.metrics.intentResponseAccuracy < 0.3) tacticalDepth -= 0.5;

  let riskTension = 2.5;
  if (trace.metrics.nearDeathMoments > 0) riskTension += 1.0;
  if (trace.depthReached >= 2) riskTension += 0.8;
  if (trace.metrics.lootCarriedAtRisk > 10) riskTension += 0.5;

  let oneMorePull = 2.0;
  if (trace.hearthOutcome.canEquipNew) oneMorePull += 1.8;
  if (trace.hearthOutcome.canUpgrade) oneMorePull += 0.8;
  if (trace.cleared) oneMorePull += 0.5;

  let loopStatus = "healthy_loop";
  if (isRusher && trace.cleared) loopStatus = "mindless_combat";
  else if (trace.died && trace.depthReached === 1 && isTactician) loopStatus = "punishing_spike";
  else if (trace.cleared && !hasLoot) loopStatus = "unrewarding_loot";

  const pacingDrag = trace.totalTurns > 60 && !hasLoot ? 0.65 : 0.15;

  return {
    tactical_depth: { score: Math.min(5, Math.max(1, tacticalDepth)), confidence: 0.7 },
    risk_reward_tension: { score: Math.min(5, Math.max(1, riskTension)), confidence: 0.7 },
    one_more_run_motivation: { score: Math.min(5, Math.max(1, oneMorePull)), confidence: 0.7 },
    fun_loop_status: { choice: loopStatus, confidence: 0.7 },
    pacing_drag_risk: { noul: pacingDrag },
  };
}

/**
 * Analyzes anomalies across traces and Jev evaluations.
 */
function detectLoopAnomalies(runEvaluations) {
  const warnings = [];

  for (const item of runEvaluations) {
    const { trace, eval: evaluation } = item;
    const loopStatus = evaluation?.fun_loop_status?.choice;

    if (trace.archetype === "rusher" && trace.cleared) {
      warnings.push({
        severity: "P1",
        code: "MINDLESS_COMBAT_SURVIVED",
        message: `連打派（${trace.archetype}）が討伐クリアしました。予兆を無視した攻撃連打で勝ててしまうバランスの緩みがないか確認してください。`,
      });
    }

    if (trace.archetype === "tactician" && trace.died && trace.depthReached === 1) {
      warnings.push({
        severity: "P1",
        code: "TACTICIAN_EARLY_WIPEOUT",
        message: `戦術派（${trace.archetype}）が第1層で全滅しました。初見プレイヤーに対する序盤のダメージカーブが急峻すぎる可能性があります。`,
      });
    }

    if (loopStatus === "unrewarding_loot") {
      warnings.push({
        severity: "P2",
        code: "UNREWARDING_LOOT",
        message: `遠征成功後の報酬感（新装備・強化可能鉄片）が不足しています。次の遠征への動機付けを強化してください。`,
      });
    }

    if (loopStatus === "monotonous_pacing" || evaluation?.pacing_drag_risk?.noul >= 0.75) {
      warnings.push({
        severity: "P2",
        code: "PACING_DRAG",
        message: `遠征（${trace.archetype}、ターン数: ${trace.totalTurns}）に中だるみ・作業感のリスクが検知されました (${((evaluation?.pacing_drag_risk?.noul || 0) * 100).toFixed(0)}%)。戦闘やイベントのテンポ改善を検討してください。`,
      });
    }
  }

  return warnings;
}

/**
 * Format score bar (e.g. ■■■■□)
 */
function formatBar(score, max = 5) {
  const filled = Math.round(score);
  return "■".repeat(Math.max(0, filled)) + "□".repeat(Math.max(0, max - filled));
}

/**
 * Run evaluation on a suite of playtest traces.
 */
async function evaluatePlaytest(options = {}) {
  const traces = options.traces || runPlaytestSuite(options);
  const isDryRun = Boolean(options.dryRun);
  const verbose = Boolean(options.verbose);

  const results = [];

  for (const trace of traces) {
    const state = buildJevState(trace);
    const questions = buildJevQuestions();

    let answers;
    let jevAvailable = false;

    if (!isDryRun && (options.apiKey || process.env.TYPESAFE_API_KEY)) {
      const resp = await callJevSystemOne(state, questions, options);
      if (resp.available && resp.data?.answers) {
        answers = resp.data.answers;
        jevAvailable = true;
      } else {
        answers = fallbackEvaluation(trace);
      }
    } else {
      answers = fallbackEvaluation(trace);
    }

    results.push({
      trace,
      eval: answers,
      jevAvailable,
    });
  }

  const warnings = detectLoopAnomalies(results);

  // Compute averages
  let totalTactical = 0;
  let totalTension = 0;
  let totalMotivation = 0;
  let totalPacingDrag = 0;
  let clearedCount = 0;

  for (const r of results) {
    totalTactical += r.eval.tactical_depth?.score || 0;
    totalTension += r.eval.risk_reward_tension?.score || 0;
    totalMotivation += r.eval.one_more_run_motivation?.score || 0;
    totalPacingDrag += r.eval.pacing_drag_risk?.noul || 0;
    if (r.trace.cleared) clearedCount++;
  }

  const count = results.length;
  const summary = {
    totalRuns: count,
    clearedCount,
    winRate: count > 0 ? Number((clearedCount / count).toFixed(2)) : 0,
    avgTacticalDepth: count > 0 ? Number((totalTactical / count).toFixed(2)) : 0,
    avgRiskTension: count > 0 ? Number((totalTension / count).toFixed(2)) : 0,
    avgMotivation: count > 0 ? Number((totalMotivation / count).toFixed(2)) : 0,
    avgPacingDragRisk: count > 0 ? Number((totalPacingDrag / count).toFixed(2)) : 0,
    warnings,
    jevLiveUsed: results.some((r) => r.jevAvailable),
  };

  return { results, summary };
}

/**
 * Print visual report to console.
 */
function printReport(report, options = {}) {
  const verbose = Boolean(options.verbose);
  console.log("\n============================================================");
  console.log("  Crownless テストプレイ自動評価レポート (TypeSafe Jev)");
  console.log(`  評価モード: ${report.summary.jevLiveUsed ? "TypeSafe Jev System One (Live)" : "Offline / Dry-Run"}`);
  console.log("============================================================\n");

  console.log("【プレイヤースタイル別 遠征結果】");
  for (const { trace, eval: evaluation, jevAvailable } of report.results) {
    const outcomeIcon = trace.cleared ? "✅ 生還踏破" : trace.died ? "💀 全滅死亡" : "🏃 撤退";
    const statusText = evaluation.fun_loop_status?.choice || "unknown";

    console.log(`\n▶ [${trace.archetype.toUpperCase()}] 目的地: ${trace.place} (${outcomeIcon})`);
    console.log(
      `  到達深層: ${trace.depthReached} | 最終HP: ${trace.finalHp}/${trace.maxHp} (最低HP: ${trace.minHp}) | 獲得鉄片: +${trace.scrapGained} | 入手装備: [${trace.newGearFound.join(", ") || "なし"}]`
    );

    const tactScore = evaluation.tactical_depth?.score || 0;
    const tensionScore = evaluation.risk_reward_tension?.score || 0;
    const motivScore = evaluation.one_more_run_motivation?.score || 0;
    const dragRisk = evaluation.pacing_drag_risk?.noul || 0;

    console.log(`  戦術的選択の深さ (Tactical Depth)   : [${tactScore.toFixed(1)}/5.0] ${formatBar(tactScore)}`);
    console.log(`  リスクと報酬の緊張感 (Risk-Reward)    : [${tensionScore.toFixed(1)}/5.0] ${formatBar(tensionScore)}`);
    console.log(`  再遠征へのモチベーション (Motivation): [${motivScore.toFixed(1)}/5.0] ${formatBar(motivScore)}`);
    console.log(`  中だるみ・作業感リスク (Drag Risk)   : ${(dragRisk * 100).toFixed(0)}% (${dragRisk > 0.4 ? "高" : "低"})`);
    console.log(`  ループ健全性判定 (Fun Loop Status)   : ${statusText}`);

    if (verbose && trace.logs.length > 0) {
      console.log("  [遠征ログ抜粋]:");
      for (const line of trace.logs.slice(-4)) {
        console.log(`    | ${line}`);
      }
    }
  }

  console.log("\n------------------------------------------------------------");
  console.log("【全体サマリー & ボトルネック診断】");
  console.log(`  総遠征回数: ${report.summary.totalRuns} 回  (生還率: ${(report.summary.winRate * 100).toFixed(0)}%)`);
  console.log(`  平均戦術性: ${report.summary.avgTacticalDepth.toFixed(2)} / 5.0`);
  console.log(`  平均緊張感: ${report.summary.avgRiskTension.toFixed(2)} / 5.0`);
  console.log(`  平均再遠征欲: ${report.summary.avgMotivation.toFixed(2)} / 5.0`);
  console.log(`  平均中だるみリスク: ${(report.summary.avgPacingDragRisk * 100).toFixed(0)}%`);

  if (report.summary.warnings.length === 0) {
    console.log("\n  ✅ ボトルネックや異常値は検知されませんでした。コアゲームループは健全です。");
  } else {
    console.log(`\n  ⚠️ 検知されたボトルネック・要調整項目 (${report.summary.warnings.length} 件):`);
    for (const w of report.summary.warnings) {
      console.log(`    [${w.severity}] [${w.code}] ${w.message}`);
    }
  }
  console.log("============================================================\n");
}

async function main() {
  const args = process.argv.slice(2);
  const runsArg = args.find((a) => a.startsWith("--runs="));
  const runs = runsArg ? parseInt(runsArg.split("=")[1], 10) : 1;
  const archArg = args.find((a) => a.startsWith("--archetype="));
  const archetype = archArg ? archArg.split("=")[1] : null;
  const placeArg = args.find((a) => a.startsWith("--place="));
  const place = placeArg ? placeArg.split("=")[1] : "wood";
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  const report = await evaluatePlaytest({
    runs,
    archetype,
    place,
    dryRun,
    verbose,
  });

  printReport(report, { verbose });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Playtest evaluation failed:", err);
    process.exit(1);
  });
}

module.exports = {
  buildJevState,
  buildJevQuestions,
  callJevSystemOne,
  fallbackEvaluation,
  detectLoopAnomalies,
  evaluatePlaytest,
  printReport,
};
