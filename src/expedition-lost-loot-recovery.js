(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionLostLootRecovery = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionLostLootRecovery() {
  "use strict";

  const RECOVERY_PREFIX = "recovery:";
  const LOSS_CAUSE = "lost-loot-on-retreat";
  const RECOVERY_CAUSE = "lost-loot-recovered";

  function clean(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function recoveryDestinationId(expeditionId) {
    const id = clean(expeditionId);
    return id ? `${RECOVERY_PREFIX}${id}` : "";
  }

  function isRecoveryDestinationId(destinationId) {
    return clean(destinationId).startsWith(RECOVERY_PREFIX);
  }

  function lossEligible(report, expedition) {
    return Boolean(report && expedition && expedition.inputs
      && !isRecoveryDestinationId(expedition.inputs.destinationId)
      && ["early-return", "failed"].includes(report.outcome)
      && Array.isArray(report.loot) && report.loot.length > 0 && !report.lostLoot);
  }

  function decorateLoss(report, expedition) {
    if (!lossEligible(report, expedition)) return report;
    const item = report.loot.pop();
    if (!item) return report;
    const recoveryId = recoveryDestinationId(report.expeditionId);
    report.lostLoot = {
      ...item,
      sourceExpeditionId: report.expeditionId,
      sourceDestinationId: report.destinationId,
      recoveryDestinationId: recoveryId,
    };
    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((event) => event && event.type === "loot-lost" && Array.isArray(event.causes) && event.causes.includes(recoveryId));
    if (!entry) {
      const returnEntry = report.log.find((event) => event && event.type === "return") || report.log.at(-1);
      entry = {
        minute: Math.max(0, (Number(returnEntry && returnEntry.minute) || 110) - 1),
        time: returnEntry && returnEntry.time || "",
        type: "loot-lost",
        text: `撤退の途中で「${clean(item.name, "戦利品")}」を落とした。痕跡は残っており、取り戻しに戻れる。`,
        causes: [LOSS_CAUSE, recoveryId, clean(item.id, "lost-item")],
      };
      report.log.push(entry);
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = entry;
    return report;
  }

  function buildRecoveryDestination(state, report) {
    const lost = report && report.lostLoot;
    if (!state || !lost || !lost.recoveryDestinationId) return null;
    const source = Array.isArray(state.destinations) ? state.destinations.find((item) => item && item.id === lost.sourceDestinationId) : null;
    if (!source) return null;
    return {
      id: lost.recoveryDestinationId,
      name: `${clean(source.name, "遠征先")}・落とした荷の痕跡`,
      family: clean(source.family, "forest"),
      dangerTags: Array.isArray(source.dangerTags) ? [...source.dangerTags] : ["unknown"],
      opportunityTags: [...new Set([...(Array.isArray(source.opportunityTags) ? source.opportunityTags : []), "salvage", "tracks"])],
      durationMs: Math.max(0, Number(source.durationMs) || 0),
      recoverySourceDestinationId: source.id,
      recoverySourceExpeditionId: report.expeditionId,
      recoveryItem: {
        id: clean(lost.id, "lost-item"),
        name: clean(lost.name, "失った戦利品"),
        tags: Array.isArray(lost.tags) ? [...lost.tags] : [],
        ...(Number.isFinite(lost.count) ? { count: lost.count } : {}),
      },
    };
  }

  function registerRecovery(state, report) {
    if (!state || !report || !report.lostLoot) return state;
    if (!Array.isArray(state.destinations)) state.destinations = [];
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    const candidate = buildRecoveryDestination(state, report);
    if (!candidate) return state;
    if (!state.destinations.some((item) => item && item.id === candidate.id)) state.destinations.push(candidate);
    if (!state.discoveredDestinationIds.includes(candidate.id)) state.discoveredDestinationIds.push(candidate.id);
    if (!Array.isArray(report.recoveryDestinations)) report.recoveryDestinations = [];
    if (!report.recoveryDestinations.some((item) => item && item.id === candidate.id)) {
      report.recoveryDestinations.push({ id: candidate.id, name: candidate.name, itemId: candidate.recoveryItem.id, itemName: candidate.recoveryItem.name });
    }
    return state;
  }

  function recoveryDestination(state, expedition) {
    const destinationId = expedition && expedition.inputs && expedition.inputs.destinationId;
    if (!isRecoveryDestinationId(destinationId) || !state || !Array.isArray(state.destinations)) return null;
    return state.destinations.find((item) => item && item.id === destinationId && item.recoveryItem) || null;
  }

  function decorateRecovery(report, expedition, state) {
    const destination = recoveryDestination(state, expedition);
    if (!report || !destination) return report;
    report.recoveryAttempt = true;
    report.recoveryDestinationId = destination.id;
    report.recoverySourceExpeditionId = destination.recoverySourceExpeditionId;
    report.recoveryItem = { ...destination.recoveryItem };
    report.recoverySucceeded = report.outcome === "success";
    if (!report.recoverySucceeded) return report;
    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === destination.recoveryItem.id)) report.loot.push({ ...destination.recoveryItem });
    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((event) => event && event.type === "loot-recovered" && Array.isArray(event.causes) && event.causes.includes(destination.id));
    if (!entry) {
      const returnEntry = report.log.find((event) => event && event.type === "return") || report.log.at(-1);
      entry = {
        minute: Math.max(0, (Number(returnEntry && returnEntry.minute) || 110) - 2),
        time: returnEntry && returnEntry.time || "",
        type: "loot-recovered",
        text: `撤退時に失った「${clean(destination.recoveryItem.name, "戦利品")}」を痕跡の先で見つけ、今度こそ持ち帰った。`,
        causes: [RECOVERY_CAUSE, destination.id, clean(destination.recoveryItem.id, "lost-item")],
      };
      report.log.push(entry);
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = entry;
    return report;
  }

  function reconcileSecuredLoot(state, report) {
    if (!state || !report) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    if (report.lostLoot && report.expeditionId) {
      state.securedLoot = state.securedLoot.filter((item) => !(item && item.sourceExpeditionId === report.expeditionId && item.id === report.lostLoot.id));
    }
    if (report.recoverySucceeded === true && report.recoveryItem && report.expeditionId) {
      const exists = state.securedLoot.some((item) => item && item.sourceExpeditionId === report.expeditionId && item.id === report.recoveryItem.id);
      if (!exists) state.securedLoot.push({ ...report.recoveryItem, sourceExpeditionId: report.expeditionId });
    }
    return state;
  }

  function cleanupRecoveredDestination(state, report) {
    if (!state || !report || report.recoverySucceeded !== true || !report.recoveryDestinationId) return state;
    if (Array.isArray(state.destinations)) state.destinations = state.destinations.filter((item) => !item || item.id !== report.recoveryDestinationId);
    if (Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = state.discoveredDestinationIds.filter((id) => id !== report.recoveryDestinationId);
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return state;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return state;
    Object.assign(stored, {
      loot: report.loot,
      lostLoot: report.lostLoot,
      recoveryDestinations: report.recoveryDestinations,
      recoveryAttempt: report.recoveryAttempt,
      recoveryDestinationId: report.recoveryDestinationId,
      recoverySourceExpeditionId: report.recoverySourceExpeditionId,
      recoveryItem: report.recoveryItem,
      recoverySucceeded: report.recoverySucceeded,
      log: report.log,
      notableEvent: report.notableEvent,
    });
    return state;
  }

  function applySideEffects(state, report) {
    registerRecovery(state, report);
    reconcileSecuredLoot(state, report);
    cleanupRecoveredDestination(state, report);
    syncStoredReport(state, report);
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__lostLootRecoveryInstalled) return Boolean(system);
    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithLostLootRecovery(expedition, state) {
      const report = baseResolve(expedition, state);
      decorateRecovery(report, expedition, state);
      decorateLoss(report, expedition);
      return report;
    };
    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithLostLootRecovery(state, report) {
      return applySideEffects(baseApplyReport(state, report), report);
    };
    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithLostLootRecovery(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateRecovery(advanced.report, expedition, state);
        decorateLoss(advanced.report, expedition);
        applySideEffects(advanced.state, advanced.report);
      }
      return advanced;
    };
    system.__lostLootRecoveryInstalled = true;
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
    RECOVERY_PREFIX, LOSS_CAUSE, RECOVERY_CAUSE,
    recoveryDestinationId, isRecoveryDestinationId, lossEligible, decorateLoss,
    buildRecoveryDestination, registerRecovery, recoveryDestination, decorateRecovery,
    reconcileSecuredLoot, cleanupRecoveredDestination, syncStoredReport, applySideEffects,
    installSystemHooks, install,
  };
});
