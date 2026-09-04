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
  const BANDIT_PURSUIT_ID = "bandit-greedy-pursuit";
  const BANDIT_PURSUIT_LOOT_ID = "bandit-provision-pouch";
  const BANDIT_ALERT_DESTINATION_ID = `${BANDIT_DESTINATION_ID}:alerted`;
  const BANDIT_ALERT_CAUSE_ID = "bandit-alerted-after-retreat";
  const BANDIT_ALERT_CAUTIOUS_DESTINATION_ID = `${BANDIT_ALERT_DESTINATION_ID}:blind-route`;
  const BANDIT_ALERT_GREEDY_DESTINATION_ID = `${BANDIT_ALERT_DESTINATION_ID}:supply-trail`;

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

  function isSuccessfulBandit(report, expedition, policyId) {
    const inputs = expedition && expedition.inputs;
    const destinationId = inputs && inputs.destinationId || report && report.destinationId;
    return Boolean(report && report.outcome === "success" && inputs && inputs.policyId === policyId && destinationId === BANDIT_DESTINATION_ID);
  }

  function isCautiousBandit(report, expedition) {
    return isSuccessfulBandit(report, expedition, "cautious");
  }

  function isGreedyBandit(report, expedition) {
    return isSuccessfulBandit(report, expedition, "greedy");
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

  function applyCautiousBanditPolicy(report, expedition) {
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

  function applyGreedyBanditPolicy(report, expedition) {
    if (!isGreedyBandit(report, expedition)) return report;
    if (!report.signalEncounter || report.signalEncounter.kind !== "bandit-ambush") return report;

    report.signalEncounter.approach = { id: BANDIT_PURSUIT_ID, policyId: "greedy", outcome: "pursued" };
    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === BANDIT_PURSUIT_LOOT_ID)) {
      report.loot.push({ id: BANDIT_PURSUIT_LOOT_ID, name: "盗賊の補給袋", count: 1 });
    }
    if (!Array.isArray(report.log)) report.log = [];
    const encounter = report.log.find((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes("roadside-bandit-ambush"));
    if (encounter) {
      encounter.text = "街道の物陰から盗賊が現れた。遠征隊は撃退したが、強欲方針のまま逃げる一人を林際まで追った。";
      encounter.causes = Array.from(new Set([...(encounter.causes || []), BANDIT_PURSUIT_ID, "greedy"]));
    }
    if (!report.log.some((entry) => entry && entry.type === "signal-pursuit" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_PURSUIT_ID))) {
      const minute = Number.isFinite(encounter && encounter.minute) ? encounter.minute + 2 : 92;
      report.log.push({
        minute,
        time: encounter && encounter.time || "",
        type: "signal-pursuit",
        text: "退路へ踏み込み、盗賊が捨てた補給袋まで回収した。深追いする危険を受け入れたぶん、持ち帰る物が増えた。",
        causes: [BANDIT_PURSUIT_ID, BANDIT_PURSUIT_LOOT_ID, "greedy"]
      });
    }
    report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    report.notableEvent = report.log.find((entry) => entry && entry.type === "signal-pursuit" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_PURSUIT_ID)) || report.notableEvent;
    return report;
  }

  function copyDestination(state, sourceId, id, name, dangerTags, opportunityTags) {
    if (!state || !Array.isArray(state.destinations)) return null;
    const existing = state.destinations.find((item) => item && item.id === id);
    if (existing) return existing;
    const source = state.destinations.find((item) => item && item.id === sourceId) || {};
    const destination = {
      id,
      name,
      family: source.family || "forest",
      dangerTags: Array.from(new Set([...(Array.isArray(source.dangerTags) ? source.dangerTags : ["bandit"]), ...dangerTags])),
      opportunityTags: Array.from(new Set([...(Array.isArray(source.opportunityTags) ? source.opportunityTags : ["road"]), ...opportunityTags])),
      durationMs: Math.max(0, Number(source.durationMs) || 180000),
      banditWorldState: id === BANDIT_ALERT_DESTINATION_ID ? "alerted" : "aftermath"
    };
    state.destinations.push(destination);
    return destination;
  }

  function discoverDestination(state, destination) {
    if (!state || !destination) return;
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(destination.id)) state.discoveredDestinationIds.push(destination.id);
  }

  function retireDestination(state, destinationId) {
    if (!state) return;
    if (Array.isArray(state.destinations)) state.destinations = state.destinations.filter((item) => item && item.id !== destinationId);
    if (Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = state.discoveredDestinationIds.filter((id) => id !== destinationId);
  }

  function addWorldChange(report, id, text, destination, stateName) {
    if (!report) return null;
    if (!Array.isArray(report.worldChanges)) report.worldChanges = [];
    let change = report.worldChanges.find((item) => item && item.id === id);
    if (!change) {
      change = { id, state: stateName, destinationId: destination && destination.id || "", destinationName: destination && destination.name || "" };
      report.worldChanges.push(change);
    }
    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((item) => item && item.type === "world-shift" && Array.isArray(item.causes) && item.causes.includes(id));
    if (!entry) {
      const nearby = report.log.at(-1);
      entry = {
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 111,
        time: nearby && nearby.time || "",
        type: "world-shift",
        text,
        causes: [id, destination && destination.id || "bandit-world"]
      };
      report.log.push(entry);
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = entry;
    return change;
  }

  function applyBanditWorldResponse(state, report) {
    if (!state || !report) return state;
    const destinationId = report.destinationId;
    const outcome = report.outcome;

    if (destinationId === BANDIT_DESTINATION_ID && (outcome === "early-return" || outcome === "failed")) {
      const destination = copyDestination(
        state,
        BANDIT_DESTINATION_ID,
        BANDIT_ALERT_DESTINATION_ID,
        "警戒を固めた盗賊の街道",
        ["bandit", "alerted"],
        ["lookouts", "tracks"]
      );
      discoverDestination(state, destination);
      addWorldChange(
        report,
        BANDIT_ALERT_CAUSE_ID,
        "撤退を見た盗賊は街道の見張りを増やした。「警戒を固めた盗賊の街道」が次の遠征先として残った。",
        destination,
        "alerted"
      );
      return state;
    }

    if (destinationId !== BANDIT_ALERT_DESTINATION_ID || outcome !== "success") return state;

    const policyId = report.policyId || "standard";
    retireDestination(state, BANDIT_ALERT_DESTINATION_ID);
    if (policyId === "cautious") {
      const destination = copyDestination(
        state,
        BANDIT_DESTINATION_ID,
        BANDIT_ALERT_CAUTIOUS_DESTINATION_ID,
        "見張りの死角へ続く脇道",
        ["bandit", "thin-watch"],
        ["route", "intel"]
      );
      discoverDestination(state, destination);
      addWorldChange(
        report,
        "bandit-alert-cautious-branch",
        "見張りの交代を読んで正面衝突を避け、死角へ続く脇道を割り出した。次はこの経路を遠征先として追える。",
        destination,
        "branched"
      );
    } else if (policyId === "greedy") {
      const destination = copyDestination(
        state,
        BANDIT_DESTINATION_ID,
        BANDIT_ALERT_GREEDY_DESTINATION_ID,
        "移動前の盗賊の荷車跡",
        ["bandit", "moving"],
        ["salvage", "tracks"]
      );
      discoverDestination(state, destination);
      addWorldChange(
        report,
        "bandit-alert-greedy-branch",
        "警戒が解ける前に盗賊の荷車を追い、移動途中の荷へ続く跡を掴んだ。次は危険を承知で戦利品を追える。",
        destination,
        "branched"
      );
    } else {
      addWorldChange(
        report,
        "bandit-alert-standard-resolved",
        "警戒線へ正面から踏み込み、街道を押さえていた盗賊を退かせた。警戒中の遠征先は解消された。",
        null,
        "resolved"
      );
    }
    return state;
  }

  function applyBanditPolicy(report, expedition) {
    applyCautiousBanditPolicy(report, expedition);
    return applyGreedyBanditPolicy(report, expedition);
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
    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithBanditWorldResponse(state, report) {
      const applied = baseApplyReport(state, report);
      return applyBanditWorldResponse(applied, report);
    };
    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithBanditPolicy(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyBanditPolicy(advanced.report, expedition);
        applyBanditWorldResponse(advanced.state, advanced.report);
      }
      return advanced;
    };
    system.__banditPolicyInstalled = true;
    loadCampfireObjectives(root);
    return true;
  }

  return {
    BANDIT_DESTINATION_ID,
    BANDIT_REPEL_AID_ID,
    BANDIT_SCOUT_ID,
    BANDIT_ROUTE_DISCOVERY_ID,
    BANDIT_PURSUIT_ID,
    BANDIT_PURSUIT_LOOT_ID,
    BANDIT_ALERT_DESTINATION_ID,
    BANDIT_ALERT_CAUSE_ID,
    BANDIT_ALERT_CAUTIOUS_DESTINATION_ID,
    BANDIT_ALERT_GREEDY_DESTINATION_ID,
    isCautiousBandit,
    isGreedyBandit,
    addScoutDiscovery,
    applyCautiousBanditPolicy,
    applyGreedyBanditPolicy,
    applyBanditWorldResponse,
    applyBanditPolicy,
    loadCampfireObjectives,
    install
  };
});