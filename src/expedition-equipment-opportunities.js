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
      return applyRopeShaftOpportunity(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithEquipmentOpportunities(state, report) {
      const applied = baseApplyReport(state, report);
      return persistEquipmentOpportunityReward(applied, report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithEquipmentOpportunities(state, nowMs) {
      const expedition = state && state.activeExpedition;
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
    qualifiesForRopeShaft,
    applyRopeShaftOpportunity,
    persistEquipmentOpportunityReward,
    installSystemHooks,
    install,
  };
});