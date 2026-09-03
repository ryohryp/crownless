(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionFollowupDestinations = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionFollowupDestinations() {
  "use strict";

  const FOLLOWUP_PREFIX = "followup:";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function followupDestinationId(sourceDestinationId) {
    const sourceId = cleanText(sourceDestinationId);
    return sourceId ? `${FOLLOWUP_PREFIX}${sourceId}` : "";
  }

  function sourceDestination(state, discovery) {
    const sourceId = cleanText(discovery && discovery.sourceDestinationId);
    if (!sourceId || !state || !Array.isArray(state.destinations)) return null;
    return state.destinations.find((item) => item && item.id === sourceId) || null;
  }

  function buildFollowupDestination(state, report, discovery) {
    if (!report || report.outcome !== "success" || !discovery) return null;
    const source = sourceDestination(state, discovery);
    if (!source || Number(source.followupDepth) >= 1 || source.followupSourceDestinationId) return null;
    const id = followupDestinationId(source.id);
    if (!id) return null;
    return {
      id,
      name: `${cleanText(source.name, "遠征先")}・痕跡の先`,
      family: cleanText(source.family, "forest"),
      dangerTags: Array.isArray(source.dangerTags) ? [...source.dangerTags] : ["unknown"],
      opportunityTags: [...new Set([...(Array.isArray(source.opportunityTags) ? source.opportunityTags : []), "tracks"])],
      durationMs: Math.max(0, Number(source.durationMs) || 0),
      followupDepth: 1,
      followupSourceDestinationId: source.id,
      followupDiscoveryId: cleanText(discovery.id),
    };
  }

  function appendUnlockLog(report, destination) {
    if (!report || !destination) return;
    if (!Array.isArray(report.followupDestinations)) report.followupDestinations = [];
    if (!report.followupDestinations.some((item) => item && item.id === destination.id)) {
      report.followupDestinations.push({ id: destination.id, name: destination.name, sourceDestinationId: destination.followupSourceDestinationId });
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (report.log.some((entry) => entry && entry.type === "followup-unlocked" && entry.causes && entry.causes.includes(destination.id))) return;
    const nearby = report.log.find((entry) => entry && entry.type === "discovery") || report.log.at(-1);
    report.log.push({
      minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 105,
      time: nearby && nearby.time || "",
      type: "followup-unlocked",
      text: `「${destination.name}」を次の遠征先として追えるようになった。`,
      causes: [destination.id, "report discovery", "follow-up"],
    });
    report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
  }

  function unlockFollowupDestinations(state, report) {
    if (!state || !report || report.outcome !== "success" || !Array.isArray(report.discoveries) || !report.discoveries.length) return state;
    if (!Array.isArray(state.destinations)) state.destinations = [];
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];

    for (const discovery of report.discoveries) {
      const candidate = buildFollowupDestination(state, report, discovery);
      if (!candidate) continue;
      let destination = state.destinations.find((item) => item && item.id === candidate.id);
      if (!destination) {
        state.destinations.push(candidate);
        destination = candidate;
      }
      if (!state.discoveredDestinationIds.includes(destination.id)) state.discoveredDestinationIds.push(destination.id);
      appendUnlockLog(report, destination);
    }
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__followupDestinationsInstalled) return Boolean(system);

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithFollowupDestination(state, report) {
      return unlockFollowupDestinations(baseApplyReport(state, report), report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithFollowupDestination(state, nowMs) {
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report) unlockFollowupDestinations(advanced.state, advanced.report);
      return advanced;
    };

    system.__followupDestinationsInstalled = true;
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
    FOLLOWUP_PREFIX,
    followupDestinationId,
    buildFollowupDestination,
    appendUnlockLog,
    unlockFollowupDestinations,
    installSystemHooks,
    install,
  };
});
