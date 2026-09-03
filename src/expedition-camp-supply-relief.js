(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionCampSupplyRelief = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createCampSupplyRelief() {
  "use strict";

  const SUPPLY_ID = "abandoned-camp-supplies";
  const SUPPLY_EQUIPMENT = Object.freeze({
    id: SUPPLY_ID,
    name: "野営跡の補給品",
    tags: Object.freeze(["supply", "fatigue-relief", "consumable"]),
  });
  const RELIEVED_RECOVERY_MS = 2 * 60 * 1000;

  function reportContainsSupply(report) {
    return Boolean(report && report.outcome === "success" && Array.isArray(report.loot)
      && report.loot.some((item) => item && item.id === SUPPLY_ID));
  }

  function unlockSupplyEquipment(state, report) {
    if (!state || !reportContainsSupply(report)) return state;
    if (!Array.isArray(state.equipment)) state.equipment = [];
    if (!state.equipment.some((item) => item && item.id === SUPPLY_ID)) {
      state.equipment.push({ id: SUPPLY_EQUIPMENT.id, name: SUPPLY_EQUIPMENT.name, tags: Array.from(SUPPLY_EQUIPMENT.tags) });
    }
    return state;
  }

  function qualifiesForRelief(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && ["success", "early-return"].includes(report.outcome)
      && inputs.pace === "forced"
      && Array.isArray(inputs.equipmentIds)
      && inputs.equipmentIds.includes(SUPPLY_ID)
      && Array.isArray(report.forcedMarchFatigueIds)
      && report.forcedMarchFatigueIds.length
    );
  }

  function decorateReport(report, expedition) {
    if (!qualifiesForRelief(report, expedition)) return report;
    report.forcedMarchSupplyRelief = {
      equipmentId: SUPPLY_ID,
      recoveryMs: RELIEVED_RECOVERY_MS,
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "forced-march-supply-relief")) {
      report.log.push({
        minute: 110,
        time: "",
        type: "forced-march-supply-relief",
        text: "野営跡の補給品を使い切り、強行軍の疲労を抑えた。休養は約2分で済みそうだ。",
        causes: ["forced-march", SUPPLY_ID, "fatigue-relief"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function consumeOneSupply(state) {
    if (!state) return state;
    if (Array.isArray(state.securedLoot)) {
      const index = state.securedLoot.findIndex((item) => item && item.id === SUPPLY_ID);
      if (index >= 0) state.securedLoot.splice(index, 1);
    }
    const stillOwned = Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === SUPPLY_ID);
    if (!stillOwned && Array.isArray(state.equipment)) {
      state.equipment = state.equipment.filter((item) => !item || item.id !== SUPPLY_ID);
    }
    return state;
  }

  function applySupplyRelief(state, report) {
    if (!state || !report || !report.forcedMarchSupplyRelief) return state;
    const completedAt = Number.isFinite(Number(report.completedAt)) ? Number(report.completedAt) : Date.now();
    const targetUntil = completedAt + RELIEVED_RECOVERY_MS;
    const ids = new Set(Array.isArray(report.forcedMarchFatigueIds) ? report.forcedMarchFatigueIds : []);
    if (Array.isArray(state.companions)) {
      for (const companion of state.companions) {
        if (!companion || !ids.has(companion.id) || companion.condition !== "recovering") continue;
        const currentUntil = Number(companion.recoveryUntil);
        if (!Number.isFinite(currentUntil) || currentUntil > targetUntil) companion.recoveryUntil = targetUntil;
      }
    }
    consumeOneSupply(state);
    report.forcedMarchSupplyConsumed = true;
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    stored.forcedMarchSupplyRelief = report.forcedMarchSupplyRelief;
    stored.forcedMarchSupplyConsumed = report.forcedMarchSupplyConsumed;
    stored.log = report.log;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    const forcedMarch = root && root.CrownlessExpeditionForcedMarch;
    const campfire = root && root.CrownlessExpeditionCampfireObjectives;
    if (!system || !forcedMarch || !campfire || !system.__forcedMarchInstalled) return false;
    if (system.__campSupplyReliefInstalled) return true;

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithCampSupplyRelief(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithCampSupplyRelief(state, report) {
      const wasApplied = Boolean(state && Array.isArray(state.appliedExpeditionIds) && state.appliedExpeditionIds.includes(report && report.expeditionId));
      const applied = baseApplyReport(state, report);
      if (!wasApplied) {
        unlockSupplyEquipment(applied, report);
        applySupplyRelief(applied, report);
      }
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithCampSupplyRelief(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const wasApplied = Boolean(state && Array.isArray(state.appliedExpeditionIds) && expedition && state.appliedExpeditionIds.includes(expedition.id));
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        if (!wasApplied) {
          unlockSupplyEquipment(advanced.state, advanced.report);
          applySupplyRelief(advanced.state, advanced.report);
        }
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__campSupplyReliefInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      if (!installSystemHooks(root) && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return {
    SUPPLY_ID,
    SUPPLY_EQUIPMENT,
    RELIEVED_RECOVERY_MS,
    reportContainsSupply,
    unlockSupplyEquipment,
    qualifiesForRelief,
    decorateReport,
    consumeOneSupply,
    applySupplyRelief,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});