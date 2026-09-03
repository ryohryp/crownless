(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionCampfireObjectives = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createCampfireObjectives() {
  "use strict";

  const CAMPFIRE_DESTINATION_ID = "world:geo:signal:suspicious-campfire";
  const CAMPFIRE_AID_ID = "campfire-investigate-aid";
  const STONE_ID = "ancient-stone-fragment";
  const SCAVENGE_ID = "campfire-scavenge-cache";
  const HUNT_ID = "campfire-track-party";
  const SUPPLY_ID = "abandoned-camp-supplies";

  function isCampfire(report, expedition) {
    const inputs = expedition && expedition.inputs;
    const destinationId = inputs && inputs.destinationId || report && report.destinationId;
    return Boolean(report && report.outcome === "success" && inputs && destinationId === CAMPFIRE_DESTINATION_ID && report.signalEncounter && report.signalEncounter.kind === "suspicious-campfire");
  }

  function removeLoot(report, id) {
    if (!Array.isArray(report && report.loot)) return;
    report.loot = report.loot.filter((item) => !(item && item.id === id));
  }

  function removeCampfireAidLog(report) {
    if (!Array.isArray(report && report.log)) return;
    report.log = report.log.filter((entry) => !(entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(CAMPFIRE_AID_ID)));
  }

  function encounterEntry(report) {
    return Array.isArray(report && report.log)
      ? report.log.find((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes("roadside-suspicious-campfire"))
      : null;
  }

  function addUniqueLog(report, type, id, text) {
    if (!Array.isArray(report.log)) report.log = [];
    const existing = report.log.find((entry) => entry && entry.type === type && Array.isArray(entry.causes) && entry.causes.includes(id));
    if (existing) return existing;
    const encounter = encounterEntry(report);
    const entry = {
      minute: Number.isFinite(encounter && encounter.minute) ? encounter.minute + 1 : 91,
      time: encounter && encounter.time || "",
      type,
      text,
      causes: [id, "suspicious-campfire"]
    };
    report.log.push(entry);
    return entry;
  }

  function applyCampfireObjective(report, expedition) {
    if (!isCampfire(report, expedition)) return report;
    const objective = expedition.inputs.objective || expedition.inputs.objectiveId || "explore";
    if (objective === "explore") return report;

    removeLoot(report, STONE_ID);
    removeCampfireAidLog(report);
    if (report.signalEncounter && report.signalEncounter.aid && report.signalEncounter.aid.id === CAMPFIRE_AID_ID) delete report.signalEncounter.aid;

    const encounter = encounterEntry(report);
    if (objective === "scavenge") {
      if (encounter) encounter.text = "暗がりの火影へ着いた遠征隊は、主の消えた野営跡を見つけた。探索より回収を優先し、使えそうな残置物を選り分けた。";
      if (!Array.isArray(report.loot)) report.loot = [];
      if (!report.loot.some((item) => item && item.id === SUPPLY_ID)) report.loot.push({ id: SUPPLY_ID, name: "野営跡の補給品", count: 1 });
      report.signalEncounter.approach = { id: SCAVENGE_ID, objective: "scavenge", outcome: "supplies-recovered" };
      report.notableEvent = addUniqueLog(report, "signal-salvage", SCAVENGE_ID, "灰の下や荷包を探し、まだ使える補給品を持ち帰った。遺構の手掛かりを追う時間は使わなかった。");
    } else if (objective === "hunt") {
      removeLoot(report, SUPPLY_ID);
      if (encounter) encounter.text = "暗がりの火影へ着いた遠征隊は、消えかけた焚き火と複数人の足跡を見つけた。獲物を探す目的に従い、物資には触れず足跡を追った。";
      report.signalEncounter.approach = { id: HUNT_ID, objective: "hunt", outcome: "trail-learned" };
      report.notableEvent = addUniqueLog(report, "signal-intel", HUNT_ID, "足跡は三、四人ほど。荷を軽くして街道の北側へ移動した形跡がある。次の遠征では追跡を続けるか避ける判断材料になる。");
    }

    if (Array.isArray(report.log)) report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    return report;
  }

  function install(root, attempt = 0) {
    const system = root && root.CrownlessExpeditionSystem;
    const signals = root && root.CrownlessExpeditionSignalEncounters;
    if (!system || !signals || !system.__signalEncountersInstalled) {
      if (root && typeof root.setTimeout === "function" && attempt < 20) root.setTimeout(() => install(root, attempt + 1), 0);
      return false;
    }
    if (system.__campfireObjectivesInstalled) return true;
    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithCampfireObjective(expedition, state) {
      return applyCampfireObjective(baseResolve(expedition, state), expedition);
    };
    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithCampfireObjective(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) applyCampfireObjective(advanced.report, expedition);
      return advanced;
    };
    system.__campfireObjectivesInstalled = true;
    return true;
  }

  return { CAMPFIRE_DESTINATION_ID, STONE_ID, SCAVENGE_ID, HUNT_ID, SUPPLY_ID, applyCampfireObjective, install };
});