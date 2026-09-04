(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionFleetingLeads = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionFleetingLeads() {
  "use strict";

  const BANDIT_DESTINATION_ID = "world:geo:signal:bandit-ambush";
  const LEAD_PREFIX = "fleeting-lead:";
  const LEAD_PROFILES = Object.freeze([
    Object.freeze({
      key: "scout-tracks",
      name: "逃げた斥候の新しい足跡",
      dangerTags: Object.freeze(["bandit", "pursuit"]),
      opportunityTags: Object.freeze(["tracks", "valuable", "fleeting"]),
      reportText: "夜露の上に、逃げた斥候の新しい足跡が残っている。急げば追いつけるが、待てば消える。",
    }),
    Object.freeze({
      key: "dying-watchfire",
      name: "消えかけた見張り火",
      dangerTags: Object.freeze(["bandit"]),
      opportunityTags: Object.freeze(["intel", "route", "fleeting"]),
      reportText: "林の奥で見張り火がまだ細く燻っている。火が消える前なら、連中が使った退路を読めそうだ。",
    }),
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function groupIdFor(report, expedition) {
    const expeditionId = report && report.expeditionId || expedition && expedition.id;
    const sourceId = expedition && expedition.inputs && expedition.inputs.destinationId || report && report.destinationId;
    return expeditionId ? `bandit-aftermath:${expeditionId}` : sourceId ? `bandit-aftermath:${sourceId}` : null;
  }

  function leadId(groupId, key) {
    return groupId && key ? `${LEAD_PREFIX}${key}:${groupId}` : null;
  }

  function isBanditSuccess(report, expedition) {
    const inputs = expedition && expedition.inputs;
    const destinationId = inputs && inputs.destinationId || report && report.destinationId;
    return Boolean(
      report
      && report.outcome === "success"
      && destinationId === BANDIT_DESTINATION_ID
      && report.signalEncounter
      && report.signalEncounter.kind === "bandit-ambush"
    );
  }

  function decorateReport(report, expedition) {
    if (!isBanditSuccess(report, expedition)) return report;
    const groupId = groupIdFor(report, expedition);
    if (!groupId) return report;
    if (report.fleetingLeads && report.fleetingLeads.groupId === groupId) return report;

    const sourceDestinationId = expedition && expedition.inputs && expedition.inputs.destinationId || report.destinationId;
    const leads = LEAD_PROFILES.map((profile) => ({
      id: leadId(groupId, profile.key),
      key: profile.key,
      name: profile.name,
    }));

    report.fleetingLeads = {
      groupId,
      sourceDestinationId,
      leadIds: leads.map((lead) => lead.id),
    };

    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    leads.forEach((lead) => {
      if (!report.discoveries.some((item) => item && item.id === lead.id)) {
        report.discoveries.push({
          id: lead.id,
          name: lead.name,
          kind: "fleeting-lead",
          sourceDestinationId,
          groupId,
        });
      }
    });

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "fleeting-leads" && Array.isArray(entry.causes) && entry.causes.includes(groupId))) {
      const nearby = report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 112,
        time: nearby && nearby.time || "",
        type: "fleeting-leads",
        text: "帰路で二つの新しい痕跡を見つけた。逃げた斥候の足跡か、消えかけた見張り火か。次の遠征で追えるのは一方だけだ。別の遠征を先に出せば、どちらも失われる。",
        causes: [groupId, ...leads.map((lead) => lead.id)],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "fleeting-leads" && Array.isArray(entry.causes) && entry.causes.includes(groupId)) || report.notableEvent;
    return report;
  }

  function profileForLeadId(id) {
    return LEAD_PROFILES.find((profile) => String(id || "").startsWith(`${LEAD_PREFIX}${profile.key}:`)) || null;
  }

  function unlockLeads(state, report) {
    const fleeting = report && report.fleetingLeads;
    if (!state || !fleeting || !Array.isArray(fleeting.leadIds)) return [];
    if (!Array.isArray(state.destinations)) state.destinations = [];
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    const source = state.destinations.find((item) => item && item.id === fleeting.sourceDestinationId) || {};
    const unlocked = [];

    fleeting.leadIds.forEach((id) => {
      const profile = profileForLeadId(id);
      if (!profile) return;
      let destination = state.destinations.find((item) => item && item.id === id);
      if (!destination) {
        destination = {
          id,
          name: profile.name,
          family: source.family || "forest",
          dangerTags: Array.from(new Set([...(Array.isArray(source.dangerTags) ? source.dangerTags : []), ...profile.dangerTags])),
          opportunityTags: Array.from(new Set([...(Array.isArray(source.opportunityTags) ? source.opportunityTags : []), ...profile.opportunityTags])),
          durationMs: Math.max(60000, Math.round((Number(source.durationMs) || 180000) * 0.6)),
          fleetingLead: {
            groupId: fleeting.groupId,
            sourceDestinationId: fleeting.sourceDestinationId,
            key: profile.key,
          },
        };
        state.destinations.push(destination);
      }
      if (!state.discoveredDestinationIds.includes(id)) state.discoveredDestinationIds.push(id);
      unlocked.push(destination);
    });

    report.fleetingLeadsApplied = true;
    return unlocked;
  }

  function pendingLeads(state) {
    return state && Array.isArray(state.destinations)
      ? state.destinations.filter((item) => item && item.fleetingLead && item.fleetingLead.groupId)
      : [];
  }

  function retireLeadIds(state, ids) {
    const removing = new Set((ids || []).filter(Boolean));
    if (!state || removing.size === 0) return state;
    if (Array.isArray(state.destinations)) state.destinations = state.destinations.filter((item) => !(item && removing.has(item.id)));
    if (Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = state.discoveredDestinationIds.filter((id) => !removing.has(id));
    return state;
  }

  function applyDispatchExpiry(state, destinationId) {
    const pending = pendingLeads(state);
    if (pending.length === 0) return { state, chosen: null, expiredIds: [] };
    const chosen = pending.find((item) => item.id === destinationId) || null;
    const expiredIds = chosen
      ? pending.filter((item) => item.fleetingLead.groupId === chosen.fleetingLead.groupId && item.id !== chosen.id).map((item) => item.id)
      : pending.map((item) => item.id);
    retireLeadIds(state, expiredIds);
    return { state, chosen, expiredIds };
  }

  function retireResolvedLead(state, report) {
    const destinationId = report && report.destinationId;
    if (!profileForLeadId(destinationId)) return false;
    retireLeadIds(state, [destinationId]);
    return true;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    Object.assign(stored, clone(report));
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__fleetingLeadsInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithFleetingLeads(state, input, nowMs) {
      const requestedDestinationId = input && input.destinationId;
      const prepared = applyDispatchExpiry(state, requestedDestinationId);
      const next = baseDispatch(prepared.state, input, nowMs);
      const activeInputs = next && next.activeExpedition && next.activeExpedition.inputs;
      if (prepared.chosen && activeInputs) {
        activeInputs.fleetingLeadChoice = {
          id: prepared.chosen.id,
          groupId: prepared.chosen.fleetingLead.groupId,
          key: prepared.chosen.fleetingLead.key,
        };
      }
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithFleetingLeads(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithFleetingLeads(state, report) {
      const applied = baseApplyReport(state, report);
      unlockLeads(applied, report);
      retireResolvedLead(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithFleetingLeads(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        unlockLeads(advanced.state, advanced.report);
        retireResolvedLead(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__fleetingLeadsInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const ready = installSystemHooks(root);
      if (!ready && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return {
    BANDIT_DESTINATION_ID,
    LEAD_PREFIX,
    LEAD_PROFILES,
    groupIdFor,
    leadId,
    isBanditSuccess,
    decorateReport,
    profileForLeadId,
    unlockLeads,
    pendingLeads,
    retireLeadIds,
    applyDispatchExpiry,
    retireResolvedLead,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});