(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionWaterAffinity = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionWaterAffinity() {
  "use strict";

  const REGIONAL_WATER_CLOAK = Object.freeze({
    id: "regional-water-ferryman-cloak",
    name: "渡し守の油布外套",
    affinity: "water-crossing",
    tags: Object.freeze(["regional-gear", "water-affinity"]),
  });
  const WATER_ROUTE_DISCOVERY_ID = "regional-water-shallow-ford";

  function destinationFor(state, expedition) {
    if (!state || !expedition || !expedition.inputs || !Array.isArray(state.destinations)) return null;
    return state.destinations.find((item) => item && item.id === expedition.inputs.destinationId) || null;
  }

  function affinityTags(destination) {
    if (!destination) return [];
    const values = [];
    for (const key of ["features", "dangerTags", "opportunityTags"]) {
      if (Array.isArray(destination[key])) values.push(...destination[key]);
    }
    if (destination.palette) values.push(destination.palette);
    return [...new Set(values.map((value) => String(value || "").toLowerCase()))];
  }

  function isWaterAffinityDestination(destination) {
    if (!destination || destination.geographic !== true) return false;
    const tags = affinityTags(destination);
    return tags.includes("water") || tags.includes("crossing");
  }

  function selectedWaterGear(expedition, state) {
    if (!expedition || !expedition.inputs || !state || !Array.isArray(state.equipment)) return null;
    const selected = new Set(Array.isArray(expedition.inputs.equipmentIds) ? expedition.inputs.equipmentIds : []);
    return state.equipment.find((item) => item && selected.has(item.id) && item.affinity === REGIONAL_WATER_CLOAK.affinity) || null;
  }

  function alreadyOwnsWaterGear(state) {
    if (!state) return false;
    return Boolean(
      Array.isArray(state.equipment) && state.equipment.some((item) => item && item.id === REGIONAL_WATER_CLOAK.id)
      || Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === REGIONAL_WATER_CLOAK.id)
    );
  }

  function applyWaterLoot(report, expedition, state) {
    if (!report || report.outcome !== "success") return report;
    const destination = destinationFor(state, expedition);
    if (!isWaterAffinityDestination(destination) || alreadyOwnsWaterGear(state)) return report;

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === REGIONAL_WATER_CLOAK.id)) {
      report.loot.push({
        id: REGIONAL_WATER_CLOAK.id,
        name: REGIONAL_WATER_CLOAK.name,
        affinity: REGIONAL_WATER_CLOAK.affinity,
        originDestinationId: destination.id,
        originName: destination.name,
        tags: Array.from(REGIONAL_WATER_CLOAK.tags),
      });
    }
    report.waterRegionalLoot = {
      id: REGIONAL_WATER_CLOAK.id,
      affinity: REGIONAL_WATER_CLOAK.affinity,
      originDestinationId: destination.id,
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "regional-loot" && Array.isArray(entry.causes) && entry.causes.includes(REGIONAL_WATER_CLOAK.id))) {
      report.log.push({
        minute: 106,
        time: report.log.find((entry) => entry && entry.minute === 104)?.time || "",
        type: "regional-loot",
        text: `${destination.name}で、渡し守が雨と飛沫をしのぐために使っていた油布外套を回収した。水辺の痕跡を読む助けになりそうだ。`,
        causes: [REGIONAL_WATER_CLOAK.id, REGIONAL_WATER_CLOAK.affinity, "geographic-loot"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function applyWaterRouteEffect(report, expedition, state) {
    if (!report || report.outcome !== "success") return report;
    const destination = destinationFor(state, expedition);
    const gear = selectedWaterGear(expedition, state);
    if (!isWaterAffinityDestination(destination) || !gear) return report;

    report.waterGeographicEquipmentEffect = {
      equipmentId: gear.id,
      affinity: REGIONAL_WATER_CLOAK.affinity,
      destinationId: destination.id,
      effect: "read-shallow-crossing",
    };
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === WATER_ROUTE_DISCOVERY_ID)) {
      report.discoveries.push({
        id: WATER_ROUTE_DISCOVERY_ID,
        name: "葦陰の浅瀬",
        kind: "route",
        sourceDestinationId: destination.id,
        detail: "油布外套に残る渡し場の目印と水際の擦れから、荷を濡らさず渡れそうな浅瀬を見つけた。次の遠征で追える。",
      });
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "regional-water-gear" && Array.isArray(entry.causes) && entry.causes.includes(gear.id))) {
      const arrival = report.log.find((entry) => entry && entry.type === "arrival");
      report.log.push({
        minute: 42,
        time: arrival && arrival.time || "",
        type: "regional-water-gear",
        text: `${gear.name}に残る渡し場の目印を手掛かりに、水際の擦れと葦の倒れ方を読み、隠れた浅瀬を見つけた。`,
        causes: [gear.id, REGIONAL_WATER_CLOAK.affinity, WATER_ROUTE_DISCOVERY_ID, "read-shallow-crossing"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function persistWaterGear(state, report) {
    if (!state || !report || !Array.isArray(report.loot)) return state;
    const item = report.loot.find((candidate) => candidate && candidate.id === REGIONAL_WATER_CLOAK.id);
    if (!item) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    if (!Array.isArray(state.equipment)) state.equipment = [];
    if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
      state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
    }
    if (!state.equipment.some((existing) => existing && existing.id === item.id)) state.equipment.push({ ...item });
    return state;
  }

  function unlockWaterFollowup(root, state, report) {
    const followups = root && root.CrownlessExpeditionFollowupDestinations;
    if (!followups || typeof followups.unlockFollowupDestinations !== "function") return state;
    return followups.unlockFollowupDestinations(state, report);
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__waterAffinityInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithWaterAffinity(expedition, state) {
      let report = baseResolve(expedition, state);
      report = applyWaterLoot(report, expedition, state);
      return applyWaterRouteEffect(report, expedition, state);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithWaterAffinity(state, report) {
      const applied = baseApplyReport(state, report);
      persistWaterGear(applied, report);
      unlockWaterFollowup(root, applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithWaterAffinity(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyWaterLoot(advanced.report, expedition, state);
        applyWaterRouteEffect(advanced.report, expedition, state);
        persistWaterGear(advanced.state, advanced.report);
        unlockWaterFollowup(root, advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__waterAffinityInstalled = true;
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
    REGIONAL_WATER_CLOAK,
    WATER_ROUTE_DISCOVERY_ID,
    destinationFor,
    affinityTags,
    isWaterAffinityDestination,
    selectedWaterGear,
    alreadyOwnsWaterGear,
    applyWaterLoot,
    applyWaterRouteEffect,
    persistWaterGear,
    unlockWaterFollowup,
    installSystemHooks,
    install,
  };
});
