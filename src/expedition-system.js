"use strict";

(function expeditionSystemModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionSystem = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionSystemFactory() {
  const RULES_VERSION = "expedition-poc-v1";
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
    cautious: { id: "cautious", name: "慎重", risk: -2 },
    standard: { id: "standard", name: "通常", risk: 0 },
    greedy: { id: "greedy", name: "強欲", risk: 2 },
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

    const pressureRoll = rng() * 6 + danger;
    let injuredId = null;
    let earlyReturn = false;
    if (pressureRoll > 7.2) {
      const target = party[Math.floor(rng() * party.length)];
      injuredId = target && target.id;
      add(49, "injury", `${target.name}が負傷した。`, ["danger", ...(capabilities.has("heal") ? ["heal mitigated"] : [])]);
      if (policy.id === "cautious") {
        earlyReturn = true;
        add(55, "retreat", "慎重方針に従い、成果より生還を優先して帰路についた。", ["cautious", "injury"]);
      }
    } else {
      add(49, "encounter", destination.dangerTags.includes("bandit") ? "物陰の人影をやり過ごした。" : "危険な痕跡を見つけ、進路を調整した。", [traits.has("cautious") ? "cautious trait" : "field judgment"]);
    }

    const loot = [];
    const discoveries = [];
    if (!earlyReturn || policy.id === "greedy") {
      const lootChance = Math.min(0.9, 0.38 + opportunity * 0.07 + (expedition.inputs.objective === "scavenge" ? 0.12 : 0));
      if (rng() < lootChance) {
        const lootByFamily = {
          forest: [{ id: "amber-resin", name: "琥珀色の樹脂", tags: ["valuable"] }, { id: "hunter-arrow", name: "古い狩人の矢束", tags: ["ranged"] }],
          village: [{ id: "military-sword", name: "古い軍用剣", tags: ["cut", "authority"] }, { id: "sealed-token", name: "煤けた通行章", tags: ["authority"] }],
          cave: [{ id: "black-ore", name: "黒鉄鉱", tags: ["ore"] }, { id: "miner-pick", name: "欠けた鉱夫のつるはし", tags: ["climb", "cut"] }],
        };
        const choices = lootByFamily[destination.family] || lootByFamily.forest;
        const found = choices[Math.floor(rng() * choices.length)];
        loot.push(found);
        add(71, "loot", `${found.name}を回収した。`, found.tags);
      }
      const discoveryChance = 0.25 + (expedition.inputs.objective === "explore" ? 0.18 : 0) + (traits.has("tracker") ? 0.12 : 0);
      if (rng() < discoveryChance) {
        const discovery = { id: `rumor-${destination.id}-${expedition.seed % 997}`, name: `${destination.name}の奥へ続く印`, sourceDestinationId: destination.id };
        discoveries.push(discovery);
        add(82, "discovery", `${discovery.name}を記録した。`, ["learned value"]);
      }
    }

    if (policy.id === "greedy" && !earlyReturn) add(93, "policy", "強欲方針に従い、帰路につく前にもう一度周囲を探った。", ["greedy"]);
    add(110, "return", earlyReturn ? "予定より早く灰炉へ戻った。" : "灰炉へ帰還した。", [earlyReturn ? "early return" : "returned"]);

    const outcome = injuredId && policy.id === "greedy" && pressureRoll > 9.2 ? "failed" : earlyReturn ? "early-return" : "success";
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
      injuries: injuredId ? [injuredId] : [],
      discoveries,
      notableEvent: log.find((item) => ["injury", "loot", "discovery", "retreat"].includes(item.type)) || log[log.length - 1],
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
    initialState,
    normalizeState,
    dispatchExpedition,
    resolveExpedition,
    applyReport,
    advance,
    hashString,
  };
});
