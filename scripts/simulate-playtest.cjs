"use strict";

const Engine = require("../src/slice-engine.js");
const RescueCache = require("../src/rescue-cache.js");
const EnemyAdaptation = require("../src/enemy-adaptation.js");
require("../src/enemy-adaptation-runtime.js")(Engine, EnemyAdaptation);

const ARCHETYPES = ["tactician", "cautious", "greedy", "rusher"];

/**
 * Choose an action for the given player archetype and current expedition state.
 */
function chooseAction(archetype, gameState) {
  const x = gameState.expedition;
  if (!x) return null;

  if (x.stage === "cleared") {
    if (archetype === "cautious") return "return";
    if (archetype === "greedy") return x.depth < 3 ? "deeper" : "return";
    if (archetype === "rusher") return x.depth < 2 && x.hp > 8 ? "deeper" : "return";
    // tactician evaluates risk
    if (x.depth < 2 && x.hp >= 16 && (x.potions > 0 || x.hp >= 22)) return "deeper";
    return "return";
  }

  if (x.stage === "path") {
    // Room 1 or 3: rest (+6 HP) vs search (-4 HP, +5*depth scrap)
    if ([1, 3].includes(x.room)) {
      if (archetype === "cautious") return "rest";
      if (archetype === "greedy") return x.hp > 5 ? "search" : "rest";
      if (archetype === "rusher") return "search";
      // tactician: rest if damaged enough to benefit without overhealing
      const missingHp = Engine.maxHp(gameState) - x.hp;
      if (missingHp >= 6) return "rest";
      return x.hp >= 16 ? "search" : "rest";
    }

    // Room 0, 2, 4: encounter approach (careful vs risky)
    if (archetype === "cautious") return "careful";
    if (archetype === "greedy") return "risky";
    if (archetype === "rusher") return "risky";
    // tactician: risky only when healthy enough to handle elite/tougher enemy
    return x.hp >= 18 ? "risky" : "careful";
  }

  if (x.stage === "fight") {
    const e = x.enemy;
    if (!e) return "strike";
    const nextIntent = Engine.intent(e);
    const p = Engine.combatProfile(gameState);
    const maxHp = Engine.maxHp(gameState);

    // Healing logic
    if (x.potions > 0) {
      if (archetype === "cautious" && x.hp <= maxHp - 10) return "heal";
      if (archetype === "tactician" && x.hp <= Math.max(10, nextIntent.damage + 2)) return "heal";
      if (archetype === "greedy" && x.hp <= 6) return "heal";
      if (archetype === "rusher" && x.hp <= 4) return "heal";
    }

    // Flee logic for cautious
    if (archetype === "cautious" && x.hp <= 5 && !e.elite) {
      return "flee";
    }

    // Rusher: pure aggressive spam, ignores intent
    if (archetype === "rusher") {
      if (x.stamina >= p.heavyCost && Math.random() < 0.5) return "heavy";
      return "strike";
    }

    // Greedy: high aggression, attacks whenever possible
    if (archetype === "greedy") {
      if (nextIntent.id === "open" && x.stamina >= p.heavyCost) return "heavy";
      if (nextIntent.id === "guard" && p.pierce && x.stamina >= p.heavyCost) return "heavy";
      if (x.stamina >= p.heavyCost && nextIntent.damage < 8) return "heavy";
      if (nextIntent.damage >= 10 && x.stamina >= p.dodgeCost) return "dodge";
      return "strike";
    }

    // Cautious: high defense, preserves HP above all
    if (archetype === "cautious") {
      if (nextIntent.id === "break" && x.stamina >= p.dodgeCost) {
        return "dodge";
      }
      if (nextIntent.damage > 0) {
        if (nextIntent.id === "heavy" && x.stamina >= p.dodgeCost) return "dodge";
        return "guard";
      }
      if (nextIntent.id === "open" && x.stamina >= p.heavyCost) return "heavy";
      return "strike";
    }

    // Tactician: strategic match of player action to enemy intent & weapon traits
    if (archetype === "tactician") {
      // Adaptive counter intents
      if (nextIntent.id === "break") {
        if (x.stamina >= p.dodgeCost) return "dodge";
        return "strike";
      }

      if (nextIntent.id === "feint") {
        return "strike";
      }

      if (nextIntent.id === "intercept") {
        if (x.stamina < 3) return "guard";
        return "strike";
      }

      if (nextIntent.id === "open") {
        if (x.stamina >= p.heavyCost) return "heavy";
        return "strike";
      }

      if (nextIntent.id === "guard") {
        // Bow pierces guard with heavy attack!
        if (p.pierce && x.stamina >= p.heavyCost) return "heavy";
        // Otherwise don't waste stamina hitting into guard; regain stamina or heal
        if (x.stamina < 3) return "guard";
        return "strike";
      }

      if (nextIntent.id === "heavy" || nextIntent.id === "pounce") {
        // Heavy and pounce can be fully dodged, avoiding huge damage and granting focus
        if (x.stamina >= p.dodgeCost) return "dodge";
        // If out of stamina, guard absorbs some damage
        return "guard";
      }

      if (nextIntent.id === "quick") {
        // Quick attacks deal half damage even if dodged and give no focus!
        // Guarding is strictly better against quick, especially with shield counter
        return "guard";
      }

      // Default
      if (x.stamina >= p.heavyCost && nextIntent.damage === 0) return "heavy";
      return "strike";
    }
  }

  return "strike";
}

