"use strict";

(function expeditionSystemModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionSystem = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionSystemFactory() {
  const RULES_VERSION = "expedition-poc-v3";
  const DEFAULT_DURATION_MS = 3 * 60 * 1000;

  const companions = [
    { id: "mira", name: "ミラ", origin: "森番の娘", traits: ["woodsman", "cautious", "tracker"], condition: "healthy", history: "まだ帰還記録はない。" },
    { id: "ed", name: "エド", origin: "灰炉近くの荷運び", traits: ["brave", "strong", "loyal"], condition: "healthy", history: "まだ帰還記録はない。" },
    { id: "sella", name: "セラ", origin: "追われた行商人", traits: ["greedy", "keen-eye", "stubborn"], condition: "healthy", history: "まだ帰還記録はない。" },
  ];

  const destinations = [
    { id: "ashen-wood", name: "灰の森", family: "forest", dangerTags: ["beast", "thicket"], opportunityTags: ["herbs", "tracks", "ruin"], durationMs: DEFAULT_DURATION_MS },
    { id: "hollow-village", name: "空鐘の廃村", family: "village", dangerTags: ["bandit", "collapse"], opportunityTags: ["salvage", "rumor", "cellar"], durationMs: DEFAULT_DURATION_MS + 60 * 1000 },
    { id: "black-mine", name: "黒爪の廃坑", family: "cave", dangerTags: ["dark", "fall", "beast"], opportunityTags: ["ore", "relic", "passage"], durationMs: DEFAULT_DURATION_MS + 2 * 60 * 1000 },
  ];

  const equipment = [
    { id: "rope", name: "麻縄", tags: ["climb"] },
    { id: "old-knife", name: "古い短刀", tags: ["cut", "conceal"] },
    { id: "herb-kit", name: "薬草包み", tags: ["heal"] },
    { id: "shortbow", name: "狩り弓", tags: ["ranged"] },
    { id: "hood", name: "煤けた外套", tags: ["conceal", "light"] },
  ];

  const policies = {
    cautious: { id: "cautious", name: "慎重", risk: -2, retreatHpRatio: 0.68, combatBias: -0.05 },
    standard: { id: "standard", name: "通常", risk: 0, retreatHpRatio: 0.42, combatBias: 0 },
    greedy: { id: "greedy", name: "強欲", risk: 2, retreatHpRatio: 0.18, combatBias: 0.08 },
  };

  const combatEncounters = {
    wolves: {
      id: "wolves", name: "灰狼の群れ", count: 4, threat: 4.5, tags: ["beast", "fast"],
      rewards: [
        { id: "wolf-hide", name: "灰狼の毛皮", tags: ["hide", "valuable"] },
        { id: "wolf-fang", name: "灰狼の牙", tags: ["trophy", "valuable"] },
      ],
    },
    bandits: {
      id: "bandits", name: "街道荒らし", count: 3, threat: 5.2, tags: ["bandit", "armed"],
      rewards: [
        { id: "bandit-silver", name: "盗賊の銀貨袋", tags: ["valuable"] },
        { id: "bandit-cleaver", name: "盗賊の鉈", tags: ["cut"] },
      ],
    },
  };

  function hashString(input) {
    let hash = 2166136261;
    for (const ch of String(input)) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function makeRng(seed) {
    let state = (Number(seed) >>> 0) || 1;
    return function next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function initialState() {
    return {
      rulesVersion: RULES_VERSION,
      companions: clone(companions), destinations: clone(destinations), equipment: clone(equipment),
      activeExpedition: null, completedReports: [], securedLoot: [],
      discoveredDestinationIds: destinations.map((item) => item.id), appliedExpeditionIds: [],
    };
  }

  function normalizeState(input) {
    const base = initialState();
    const state = input && typeof input === "object" ? input : {};
    return {
      ...base, ...state,
      companions: Array.isArray(state.companions) ? state.companions : base.companions,
      destinations: Array.isArray(state.destinations) ? state.destinations : base.destinations,
      equipment: Array.isArray(state.equipment) ? state.equipment : base.equipment,
      completedReports: Array.isArray(state.completedReports) ? state.completedReports : [],
      securedLoot: Array.isArray(state.securedLoot) ? state.securedLoot : [],
      discoveredDestinationIds: Array.isArray(state.discoveredDestinationIds) ? state.discoveredDestinationIds : base.discoveredDestinationIds,
      appliedExpeditionIds: Array.isArray(state.appliedExpeditionIds) ? state.appliedExpeditionIds : [],
    };
  }

  function dispatchExpedition(stateInput, input, nowMs) {
    const state = normalizeState(stateInput);
    if (state.activeExpedition) throw new Error("an expedition is already active");
    const destination = state.destinations.find((item) => item.id === input.destinationId);
    if (!destination) throw new Error("unknown destination");
    const selectedCompanions = (input.companionIds || []).map((id) => state.companions.find((item) => item.id === id)).filter(Boolean);
    if (!selectedCompanions.length) throw new Error("select at least one companion");
    if (selectedCompanions.some((item) => !["healthy", "ready"].includes(item.condition))) throw new Error("selected companion is unavailable");
    if (!policies[input.policyId]) throw new Error("unknown policy");
    const selectedEquipment = (input.equipmentIds || []).map((id) => state.equipment.find((item) => item.id === id)).filter(Boolean);
    const startedAt = Number.isFinite(nowMs) ? nowMs : Date.now();
    const durationMs = Number.isFinite(input.durationMs) ? Math.max(0, input.durationMs) : destination.durationMs;
    const immutable = {
      destinationId: destination.id,
      companionIds: selectedCompanions.map((item) => item.id),
      equipmentIds: selectedEquipment.map((item) => item.id),
      policyId: input.policyId,
      objective: input.objective || "explore",
    };
    const seed = Number.isFinite(input.seed) ? input.seed >>> 0 : hashString(JSON.stringify(immutable) + ":" + startedAt);
    state.activeExpedition = {
      id: input.id || `exp-${startedAt.toString(36)}-${seed.toString(36)}`,
      inputs: immutable, startedAt, expectedReturnAt: startedAt + durationMs, seed, rulesVersion: RULES_VERSION,
    };
    return state;
  }

  function formatClock(startedAt, offsetMinutes) {
    const date = new Date(startedAt + offsetMinutes * 60 * 1000);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function encounterFor(destination) {
    return destination.dangerTags.includes("bandit") ? combatEncounters.bandits : combatEncounters.wolves;
  }

  function combatBonuses(traits, capabilities, encounter) {
    let attack = 0;
    let defense = 0;
    const causes = [];
    if (traits.has("strong")) { attack += 1.05; causes.push("strong"); }
    if (traits.has("brave")) { attack += 0.55; causes.push("brave"); }
    if (traits.has("woodsman") && encounter.tags.includes("beast")) { attack += 0.8; defense += 0.55; causes.push("woodsman"); }
    if (traits.has("cautious")) { defense += 0.7; causes.push("cautious trait"); }
    if (traits.has("stubborn")) { defense += 0.35; causes.push("stubborn"); }
    if (capabilities.has("cut")) { attack += 0.7; causes.push("cut"); }
    if (capabilities.has("ranged")) { attack += encounter.tags.includes("fast") ? 1.0 : 0.75; defense += 0.35; causes.push("ranged"); }
    if (capabilities.has("conceal") && encounter.tags.includes("bandit")) { defense += 0.6; causes.push("conceal"); }
    return { attack, defense, causes };
  }

  function roundRetreatThreshold(policy, remainingEnemies, initialEnemies) {
    if (policy.id !== "greedy") return policy.retreatHpRatio;
    if (remainingEnemies <= Math.ceil(initialEnemies / 3)) return policy.retreatHpRatio * 0.55;
    return policy.retreatHpRatio;
  }

  function resolveCombatEncounter(input) {
    const { encounter, party, traits, capabilities, policy, hp, maxHp, rng } = input;
    const bonuses = combatBonuses(traits, capabilities, encounter);
    const rounds = [];
    const initialEnemyCount = encounter.count;
    let remainingEnemyCount = initialEnemyCount;
    let currentHp = hp;
    let totalDamage = 0;
    let totalHealed = 0;
    let result = "retreat";
    const maxRounds = Math.min(6, Math.max(3, initialEnemyCount + 1));

    for (let round = 1; round <= maxRounds && remainingEnemyCount > 0 && currentHp > 0; round += 1) {
      const hpBefore = currentHp;
      const enemyPressure = encounter.threat * (0.45 + 0.55 * remainingEnemyCount / initialEnemyCount);
      const healthRatio = currentHp / maxHp;
      const attackScore = party.length * 2.6 + bonuses.attack + policy.combatBias * 3 + rng() * 2.2 + healthRatio;
      const defenseScore = bonuses.defense + rng() * 1.4;
      const enemyScore = enemyPressure + remainingEnemyCount * 0.38 + rng() * 1.7;
      const margin = attackScore - enemyScore;

      let defeatedThisRound = margin > 1.7 ? 2 : margin > -0.45 ? 1 : 0;
      if (round === 1 && capabilities.has("ranged")) defeatedThisRound += 1;
      if (round === 1 && capabilities.has("conceal") && encounter.tags.includes("bandit")) defeatedThisRound += 1;
      if (traits.has("strong") && capabilities.has("cut") && margin > 0.5 && rng() > 0.55) defeatedThisRound += 1;
      if (remainingEnemyCount === initialEnemyCount && initialEnemyCount > 1) defeatedThisRound = Math.min(defeatedThisRound, initialEnemyCount - 1);
      defeatedThisRound = Math.max(0, Math.min(remainingEnemyCount, defeatedThisRound));

      const pressureAfterAttack = Math.max(0, remainingEnemyCount - defeatedThisRound);
      let damage = pressureAfterAttack === 0 ? Math.round(2 + rng() * 5) : Math.round(
        4 + enemyPressure * 1.35 + pressureAfterAttack * 2.2 + Math.max(0, -margin) * 3.3 - defenseScore * 2.1 + rng() * 5
      );
      damage = Math.max(0, Math.min(currentHp, damage));
      currentHp = Math.max(0, currentHp - damage);
      remainingEnemyCount = pressureAfterAttack;
      totalDamage += damage;

      let healed = 0;
      if (capabilities.has("heal") && currentHp > 0 && currentHp < maxHp && (round > 1 || damage >= 12)) {
        healed = Math.min(Math.round(3 + rng() * 5), maxHp - currentHp);
        currentHp += healed;
        totalHealed += healed;
      }

      const events = [];
      if (round === 1 && capabilities.has("ranged") && defeatedThisRound > 0) events.push("ranged-opener");
      if (round === 1 && capabilities.has("conceal") && encounter.tags.includes("bandit") && defeatedThisRound > 0) events.push("ambush");
      if (traits.has("woodsman") && encounter.tags.includes("beast")) events.push("read-beast");
      if (traits.has("strong") && defeatedThisRound > 0) events.push("strong-finish");
      if (healed > 0) events.push("heal");

      rounds.push({
        round, hpBefore, hpAfter: currentHp, damage, healed,
        enemyCountBefore: remainingEnemyCount + defeatedThisRound,
        enemiesDefeated: defeatedThisRound,
        remainingEnemyCount,
        attackScore: Number(attackScore.toFixed(2)), enemyScore: Number(enemyScore.toFixed(2)),
        causes: bonuses.causes.slice(), events,
      });

      if (remainingEnemyCount === 0) { result = "victory"; break; }
      if (currentHp <= 0) { result = "defeat"; break; }
      const threshold = roundRetreatThreshold(policy, remainingEnemyCount, initialEnemyCount);
      if (currentHp / maxHp <= threshold) { result = "retreat"; break; }
      if (round === maxRounds) result = "retreat";
    }

    return {
      encounterId: encounter.id, encounterName: encounter.name,
      enemyCount: initialEnemyCount, initialEnemyCount, remainingEnemyCount,
      enemyTags: encounter.tags.slice(), result,
      damage: totalDamage, healed: totalHealed, hpBefore: hp, hpAfter: currentHp, maxHp,
      causes: bonuses.causes, rounds,
    };
  }

  function shouldContinueAfterCombat(policy, combat, encounterIndex, maxEncounters) {
    if (combat.result !== "victory" || combat.hpAfter <= 0) return false;
    if (encounterIndex + 1 >= maxEncounters) return false;
    return combat.hpAfter / combat.maxHp > policy.retreatHpRatio;
  }

  function resolveExpedition(expedition, stateInput) {
    const state = normalizeState(stateInput);
    const rng = makeRng(expedition.seed);
    const destination = state.destinations.find((item) => item.id === expedition.inputs.destinationId) || destinations[0];
    const party = expedition.inputs.companionIds.map((id) => state.companions.find((item) => item.id === id)).filter(Boolean);
    const gear = expedition.inputs.equipmentIds.map((id) => state.equipment.find((item) => item.id === id)).filter(Boolean);
    const traits = new Set(party.flatMap((item) => item.traits || []));
    const capabilities = new Set(gear.flatMap((item) => item.tags || []));
    const policy = policies[expedition.inputs.policyId] || policies.standard;
    let opportunity = 3 + Math.max(0, policy.risk);
    if (capabilities.has("climb") && ["cave", "village"].includes(destination.family)) opportunity += 1;
    if (traits.has("keen-eye")) opportunity += 1;
    if (traits.has("greedy")) opportunity += 1;

    const log = [];
    const add = (minute, type, text, causes) => log.push({ minute, time: formatClock(expedition.startedAt, minute), type, text, causes: causes || [] });
    add(0, "departure", `${party.map((item) => item.name).join("、")}が${destination.name}へ向かった。`, [policy.name]);
    add(18, "arrival", `${destination.name}へ到着。${destination.dangerTags.join("・")}の気配がある。`, destination.dangerTags);
    if (traits.has("woodsman") && destination.family === "forest") add(31, "trait", "ミラが古い獣道を見抜き、危険な藪を避けた。", ["woodsman"]);
    else if (capabilities.has("climb") && destination.family !== "forest") add(31, "equipment", "麻縄を使い、崩れた足場を安全に越えた。", ["climb"]);
    else add(31, "hazard", "不安定な足場を慎重に進んだ。", destination.dangerTags);

    const loot = [];
    const discoveries = [];
    const injuries = [];
    const combats = [];
    const encounterTemplate = encounterFor(destination);
    const maxHp = Math.max(100, party.length * 100);
    let hp = maxHp;
    let forcedReturn = false;
    let defeated = false;
    const maxEncounters = policy.id === "greedy" ? 2 : policy.id === "standard" && rng() > 0.35 ? 2 : 1;

    for (let index = 0; index < maxEncounters; index += 1) {
      const encounter = { ...encounterTemplate, count: encounterTemplate.count + index, threat: encounterTemplate.threat + index * 0.75 };
      const minute = 43 + index * 30;
      add(minute, "combat-encounter", `${encounter.name}${encounter.count}体と遭遇。`, [encounter.id, ...encounter.tags]);
      const combat = resolveCombatEncounter({ encounter, party, traits, capabilities, policy, hp, maxHp, rng });
      combats.push(combat);

      combat.rounds.forEach((round, roundIndex) => {
        const at = minute + 1 + roundIndex * 2;
        if (round.events.includes("ranged-opener")) add(at, "combat-tactic", `狩り弓の初撃で${Math.max(1, round.enemiesDefeated)}体を崩した。残り${round.remainingEnemyCount}体。`, ["ranged"]);
        else if (round.events.includes("ambush")) add(at, "combat-tactic", `物陰から先手を取り、${Math.max(1, round.enemiesDefeated)}体を倒した。残り${round.remainingEnemyCount}体。`, ["conceal"]);
        else if (round.enemiesDefeated > 0) {
          const actor = traits.has("strong") ? party.find((item) => (item.traits || []).includes("strong"))?.name : null;
          add(at, "combat-round", `${actor ? `${actor}が` : "隊が"}${round.enemiesDefeated}体を仕留めた。残り${round.remainingEnemyCount}体。`, round.causes);
        } else add(at, "combat-round", `攻め切れない。敵はまだ${round.remainingEnemyCount}体いる。`, round.causes);
        if (round.damage > 0) add(at + 1, "combat-damage", `反撃を受ける。HP ${round.hpBefore} → ${round.hpAfter}${round.healed ? `（応急処置 +${round.healed}）` : ""}。`, [`damage ${round.damage}`, ...round.events]);
      });

      hp = combat.hpAfter;
      const endMinute = minute + 2 + combat.rounds.length * 2;
      if (combat.result === "victory") {
        add(endMinute, "combat-victory", `${encounter.name}を退けた。${combat.rounds.length}ラウンド、HP ${combat.hpBefore} → ${combat.hpAfter}。`, combat.causes);
        const reward = encounter.rewards[Math.floor(rng() * encounter.rewards.length)];
        const combatLoot = { ...reward, id: `${reward.id}-${index + 1}` };
        loot.push(combatLoot);
        add(endMinute + 1, "combat-loot", `${combatLoot.name}を戦利品として回収した。`, combatLoot.tags);
      } else if (combat.result === "retreat") {
        forcedReturn = true;
        add(endMinute, "combat-retreat", `残り${combat.remainingEnemyCount}体。${policy.name}方針の撤退基準に達し戦闘から離脱した。`, [policy.id, `HP ${combat.hpAfter}/${maxHp}`]);
      } else {
        forcedReturn = true;
        defeated = true;
        add(endMinute, "combat-defeat", `隊列が崩れた。敵を${combat.remainingEnemyCount}体残して戦闘不能になった。`, [`HP ${combat.hpAfter}/${maxHp}`]);
      }

      if (combat.damage >= 30 || combat.hpAfter / maxHp <= 0.38) {
        const target = party[Math.floor(rng() * party.length)];
        if (target && !injuries.includes(target.id)) {
          injuries.push(target.id);
          add(endMinute + 2, "injury", `${target.name}が戦闘で負傷した。`, ["combat damage"]);
        }
      }

      if (!shouldContinueAfterCombat(policy, combat, index, maxEncounters)) {
        if (!forcedReturn && index + 1 < maxEncounters) {
          forcedReturn = true;
          add(endMinute + 2, "retreat", `${policy.name}方針の撤退基準に達したため、次の遭遇を避けて帰路についた。`, [policy.id, `HP ${combat.hpAfter}/${maxHp}`]);
        }
        break;
      }
      add(endMinute + 2, "policy", `${policy.name}方針で、消耗を抱えたまま探索を続行した。`, [policy.id, `HP ${combat.hpAfter}/${maxHp}`]);
    }

    if (!forcedReturn) {
      const lootChance = Math.min(0.9, 0.32 + opportunity * 0.06 + (expedition.inputs.objective === "scavenge" ? 0.12 : 0));
      if (rng() < lootChance) {
        const lootByFamily = {
          forest: [{ id: "amber-resin", name: "琥珀色の樹脂", tags: ["valuable"] }, { id: "hunter-arrow", name: "古い狩人の矢束", tags: ["ranged"] }],
          village: [{ id: "military-sword", name: "古い軍用剣", tags: ["cut", "authority"] }, { id: "sealed-token", name: "煤けた通行章", tags: ["authority"] }],
          cave: [{ id: "black-ore", name: "黒鉄鉱", tags: ["ore"] }, { id: "miner-pick", name: "欠けた鉱夫のつるはし", tags: ["climb", "cut"] }],
        };
        const choices = lootByFamily[destination.family] || lootByFamily.forest;
        const found = choices[Math.floor(rng() * choices.length)];
        loot.push(found);
        add(100, "loot", `${found.name}を回収した。`, found.tags);
      }
      const discoveryChance = 0.22 + (expedition.inputs.objective === "explore" ? 0.18 : 0) + (traits.has("tracker") ? 0.12 : 0);
      if (rng() < discoveryChance) {
        const discovery = { id: `rumor-${destination.id}-${expedition.seed % 997}`, name: `${destination.name}の奥へ続く印`, sourceDestinationId: destination.id };
        discoveries.push(discovery);
        add(104, "discovery", `${discovery.name}を記録した。`, ["learned value"]);
      }
    }

    const earlyReturn = forcedReturn && !defeated;
    add(110, "return", defeated ? "傷ついた隊が灰炉へ運び戻された。" : earlyReturn ? "予定より早く灰炉へ戻った。" : "灰炉へ帰還した。", [defeated ? "defeat" : earlyReturn ? "early return" : "returned"]);
    const outcome = defeated ? "failed" : earlyReturn ? "early-return" : "success";
    return {
      expeditionId: expedition.id, outcome, destinationId: destination.id, destinationName: destination.name,
      companionIds: expedition.inputs.companionIds.slice(), policyId: policy.id, policyName: policy.name,
      startedAt: expedition.startedAt, completedAt: expedition.expectedReturnAt,
      durationMs: expedition.expectedReturnAt - expedition.startedAt,
      loot, injuries, discoveries,
      combat: { startHp: maxHp, endHp: hp, maxHp, encounters: combats },
      notableEvent: log.find((item) => ["combat-defeat", "combat-retreat", "injury", "combat-loot", "loot", "discovery", "retreat"].includes(item.type)) || log[log.length - 1],
      log, rulesVersion: expedition.rulesVersion, seed: expedition.seed,
    };
  }

  function applyReport(stateInput, report) {
    const state = normalizeState(stateInput);
    if (state.appliedExpeditionIds.includes(report.expeditionId)) {
      if (state.activeExpedition && state.activeExpedition.id === report.expeditionId) state.activeExpedition = null;
      return state;
    }
    state.appliedExpeditionIds.push(report.expeditionId);
    state.completedReports = [report, ...state.completedReports.filter((item) => item.expeditionId !== report.expeditionId)].slice(0, 20);
    for (const item of report.loot) {
      if (!state.securedLoot.some((existing) => existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
    }
    for (const id of report.injuries) {
      const companion = state.companions.find((item) => item.id === id);
      if (companion) companion.condition = "injured";
    }
    for (const id of report.companionIds) {
      const companion = state.companions.find((item) => item.id === id);
      if (companion) companion.history = `${report.destinationName} / ${report.policyName} / ${report.outcome}`;
    }
    for (const discovery of report.discoveries) if (!state.discoveredDestinationIds.includes(discovery.id)) state.discoveredDestinationIds.push(discovery.id);
    if (state.activeExpedition && state.activeExpedition.id === report.expeditionId) state.activeExpedition = null;
    return state;
  }

  function advance(stateInput, nowMs) {
    const state = normalizeState(stateInput);
    if (!state.activeExpedition) return { state, report: null, status: "idle" };
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    if (now < state.activeExpedition.expectedReturnAt) return { state, report: null, status: "active" };
    const report = resolveExpedition(state.activeExpedition, state);
    return { state: applyReport(state, report), report, status: "completed" };
  }

  return {
    RULES_VERSION, companions, destinations, equipment, policies, combatEncounters,
    initialState, normalizeState, dispatchExpedition, resolveCombatEncounter,
    shouldContinueAfterCombat, resolveExpedition, applyReport, advance, hashString,
  };
});