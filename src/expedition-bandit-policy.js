(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionBanditPolicy = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionBanditPolicy() {
  "use strict";

  const BANDIT_DESTINATION_ID = "world:geo:signal:bandit-ambush";
  const BANDIT_REPEL_AID_ID = "bandit-repel-aid";
  const BANDIT_SCOUT_ID = "bandit-cautious-scout";
  const BANDIT_ROUTE_DISCOVERY_ID = "bandit-cautious-scout-route";

  function loadCampfireObjectives(root) {
    if (!root || !root.document || root.CrownlessExpeditionCampfireObjectives) return Boolean(root && root.document);
    const src = "src/expedition-campfire-objectives.js";
    if (root.document.querySelector(`script[src="${src}"]`)) return true;
    const script = root.document.createElement("script");
    script.src = src;
    script.defer = true;
    root.document.head.appendChild(script);
    return true;
  }

  function isCautiousBandit(report, expedition) {
    const inputs = expedition && expedition.inputs;
    const destinationId = inputs && inputs.destinationId || report && report.destinationId;
    return Boolean(report && report.outcome === "success" && inputs && inputs.policyId === "cautious" && destinationId === BANDIT_DESTINATION_ID);
  }

  function removeRepelReward(report) {
    const aid = report && report.signalEncounter && report.signalEncounter.aid;
    if (!aid || aid.id !== BANDIT_REPEL_AID_ID) return false;
    delete report.signalEncounter.aid;
    if (Array.isArray(report.loot)) {
      const index = report.loot.findIndex((item) => item && item.id === "iron-scrap" && Number(item.count || 1) <= 1);
      if (index >= 0) report.loot.splice(index, 1);
    }
    return true;
  }

  function addScoutDiscovery(report, sourceDestinationId) {
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    const existing = report.discoveries.find((item) => item && item.id === BANDIT_ROUTE_DISCOVERY_ID);
    if (existing) return existing;
    const discovery = {
      id: BANDIT_ROUTE_DISCOVERY_ID,
      name: "見張りの薄い迂回路",
      kind: "route",
      sourceDestinationId,
      detail: "盗賊の見張りは街道側へ偏っている。林沿いの薄い見張りを抜ける経路を次の遠征で追える。"
    };
    report.discoveries.push(discovery);
    return discovery;
  }

  function applyBanditPolicy(report, expedition) {
    if (!isCautiousBandit(report, expedition)) return report;
    if (!report.signalEncounter || report.signalEncounter.kind !== "bandit-ambush") return report;

    removeRepelReward(report);
    report.signalEncounter.approach = { id: BANDIT_SCOUT_ID, policyId: "cautious", outcome: "scouted" };
    if (!Array.isArray(report.log)) report.log = [];
    const encounter = report.log.find((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes("roadside-bandit-ambush"));
    if (encounter) {
      encounter.text = "物陰の気配は街道を狙う盗賊だった。慎重方針の遠征隊は正面から交戦せず、人数と見張り位置を確かめて引き返した。";
      encounter.causes = Array.from(new Set([...(encounter.causes || []), BANDIT_SCOUT_ID, "cautious"]));
    }
    if (!report.log.some((entry) => entry && entry.type === "signal-intel" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_SCOUT_ID))) {
      const minute = Number.isFinite(encounter && encounter.minute) ? encounter.minute + 1 : 91;
      report.log.push({ minute, time: encounter && encounter.time || "", type: "signal-intel", text: "盗賊は少人数で、街道側に見張りを置いている。林沿いは手薄だ。次は正面討伐か、見張りの薄い迂回路を追うか選べる。", causes: [BANDIT_SCOUT_ID, "bandit-intel", "cautious"] });
    }
    addScoutDiscovery(report, expedition.inputs.destinationId || report.destinationId);
    const repelIndex = report.log.findIndex((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_REPEL_AID_ID));
    if (repelIndex >= 0) report.log.splice(repelIndex, 1);
    report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    report.notableEvent = report.log.find((entry) => entry && entry.type === "signal-intel" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_SCOUT_ID)) || report.notableEvent;
    return report;
  }

  function install(root, attempt = 0) {
    const system = root && root.CrownlessExpeditionSystem;
    const signals = root && root.CrownlessExpeditionSignalEncounters;
    if (!system || !signals || !system.__signalEncountersInstalled) {
      if (root && typeof root.setTimeout === "function" && attempt < 20) root.setTimeout(() => install(root, attempt + 1), 0);
      return false;
    }
    if (system.__banditPolicyInstalled) {
      loadCampfireObjectives(root);
      return true;
    }
    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithBanditPolicy(expedition, state) { return applyBanditPolicy(baseResolve(expedition, state), expedition); };
    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithBanditPolicy(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) applyBanditPolicy(advanced.report, expedition);
      return advanced;
    };
    system.__banditPolicyInstalled = true;
    loadCampfireObjectives(root);
    return true;
  }

  return { BANDIT_DESTINATION_ID, BANDIT_REPEL_AID_ID, BANDIT_SCOUT_ID, BANDIT_ROUTE_DISCOVERY_ID, isCautiousBandit, addScoutDiscovery, applyBanditPolicy, loadCampfireObjectives, install };
});