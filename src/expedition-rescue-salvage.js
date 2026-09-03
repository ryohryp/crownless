(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionRescueSalvage = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionRescueSalvage() {
  "use strict";

  const RESCUE_SALVAGE_ID = "rescue-greedy-salvage";
  const RESCUE_SALVAGE_LOOT_ID = "missing-companion-pack";

  function qualifies(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && inputs.rescueTargetId
      && inputs.policyId === "greedy"
      && report.outcome === "success"
      && report.rescueResolved === true
    );
  }

  function decorateReport(report, expedition) {
    if (!report || !expedition || !expedition.inputs || !expedition.inputs.rescueTargetId) return report;
    report.rescueSalvaged = qualifies(report, expedition);
    if (!report.rescueSalvaged) return report;

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === RESCUE_SALVAGE_LOOT_ID)) {
      report.loot.push({ id: RESCUE_SALVAGE_LOOT_ID, name: "失踪者の置き荷", count: 1 });
    }

    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((item) => item && item.type === "rescue-salvage" && Array.isArray(item.causes) && item.causes.includes(RESCUE_SALVAGE_ID));
    if (!entry) {
      const rescueEntry = report.log.find((item) => item && item.type === "rescue");
      entry = {
        minute: Number.isFinite(rescueEntry && rescueEntry.minute) ? rescueEntry.minute + 2 : 108,
        time: rescueEntry && rescueEntry.time || "",
        type: "rescue-salvage",
        text: "仲間を見つけたあとも失踪地点を探り、置き去りになっていた荷を回収した。危険な滞在を延ばしたぶん、持ち帰る物が増えた。",
        causes: [RESCUE_SALVAGE_ID, RESCUE_SALVAGE_LOOT_ID, "greedy"],
      };
      report.log.push(entry);
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    report.notableEvent = entry;
    return report;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__rescueSalvageInstalled) return Boolean(system);
    if (!system.__rescueLoopInstalled) return false;

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithRescueSalvage(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithRescueSalvage(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) decorateReport(advanced.report, expedition);
      return advanced;
    };

    system.__rescueSalvageInstalled = true;
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
    RESCUE_SALVAGE_ID,
    RESCUE_SALVAGE_LOOT_ID,
    qualifies,
    decorateReport,
    installSystemHooks,
    install,
  };
});