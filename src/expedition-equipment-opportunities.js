(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionEquipmentOpportunities = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionEquipmentOpportunities() {
  "use strict";

  const ROPE_SHAFT_OPPORTUNITY = Object.freeze({
    id: "rope-shaft-cache",
    destinationId: "black-mine",
    objectiveId: "scavenge",
    equipmentId: "rope",
    loot: Object.freeze({
      id: "rope-shaft-miners-cache",
      name: "縦坑底の封じられた鉱夫の道具箱",
      tags: Object.freeze(["valuable", "equipment-opportunity"]),
    }),
  });

  const HERB_PRESS_ON_OPPORTUNITY = Object.freeze({
    id: "herb-press-on",
    equipmentId: "herb-kit",
    policyId: "greedy",
  });

  function hasEquipment(expedition, equipmentId) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.equipmentIds)
      ? expedition.inputs.equipmentIds
      : [];
    return ids.includes(equipmentId);
  }

  function qualifiesForRopeShaft(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    return report.outcome === "success"
      && report.destinationId === ROPE_SHAFT_OPPORTUNITY.destinationId
      && expedition.inputs.objective === ROPE_SHAFT_OPPORTUNITY.objectiveId
      && hasEquipment(expedition, ROPE_SHAFT_OPPORTUNITY.equipmentId);
  }

  function applyRopeShaftOpportunity(report, expedition) {
    if (!qualifiesForRopeShaft(report, expedition)) return report;

    report.equipmentOpportunity = {
      id: ROPE_SHAFT_OPPORTUNITY.id,
      equipmentId: ROPE_SHAFT_OPPORTUNITY.equipmentId,
      destinationId: ROPE_SHAFT_OPPORTUNITY.destinationId,
    };

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === ROPE_SHAFT_OPPORTUNITY.loot.id)) {
      report.loot.push({
        id: ROPE_SHAFT_OPPORTUNITY.loot.id,
        name: ROPE_SHAFT_OPPORTUNITY.loot.name,
        tags: Array.from(ROPE_SHAFT_OPPORTUNITY.loot.tags),
      });
    }

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "equipment-opportunity" && entry.causes && entry.causes.includes(ROPE_SHAFT_OPPORTUNITY.id))) {
      const nearby = report.log.find((entry) => entry && entry.minute === 100) || report.log.find((entry) => entry && entry.minute === 104);
      report.log.push({
        minute: 102,
        time: nearby && nearby.time || "",
        type: "equipment-opportunity",
        text: "麻縄を固定して崩れた縦坑へ降り、底に残された鉱夫の道具箱を回収した。",
        causes: [ROPE_SHAFT_OPPORTUNITY.id, "rope", "scavenge"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function baselineCanSpendHerbs(report, expedition, greedyPolicy) {
    if (!report || !expedition || !expedition.inputs || !greedyPolicy) return false;
    if (expedition.inputs.policyId !== HERB_PRESS_ON_OPPORTUNITY.policyId) return false;
    if (!hasEquipment(expedition, HERB_PRESS_ON_OPPORTUNITY.equipmentId)) return false;
    if (report.outcome !== "early-return") return false;
    const encounters = report.combat && Array.isArray(report.combat.encounters) ? report.combat.encounters : [];
    if (encounters.length !== 1) return false;
    const combat = encounters[0];
    if (!combat || combat.result !== "victory" || combat.hpAfter <= 0 || !combat.maxHp) return false;
    return combat.hpAfter / combat.maxHp <= greedyPolicy.retreatHpRatio;
  }

  function resolveHerbPressOnOpportunity(baseResolve, report, expedition, state, greedyPolicy) {
    if (typeof baseResolve !== "function" || !baselineCanSpendHerbs(report, expedition, greedyPolicy)) return report;
    const firstCombat = report.combat.encounters[0];
    const originalThreshold = greedyPolicy.retreatHpRatio;
    const pressOnThreshold = Math.max(0, firstCombat.hpAfter / firstCombat.maxHp - 0.01);
    let extended;
    try {
      greedyPolicy.retreatHpRatio = pressOnThreshold;
      extended = baseResolve(expedition, state);
    } finally {
      greedyPolicy.retreatHpRatio = originalThreshold;
    }

    const extendedEncounters = extended && extended.combat && Array.isArray(extended.combat.encounters)
      ? extended.combat.encounters
      : [];
    if (!extended || extendedEncounters.length <= 1) return report;

    extended.supplyOpportunity = {
      id: HERB_PRESS_ON_OPPORTUNITY.id,
      equipmentId: HERB_PRESS_ON_OPPORTUNITY.equipmentId,
      policyId: HERB_PRESS_ON_OPPORTUNITY.policyId,
      spent: true,
    };
    if (!Array.isArray(extended.log)) extended.log = [];
    if (!extended.log.some((entry) => entry && entry.type === "supply-use" && entry.causes && entry.causes.includes(HERB_PRESS_ON_OPPORTUNITY.id))) {
      const secondEncounter = extended.log.find((entry) => entry && entry.type === "combat-encounter" && entry.minute >= 73);
      const minute = secondEncounter ? Math.max(0, secondEncounter.minute - 1) : 72;
      const time = secondEncounter && secondEncounter.time || "";
      extended.log.push({
        minute,
        time,
        type: "supply-use",
        text: "薬草包みの残りを使い切って傷を押さえ、撤退せず次の遭遇へ進んだ。",
        causes: [HERB_PRESS_ON_OPPORTUNITY.id, "herb-kit", "greedy"],
      });
      extended.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    const supplyEvent = extended.log.find((entry) => entry && entry.type === "supply-use" && entry.causes && entry.causes.includes(HERB_PRESS_ON_OPPORTUNITY.id));
    if (supplyEvent) extended.notableEvent = supplyEvent;
    return extended;
  }

  function persistEquipmentOpportunityReward(state, report) {
    if (!state || !report || !report.equipmentOpportunity || !Array.isArray(report.loot)) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    const rewards = report.loot.filter((item) => item && Array.isArray(item.tags) && item.tags.includes("equipment-opportunity"));
    for (const item of rewards) {
      if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
    }
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__equipmentOpportunitiesInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithEquipmentOpportunities(expedition, state) {
      let report = baseResolve(expedition, state);
      report = resolveHerbPressOnOpportunity(baseResolve, report, expedition, state, system.policies && system.policies.greedy);
      return applyRopeShaftOpportunity(report, expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithEquipmentOpportunities(state, report) {
      const applied = baseApplyReport(state, report);
      return persistEquipmentOpportunityReward(applied, report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithEquipmentOpportunities(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      if (expedition && now >= expedition.expectedReturnAt && expedition.inputs && expedition.inputs.policyId === HERB_PRESS_ON_OPPORTUNITY.policyId && hasEquipment(expedition, HERB_PRESS_ON_OPPORTUNITY.equipmentId)) {
        const report = system.resolveExpedition(expedition, state);
        if (report && report.supplyOpportunity && report.supplyOpportunity.id === HERB_PRESS_ON_OPPORTUNITY.id) {
          return { state: system.applyReport(state, report), report, status: "completed" };
        }
      }
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyRopeShaftOpportunity(advanced.report, expedition);
        persistEquipmentOpportunityReward(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__equipmentOpportunitiesInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      if (!installSystemHooks(root) && root.setTimeout && attempts < 40) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return {
    ROPE_SHAFT_OPPORTUNITY,
    HERB_PRESS_ON_OPPORTUNITY,
    qualifiesForRopeShaft,
    applyRopeShaftOpportunity,
    baselineCanSpendHerbs,
    resolveHerbPressOnOpportunity,
    persistEquipmentOpportunityReward,
    installSystemHooks,
    install,
  };
});