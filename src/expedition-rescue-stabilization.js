(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionRescueStabilization = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionRescueStabilization() {
  "use strict";

  const HERB_KIT_ID = "herb-kit";

  function hasHerbKit(expedition) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.equipmentIds)
      ? expedition.inputs.equipmentIds
      : [];
    return ids.includes(HERB_KIT_ID);
  }

  function qualifies(report, expedition) {
    return Boolean(
      report
      && expedition
      && expedition.inputs
      && expedition.inputs.rescueTargetId
      && report.rescueResolved === true
      && report.outcome === "success"
      && hasHerbKit(expedition)
    );
  }

  function decorateReport(report, expedition) {
    if (!report || !expedition || !expedition.inputs || !expedition.inputs.rescueTargetId) return report;
    report.rescueStabilized = qualifies(report, expedition);
    if (!report.rescueStabilized) return report;

    const name = report.rescueCompanionName || expedition.inputs.rescueCompanionName || "仲間";
    const targetId = report.rescueTargetId || expedition.inputs.rescueTargetId;
    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((item) => item && item.type === "rescue" && Array.isArray(item.causes) && item.causes.includes(targetId));
    if (!entry) {
      entry = {
        minute: 106,
        time: "",
        type: "rescue",
        text: `${name}を発見し、薬草包みで応急処置してから灰炉へ連れ帰った。`,
        causes: [targetId, report.rescueCompanionId || expedition.inputs.rescueCompanionId, "rescued", HERB_KIT_ID, "rescue-stabilized"].filter(Boolean),
      };
      report.log.push(entry);
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    } else {
      entry.text = `${name}を発見し、薬草包みで応急処置してから灰炉へ連れ帰った。`;
      entry.causes = Array.from(new Set([...(Array.isArray(entry.causes) ? entry.causes : []), HERB_KIT_ID, "rescue-stabilized"]));
    }
    report.notableEvent = entry;
    return report;
  }

  function applyState(state, report) {
    if (!state || !report || report.rescueResolved !== true || report.rescueStabilized !== true || !report.rescueCompanionId) return state;
    const companion = Array.isArray(state.companions)
      ? state.companions.find((item) => item && item.id === report.rescueCompanionId)
      : null;
    if (companion && companion.condition === "injured") {
      companion.condition = "healthy";
      delete companion.recoveryStartedAt;
      delete companion.recoveryUntil;
    }
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    stored.rescueStabilized = report.rescueStabilized;
    stored.log = report.log;
    stored.notableEvent = report.notableEvent;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__rescueStabilizationInstalled) return Boolean(system);
    if (!system.__rescueLoopInstalled) return false;

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithRescueStabilization(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithRescueStabilization(state, report) {
      const applied = baseApplyReport(state, report);
      applyState(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithRescueStabilization(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        applyState(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__rescueStabilizationInstalled = true;
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
    HERB_KIT_ID,
    hasHerbKit,
    qualifies,
    decorateReport,
    applyState,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});