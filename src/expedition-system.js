"use strict";

(function expeditionSystemModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionSystem = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionSystemFactory() {
  const RULES_VERSION = "expedition-poc-v2";
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
      id: "wolves",
      name: "灰狼の群れ",
      count: 4,
      threat: 4.5,
      tags: ["beast", "fast"],
      rewards: [
        { id: "wolf-hide", name: "灰狼の毛皮", tags: ["hide", "valuable"] },
        { id: "wolf-fang", name: "灰狼の牙", tags: ["trophy", "valuable"] },
      ],
    },
    bandits: {
      id: "bandits",
      name: "街道荒らし",
      count: 3,
      threat: 5.2,
      tags: ["bandit", "armed"],
      rewards: [
        { id: "bandit-silver", name: "盗賊の銀貨袋", tags: ["valuable"] },
        { id: "bandit-cleaver", name: "盗賊の鉈", tags: ["cut"] },
      ],
    },
  };

  function hashString(input) {
    let hash = 2166136261;
    const text = String(input);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function initialState() {
    return {
      rulesVersion: RULES_VERSION,
      companions: clone(companions),
      destinations: clone(destinations),
      equipment: clone(equipment),
      activeExpedition: null,
      completedReports: [],
      securedLoot: [],
      discoveredDestinationIds: destinations.map((item) => item.id),
      appliedExpeditionIds: [],
    };
  }

  function normalizeState(input) {
    const base = initialState();
    const state = input && typeof input === "object" ? input : {};
    return {
      ...base,
      ...state,
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
    const id = input.id || `exp-${startedAt.toString(36)}-${seed.toString(36)}`;
    state.activeExpedition = {
      id,
      inputs: immutable,
      startedAt,
      expectedReturnAt: startedAt + durationMs,
      seed,
      rulesVersion: RULES_VERSION,
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
    if (traits.has("strong")) {
      attack += 1.05;
      causes.push("strong");
    }
    if (traits.has("brave")) {
      attack += 0.55;
      causes.push("brave");
    }
    if (traits.has("woodsman") && encounter.tags.includes("beast")) {
      attack += 0.8;
      defense += 0.55;
      causes.push("woodsman");
    }
    if (traits.has("cautious")) {
      defense += 0.7;
      causes.push("cautious trait");
    }
    if (traits.has("stubborn")) {
      defense += 0.35;
      causes.push("stubborn");
    }
    if (capabilities.has("cut")) {
      attack += 0.7;
      causes.push("cut");
    }
    if (capabilities.has("ranged")) {
      attack += encounter.tags.includes("fast") ? 1.0 : 0.75;
      defense += 0.35;
      causes.push("ranged");
    }
    if (capabilities.has("conceal") && encounter.tags.includes("bandit")) {
      defense += 0.6;
      causes.push("conceal");
    }
    return { attack, defense, causes };
  }

  function resolveCombatEncounter(input) {
    const { encounter, party, traits, capabilities, policy, hp, maxHp, rng } = input;
    const bonuses = combatBonuses(traits, capabilities, encounter);
    const healthRatio = maxHp > 0 ? hp / maxHp : 0;
    const partyBase = party.length * 4.2;
    const attackRoll = rng() * 2.8;
    const enemyRoll = rng() * 2.4;
    const attackScore = partyBase + bonuses.attack + attackRoll + policy.combatBias * 4 + Math.max(-1.4, (healthRatio - 0.5) * 1.5);
    const enemyScore = encounter.threat + encounter.count * 0.42 + enemyRoll;
    const margin = attackScore - enemyScore;

    let result = "victory";
    if (margin < -2.0) result = "defeat";
    else if (margin < -0.55) result = "retreat";

    let damage = Math.round(10 + encounter.threat * 3.2 + Math.max(0, -margin) * 5.5 - bonuses.defense * 3.2 + rng() * 9);
    if (result === "victory") damage -= 5;
    if (result === "defeat") damage += 12;
    damage = Math.max(4, Math.min(hp, damage));

    let nextHp = Math.max(0, hp - damage);
    let healed = 0;
    if (capabilities.has("heal") && nextHp > 0) {
      healed = Math.min(Math.round(6 + rng() * 5), maxHp - nextHp);
      nextHp += healed;
    }

    return {
      encounterId: encounter.id,
      encounterName: encounter.name,
      enemyCount: encounter.count,
      enemyTags: encounter.tags.slice(),
      result,
      damage,
      healed,
      hpBefore: hp,
      hpAfter: nextHp,
      maxHp,
      attackScore: Number(attackScore.toFixed(2)),
      enemyScore: Number(enemyScore.toFixed(2)),
      causes: bonuses.causes,
      margin: Number(margin.toFixed(2)),
    };
  }

  function shouldContinueAfterCombat(policy, combat, encounterIndex, maxEncounters) {
    if (combat.result === "defeat" || combat.hpAfter <= 0) return false;
    if (combat.result === "retreat") return false;
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
    let danger = 3 + policy.risk;
    let opportunity = 3 + Math.max(0, policy.risk);
    if (traits.has("cautious")) danger -= 1;
    if (traits.has("woodsman") && destination.family === "forest") danger -= 1;
    if (capabilities.has("heal")) danger -= 1;
    if (capabilities.has("ranged") && destination.dangerTags.includes("beast")) danger -= 1;
    if (capabilities.has("climb") && ["cave", "village"].includes(destination.family)) opportunity += 1;
    if (traits.has("keen-eye")) opportunity += 1;
    if (traits.has("greedy")) opportunity += 1;

    const log = [];
    const add = (minute, type, text, causes) => log.push({ minute, time: formatClock(expedition.startedAt, minute), type, text, causes: causes || [] });
    add(0, "departure", `${party.map((item) => item.name).join("、")}が${destination.name}へ向かった。`, [policy.name]);
    add(18, "arrival", `${destination.name}へ到着。${destination.dangerTags.join("・")}の気配がある。`, destination.dangerTags);

    if (traits.has("woodsman") && destination.family === "forest") {
      add(31, "trait", "ミラが古い獣道を見抜き、危険な藪を避けた。", ["woodsman"]);
    } else if (capabilities.has("climb") && destination.family !== "forest") {
      add(31, "equipment", "麻縄を使い、崩れた足場を安全に越えた。", ["climb"]);
    } else {
      add(31, "hazard", "不安定な足場を慎重に進んだ。", destination.dangerTags);
    }

    const loot = [];
    const discoveries = [];
    const injuries = [];
    const encounterTemplate = encounterFor(destination);
    const maxHp = Math.max(100, party.length * 100);
    let hp = maxHp;
    const combats = [];
    let forcedReturn = false;
    let defeated = false;
    const maxEncounters = policy.id === "greedy" ? 2 : policy.id === "standard" && rng() > 0.35 ? 2 : 1;

    for (let index = 0; index < maxEncounters; index += 1) {
      const encounter = {
        ...encounterTemplate,
        count: encounterTemplate.count + index,
        threat: encounterTemplate.threat + index * 0.75,
      };
      const minute = 43 + index * 24;
      add(minute, "combat-encounter", `${encounter.name}${encounter.count}体と遭遇。`, [encounter.id, ...encounter.tags]);

      if (capabilities.has("ranged")) {
        add(minute + 1, "combat-tactic", "狩り弓で接近前に数を減らした。", ["ranged"]);
      } else if (traits.has("strong")) {
        add(minute + 1, "combat-tactic", `${party.find((item) => (item.traits || []).includes("strong"))?.name || "仲間"}が前へ出て敵を引きつけた。`, ["strong"]);
      } else if (traits.has("woodsman") && encounter.tags.includes("beast")) {
        add(minute + 1, "combat-tactic", "獣の動きを読み、包囲されない場所を選んだ。", ["woodsman"]);
      }

      const combat = resolveCombatEncounter({ encounter, party, traits, capabilities, policy, hp, maxHp, rng });
      combats.push(combat);
      hp = combat.hpAfter;

      if (combat.result === "victory") {
        add(minute + 5, "combat-victory", `${encounter.name}を退けた。HP ${combat.hpBefore} → ${combat.hpAfter}。`, [...combat.causes, `damage ${combat.damage}`]);
        const reward = encounter.rewards[Math.floor(rng() * encounter.rewards.length)];
        const combatLoot = { ...reward, id: `${reward.id}-${index + 1}` };
        loot.push(combatLoot);
        add(minute + 7, "combat-loot", `${combatLoot.name}を戦利品として回収した。`, combatLoot.tags);
      } else if (combat.result === "retreat") {
        forcedReturn = true;
        add(minute + 5, "combat-retreat", `押し切れず戦闘から離脱した。HP ${combat.hpBefore} → ${combat.hpAfter}。`, [...combat.causes, `damage ${combat.damage}`]);
      } else {
        forcedReturn = true;
        defeated = true;
        add(minute + 5, "combat-defeat", `隊列が崩れ、これ以上戦えない。HP ${combat.hpBefore} → ${combat.hpAfter}。`, [...combat.causes, `damage ${combat.damage}`]);
      }

      if (combat.healed > 0) {
        add(minute + 6, "combat-heal", `薬草包みで${combat.healed}回復した。`, ["heal"]);
      }

      if (combat.damage >= 30 || combat.hpAfter / maxHp <= 0.38) {
        const target = party[Math.floor(rng() * party.length)];
        if (target && !injuries.includes(target.id)) {
          injuries.push(target.id);
          add(minute + 8, "injury", `${target.name}が戦闘で負傷した。`, ["combat damage"]);
        }
      }

      if (!shouldContinueAfterCombat(policy, combat, index, maxEncounters)) {
        if (!forcedReturn && index + 1 < maxEncounters) {
          forcedReturn = true;
          add(minute + 9, "retreat", `${policy.name}方針の撤退基準に達したため、次の戦闘を避けて帰路についた。`, [policy.id, `HP ${combat.hpAfter}/${maxHp}`]);
        }
        break;
      }

      add(minute + 10, "policy", `${policy.name}方針で、消耗を抱えたまま探索を続行した。`, [policy.id, `HP ${combat.hpAfter}/${maxHp}`]);
    }

    const pressureRoll = rng() * 6 + danger;
    if (!forcedReturn && pressureRoll > 8.8 && injuries.length === 0) {
      const target = party[Math.floor(rng() * party.length)];
      if (target) {
        injuries.push(target.id);
        add(92, "injury", `${target.name}が帰路の崩れた足場で負傷した。`, ["danger", ...(capabilities.has("heal") ? ["heal mitigated"] : [])]);
      }
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
        add(96, "loot", `${found.name}を回収した。`, found.tags);
      }
      const discoveryChance = 0.22 + (expedition.inputs.objective === "explore" ? 0.18 : 0) + (traits.has("tracker") ? 0.12 : 0);
      if (rng() < discoveryChance) {
        const discovery = { id: `rumor-${destination.id}-${expedition.seed % 997}`, name: `${destination.name}の奥へ続く印`, sourceDestinationId: destination.id };
        discoveries.push(discovery);
        add(102, "discovery", `${discovery.name}を記録した。`, ["learned value"]);
      }
    }

    const earlyReturn = forcedReturn && !defeated;
    if (policy.id === "greedy" && !forcedReturn && combats.length > 1) add(104, "policy", "強欲方針に従い、二度目の戦闘後も周囲を探った。", ["greedy"]);
    add(110, "return", defeated ? "傷ついた隊が灰炉へ運び戻された。" : earlyReturn ? "予定より早く灰炉へ戻った。" : "灰炉へ帰還した。", [defeated ? "defeat" : earlyReturn ? "early return" : "returned"]);

    const outcome = defeated ? "failed" : earlyReturn ? "early-return" : "success";
    return {
      expeditionId: expedition.id,
      outcome,
      destinationId: destination.id,
      destinationName: destination.name,
      companionIds: expedition.inputs.companionIds.slice(),
      policyId: policy.id,
      policyName: policy.name,
      startedAt: expedition.startedAt,
      completedAt: expedition.expectedReturnAt,
      durationMs: expedition.expectedReturnAt - expedition.startedAt,
      loot,
      injuries,
      discoveries,
      combat: {
        startHp: maxHp,
        endHp: hp,
        maxHp,
        encounters: combats,
      },
      notableEvent: log.find((item) => ["combat-defeat", "combat-retreat", "injury", "combat-loot", "loot", "discovery", "retreat"].includes(item.type)) || log[log.length - 1],
      log,
      rulesVersion: expedition.rulesVersion,
      seed: expedition.seed,
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
      if (!state.securedLoot.some((existing) => existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
    }
    for (const id of report.injuries) {
      const companion = state.companions.find((item) => item.id === id);
      if (companion) companion.condition = "injured";
    }
    for (const id of report.companionIds) {
      const companion = state.companions.find((item) => item.id === id);
      if (companion) companion.history = `${report.destinationName} / ${report.policyName} / ${report.outcome}`;
    }
    for (const discovery of report.discoveries) {
      if (!state.discoveredDestinationIds.includes(discovery.id)) state.discoveredDestinationIds.push(discovery.id);
    }
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
    RULES_VERSION,
    companions,
    destinations,
    equipment,
    policies,
    combatEncounters,
    initialState,
    normalizeState,
    dispatchExpedition,
    resolveCombatEncounter,
    shouldContinueAfterCombat,
    resolveExpedition,
    applyReport,
    advance,
    hashString,
  };
});
