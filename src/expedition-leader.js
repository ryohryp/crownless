(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionLeader = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionLeader() {
  "use strict";

  const LEADERS = Object.freeze({
    mira: Object.freeze({ id: "mira", name: "ミラ", objectiveId: "explore" }),
    ed: Object.freeze({ id: "ed", name: "エド", objectiveId: "hunt" }),
    sella: Object.freeze({ id: "sella", name: "セラ", objectiveId: "scavenge" }),
  });

  function partyIds(expedition) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.companionIds)
      ? expedition.inputs.companionIds.filter(Boolean)
      : [];
    return Array.from(new Set(ids));
  }

  function leaderFor(expedition) {
    const ids = partyIds(expedition);
    const leaderId = expedition && expedition.inputs && expedition.inputs.leaderId;
    if (ids.length !== 2 || !leaderId || !ids.includes(leaderId)) return null;
    return LEADERS[leaderId] || null;
  }

  function hasCombatVictory(report) {
    if (report && report.combat && Array.isArray(report.combat.encounters)) {
      if (report.combat.encounters.some((encounter) => encounter && encounter.result === "victory")) return true;
    }
    return Boolean(report && Array.isArray(report.log) && report.log.some((entry) => entry && entry.type === "combat-victory"));
  }

  function qualifies(report, expedition, leader) {
    if (!report || !expedition || !leader || report.outcome !== "success") return false;
    if (expedition.inputs.objective !== leader.objectiveId) return false;
    if (leader.id === "ed" && !hasCombatVictory(report)) return false;
    return true;
  }

  function ensureLog(report) {
    if (!Array.isArray(report.log)) report.log = [];
    return report.log;
  }

  function addLeaderLog(report, leader, text, causes) {
    const log = ensureLog(report);
    if (log.some((entry) => entry && entry.type === "leader-outcome" && entry.causes && entry.causes.includes(`leader:${leader.id}`))) return;
    const nearby = log.find((entry) => entry && entry.type === "combat-victory") || log.at(-1);
    log.push({
      minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 106,
      time: nearby && nearby.time || "",
      type: "leader-outcome",
      text,
      causes: [`leader:${leader.id}`, `objective:${leader.objectiveId}`, ...causes],
    });
    log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
  }

  function applyMiraExplore(report, leader) {
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    const clue = {
      id: `leader-route-${report.destinationId}`,
      name: "ミラが見抜いた帰路の抜け道",
      kind: "leader-route-clue",
      sourceDestinationId: report.destinationId,
    };
    if (!report.discoveries.some((item) => item && item.id === clue.id)) report.discoveries.push(clue);
    addLeaderLog(report, leader, "隊長のミラが地形の癖を読み、次の遠征でも使える帰路の抜け道を記録した。", [clue.id, "tracker", "woodsman"]);
  }

  function applyEdHunt(report, leader) {
    if (!Array.isArray(report.loot)) report.loot = [];
    const encounter = report.combat && Array.isArray(report.combat.encounters)
      ? report.combat.encounters.find((item) => item && item.result === "victory")
      : null;
    const trophy = {
      id: `leader-hunt-trophy-${report.destinationId}`,
      name: `${encounter && encounter.encounterName || "獲物"}の先導討伐証`,
      tags: ["trophy", "valuable", "leader-outcome"],
    };
    if (!report.loot.some((item) => item && item.id === trophy.id)) report.loot.push(trophy);
    addLeaderLog(report, leader, `隊長のエドが先頭に立って退路を断ち、${trophy.name}を確保した。`, [trophy.id, "brave", "strong"]);
  }

  function applySellaScavenge(report, leader) {
    if (!Array.isArray(report.loot)) report.loot = [];
    const cache = {
      id: `leader-scavenge-cache-${report.destinationId}`,
      name: "セラが見落とさなかった隠し包み",
      tags: ["valuable", "leader-outcome"],
    };
    if (!report.loot.some((item) => item && item.id === cache.id)) report.loot.push(cache);
    addLeaderLog(report, leader, "隊長のセラが帰路につく直前まで目を光らせ、瓦礫の陰から隠し包みを拾い上げた。", [cache.id, "keen-eye", "greedy"]);
  }

  function applyLeaderOutcome(report, expedition) {
    const leader = leaderFor(expedition);
    if (!report || !leader) return report;
    report.leaderId = leader.id;
    report.leaderName = leader.name;
    if (!qualifies(report, expedition, leader)) return report;

    report.leaderOutcome = { leaderId: leader.id, objectiveId: leader.objectiveId };
    if (leader.id === "mira") applyMiraExplore(report, leader);
    else if (leader.id === "ed") applyEdHunt(report, leader);
    else if (leader.id === "sella") applySellaScavenge(report, leader);
    return report;
  }

  function persistLeaderRewards(state, report) {
    if (!state || !report || !report.leaderOutcome) return state;
    if (Array.isArray(report.loot)) {
      if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
      for (const item of report.loot.filter((loot) => loot && Array.isArray(loot.tags) && loot.tags.includes("leader-outcome"))) {
        if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
          state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
        }
      }
    }
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__leaderOutcomesInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithLeaderOutcome(expedition, state) {
      return applyLeaderOutcome(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithLeaderOutcome(state, report) {
      return persistLeaderRewards(baseApplyReport(state, report), report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithLeaderOutcome(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyLeaderOutcome(advanced.report, expedition);
        persistLeaderRewards(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__leaderOutcomesInstalled = true;
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
    LEADERS,
    partyIds,
    leaderFor,
    hasCombatVictory,
    qualifies,
    applyLeaderOutcome,
    persistLeaderRewards,
    installSystemHooks,
    install,
  };
});
