(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionPartyOpportunities = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionPartyOpportunities() {
  "use strict";

  const COORDINATED_HUNT = Object.freeze({
    id: "mira-ed-coordinated-hunt",
    destinationId: "ashen-wood",
    objectiveId: "hunt",
    companionIds: Object.freeze(["ed", "mira"]),
    loot: Object.freeze({
      id: "coordinated-hunt-alpha-hide",
      name: "追い込み猟で仕留めた先導狼の毛皮",
      tags: Object.freeze(["hide", "valuable", "party-opportunity"]),
    }),
  });

  function sortedCompanionIds(expedition) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.companionIds)
      ? expedition.inputs.companionIds.filter(Boolean)
      : [];
    return Array.from(new Set(ids)).sort();
  }

  function hasCombatVictory(report) {
    return Boolean(report && Array.isArray(report.log) && report.log.some((entry) => entry && entry.type === "combat-victory"));
  }

  function qualifiesForCoordinatedHunt(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    const ids = sortedCompanionIds(expedition);
    return report.outcome === "success"
      && report.destinationId === COORDINATED_HUNT.destinationId
      && expedition.inputs.objective === COORDINATED_HUNT.objectiveId
      && ids.length === COORDINATED_HUNT.companionIds.length
      && ids.every((id, index) => id === COORDINATED_HUNT.companionIds[index])
      && hasCombatVictory(report);
  }

  function applyCoordinatedHunt(report, expedition) {
    if (!qualifiesForCoordinatedHunt(report, expedition)) return report;

    report.partyOpportunity = {
      id: COORDINATED_HUNT.id,
      companionIds: Array.from(COORDINATED_HUNT.companionIds),
      destinationId: COORDINATED_HUNT.destinationId,
      objectiveId: COORDINATED_HUNT.objectiveId,
    };

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === COORDINATED_HUNT.loot.id)) {
      report.loot.push({
        id: COORDINATED_HUNT.loot.id,
        name: COORDINATED_HUNT.loot.name,
        tags: Array.from(COORDINATED_HUNT.loot.tags),
      });
    }

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "party-opportunity" && entry.causes && entry.causes.includes(COORDINATED_HUNT.id))) {
      const nearby = report.log.find((entry) => entry && entry.type === "combat-victory") || report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 96,
        time: nearby && nearby.time || "",
        type: "party-opportunity",
        text: "ミラが逃げ道の足跡を読み、エドが正面から群れを追い込んだ。二人だから仕留められた先導狼の毛皮を持ち帰る。",
        causes: [COORDINATED_HUNT.id, "tracker", "strong", "hunt"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function persistPartyOpportunityReward(state, report) {
    if (!state || !report || !report.partyOpportunity || !Array.isArray(report.loot)) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    const rewards = report.loot.filter((item) => item && Array.isArray(item.tags) && item.tags.includes("party-opportunity"));
    for (const item of rewards) {
      if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
    }
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__partyOpportunitiesInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithPartyOpportunities(expedition, state) {
      return applyCoordinatedHunt(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithPartyOpportunities(state, report) {
      const applied = baseApplyReport(state, report);
      return persistPartyOpportunityReward(applied, report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithPartyOpportunities(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyCoordinatedHunt(advanced.report, expedition);
        persistPartyOpportunityReward(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__partyOpportunitiesInstalled = true;
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
    COORDINATED_HUNT,
    sortedCompanionIds,
    qualifiesForCoordinatedHunt,
    applyCoordinatedHunt,
    persistPartyOpportunityReward,
    installSystemHooks,
    install,
  };
});