/**
 * Run a single simulated expedition.
 */
function simulateExpedition(options = {}) {
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

  state = Engine.start(state, placeId);
  if (!state.expedition) {
    throw new Error(`Failed to start expedition to ${placeId}`);
  }

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
    } else if (stage === "path") {
      dilemmaType = [1, 3].includes(x.room) ? "rest_or_search" : "path_risk";
    } else if (stage === "cleared") {
      dilemmaType = "push_or_return";
    }

    const action = chooseAction(archetype, state);
    if (!action) break;

    distinctActions.add(action);

    // Track intent response quality
    if (intent && ["strike", "heavy", "guard", "dodge"].includes(action)) {
      totalIntentOpportunities++;
      if (
        (intent.id === "heavy" && action === "dodge") ||
        (intent.id === "quick" && action === "guard") ||
        (intent.id === "open" && ["heavy", "strike"].includes(action)) ||
        (intent.id === "guard" && (action === "guard" || (action === "heavy" && Engine.combatProfile(state).pierce)))
      ) {
        correctIntentResponses++;
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

    // Execute the action in the engine
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
  const recoveryCache = died ? RescueCache.cacheFromReport(report, placeId) : null;
  const cleared = Boolean(!died && report.cleared?.length > 0);
  const finalHp = report.hp ?? (state.expedition ? state.expedition.hp : 0);

  // Check Hearth / Camp progression
  let canEquipNew = false;
  let newGearEquipped = null;
  let canUpgrade = false;
  const foundGear = report.newGear || [];
  if (!died && foundGear.length > 0) {
    canEquipNew = true;
    newGearEquipped = foundGear[0];
    state = Engine.equip(state, newGearEquipped);
  }

  const upgradeKey = Engine.upgradeKey ? Engine.upgradeKey(state.equipped) : state.equipped;
  if (state.scrap >= Engine.upgradeCost(state, state.equipped)) {
    canUpgrade = true;
    state = Engine.upgrade(state, state.equipped);
  }

  // Check if new places can be discovered
  if (state.cleared.length >= 2 && !state.unlocked.includes("crypt")) {
    state = Engine.discover(state, "crypt");
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
    scrapGained: report.scrap || 0,
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
    logs: logs.slice(-20), // Last 20 log entries for narrative context
    hearthOutcome: {
      canEquipNew,
      newGearEquipped,
      canUpgrade,
      recoveryCache,
      scrapRemaining: state.scrap,
      unlockedPlaces: [...state.unlocked],
    },
    finalGameState: state,
  };

  return trace;
}

/**
 * Run a batch of expeditions across specified or all archetypes.
 */
function runPlaytestSuite(options = {}) {
  const runsPerArchetype = Math.max(1, Number(options.runs) || 1);
  const archetypes = options.archetype ? [options.archetype] : ARCHETYPES;
  const placeId = options.place || "wood";

  const results = [];
  for (const arch of archetypes) {
    for (let i = 0; i < runsPerArchetype; i++) {
      const trace = simulateExpedition({
        archetype: arch,
        place: placeId,
      });
      results.push(trace);
    }
  }

  return results;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const runsArg = args.find((a) => a.startsWith("--runs="));
  const runs = runsArg ? parseInt(runsArg.split("=")[1], 10) : 1;
  const archArg = args.find((a) => a.startsWith("--archetype="));
  const archetype = archArg ? archArg.split("=")[1] : null;
  const placeArg = args.find((a) => a.startsWith("--place="));
  const place = placeArg ? placeArg.split("=")[1] : "wood";

  console.log(`Simulating Crownless expeditions (place: ${place}, runs: ${runs})...`);
  const traces = runPlaytestSuite({ runs, archetype, place });
  console.log(`Completed ${traces.length} simulated runs.`);
  for (const t of traces) {
    console.log(
      `[${t.archetype.toUpperCase()}] place: ${t.place}, depth: ${t.depthReached}, cleared: ${t.cleared}, died: ${t.died}, scrap: ${t.scrapGained}, gear: [${t.newGearFound.join(", ")}], minHp: ${t.minHp}/${t.maxHp}, turns: ${t.totalTurns}`
    );
  }
}

module.exports = {
  ARCHETYPES,
  chooseAction,
  simulateExpedition,
  runPlaytestSuite,
};
