(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionEquipmentOpportunities = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionEquipmentOpportunities() {
  "use strict";

  const ROPE_SHAFT_OPPORTUNITY = Object.freeze({
    id: "rope-shaft-cache",
    destinationId: "black-mine",
    objectiveId: "scavenge",
    equipmentId: "rope",
    loot: Object.freeze({
      id: "rope-shaft-miners-cache",
      name: "縦坑底の封じられた鉱夫の道具箱",
      tags: Object.freeze(["valuable", "equipment-opportunity"]),
    }),
  });

  const HERB_PRESS_ON_OPPORTUNITY = Object.freeze({
    id: "herb-press-on",
    equipmentId: "herb-kit",
    policyId: "greedy",
  });

  const REGIONAL_ROAD_CLOAK = Object.freeze({
    id: "regional-road-scout-cloak",
    name: "街道猟師の外套",
    affinity: "road-bandit",
    tags: Object.freeze(["regional-gear", "road-affinity"]),
  });

  function hasEquipment(expedition, equipmentId) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.equipmentIds)
      ? expedition.inputs.equipmentIds
      : [];
    return ids.includes(equipmentId);
  }

  function destinationFor(state, expedition) {
    if (!state || !expedition || !expedition.inputs || !Array.isArray(state.destinations)) return null;
    return state.destinations.find((item) => item && item.id === expedition.inputs.destinationId) || null;
  }

  function isRoadAffinityDestination(destination) {
    return Boolean(destination
      && destination.geographic === true
      && Array.isArray(destination.dangerTags)
      && destination.dangerTags.includes("bandit"));
  }

  function selectedRegionalRoadGear(expedition, state) {
    if (!expedition || !expedition.inputs || !state || !Array.isArray(state.equipment)) return null;
    const selected = new Set(Array.isArray(expedition.inputs.equipmentIds) ? expedition.inputs.equipmentIds : []);
    return state.equipment.find((item) => item && selected.has(item.id) && item.affinity === REGIONAL_ROAD_CLOAK.affinity) || null;
  }

  function stateWithRegionalRoadCapability(expedition, state) {
    const destination = destinationFor(state, expedition);
    const gear = selectedRegionalRoadGear(expedition, state);
    if (!isRoadAffinityDestination(destination) || !gear) return state;
    return {
      ...state,
      equipment: state.equipment.map((item) => item && item.id === gear.id
        ? { ...item, tags: [...new Set([...(Array.isArray(item.tags) ? item.tags : []), "conceal"])] }
        : item),
    };
  }

  function applyRegionalRoadLoot(report, expedition, state) {
    if (!report || report.outcome !== "success") return report;
    const destination = destinationFor(state, expedition);
    if (!isRoadAffinityDestination(destination)) return report;
    const alreadyOwned = Boolean(state && (
      Array.isArray(state.equipment) && state.equipment.some((item) => item && item.id === REGIONAL_ROAD_CLOAK.id)
      || Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === REGIONAL_ROAD_CLOAK.id)
    ));
    if (alreadyOwned) return report;

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === REGIONAL_ROAD_CLOAK.id)) {
      report.loot.push({
        id: REGIONAL_ROAD_CLOAK.id,
        name: REGIONAL_ROAD_CLOAK.name,
        affinity: REGIONAL_ROAD_CLOAK.affinity,
        originDestinationId: destination.id,
        originName: destination.name,
        tags: Array.from(REGIONAL_ROAD_CLOAK.tags),
      });
    }
    report.regionalLoot = {
      id: REGIONAL_ROAD_CLOAK.id,
      affinity: REGIONAL_ROAD_CLOAK.affinity,
      originDestinationId: destination.id,
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "regional-loot" && entry.causes && entry.causes.includes(REGIONAL_ROAD_CLOAK.id))) {
      report.log.push({
        minute: 106,
        time: report.log.find((entry) => entry && entry.minute === 104)?.time || "",
        type: "regional-loot",
        text: `${destination.name}の猟師が使っていた外套を回収した。この土地の街道で待ち伏せを読む助けになりそうだ。`,
        causes: [REGIONAL_ROAD_CLOAK.id, REGIONAL_ROAD_CLOAK.affinity, "geographic-loot"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function annotateRegionalRoadEffect(report, expedition, state) {
    if (!report) return report;
    const destination = destinationFor(state, expedition);
    const gear = selectedRegionalRoadGear(expedition, state);
    if (!isRoadAffinityDestination(destination) || !gear) return report;
    report.geographicEquipmentEffect = {
      equipmentId: gear.id,
      affinity: REGIONAL_ROAD_CLOAK.affinity,
      destinationId: destination.id,
      effect: "ambush-sense",
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "regional-gear" && entry.causes && entry.causes.includes(gear.id))) {
      const arrival = report.log.find((entry) => entry && entry.type === "arrival");
      report.log.push({
        minute: 40,
        time: arrival && arrival.time || "",
        type: "regional-gear",
        text: `${gear.name}に残る街道歩きの工夫を使い、待ち伏せの気配を接敵前に読んだ。`,
        causes: [gear.id, REGIONAL_ROAD_CLOAK.affinity, "ambush-sense"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function persistRegionalGear(state, report) {
    if (!state || !report || !Array.isArray(report.loot)) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    if (!Array.isArray(state.equipment)) state.equipment = [];
    const regional = report.loot.filter((item) => item && Array.isArray(item.tags) && item.tags.includes("regional-gear"));
    for (const item of regional) {
      if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
      if (!state.equipment.some((existing) => existing && existing.id === item.id)) {
        state.equipment.push({ ...item });
      }
    }
    return state;
  }

  function qualifiesForRopeShaft(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    return report.outcome === "success"
      && report.destinationId === ROPE_SHAFT_OPPORTUNITY.destinationId
      && expedition.inputs.objective === ROPE_SHAFT_OPPORTUNITY.objectiveId
      && hasEquipment(expedition, ROPE_SHAFT_OPPORTUNITY.equipmentId);
  }

  function applyRopeShaftOpportunity(report, expedition) {
    if (!qualifiesForRopeShaft(report, expedition)) return report;

    report.equipmentOpportunity = {
      id: ROPE_SHAFT_OPPORTUNITY.id,
      equipmentId: ROPE_SHAFT_OPPORTUNITY.equipmentId,
      destinationId: ROPE_SHAFT_OPPORTUNITY.destinationId,
    };

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === ROPE_SHAFT_OPPORTUNITY.loot.id)) {
      report.loot.push({
        id: ROPE_SHAFT_OPPORTUNITY.loot.id,
        name: ROPE_SHAFT_OPPORTUNITY.loot.name,
        tags: Array.from(ROPE_SHAFT_OPPORTUNITY.loot.tags),
      });
    }

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "equipment-opportunity" && entry.causes && entry.causes.includes(ROPE_SHAFT_OPPORTUNITY.id))) {
      const nearby = report.log.find((entry) => entry && entry.minute === 100) || report.log.find((entry) => entry && entry.minute === 104);
      report.log.push({
        minute: 102,
        time: nearby && nearby.time || "",
        type: "equipment-opportunity",
        text: "麻縄を固定して崩れた縦坑へ降り、底に残された鉱夫の道具箱を回収した。",
        causes: [ROPE_SHAFT_OPPORTUNITY.id, "rope", "scavenge"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function baselineCanSpendHerbs(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    if (expedition.inputs.policyId !== HERB_PRESS_ON_OPPORTUNITY.policyId) return false;
    if (!hasEquipment(expedition, HERB_PRESS_ON_OPPORTUNITY.equipmentId)) return false;
    if (report.outcome !== "early-return") return false;
    const encounters = report.combat && Array.isArray(report.combat.encounters) ? report.combat.encounters : [];
    if (encounters.length !== 1) return false;
    const combat = encounters[0];
    return Boolean(combat && combat.result === "retreat" && combat.hpAfter > 0 && combat.maxHp);
  }

  function resolveHerbPressOnOpportunity(baseResolve, report, expedition, state, greedyPolicy) {
    if (typeof baseResolve !== "function" || !greedyPolicy || !baselineCanSpendHerbs(report, expedition)) return report;
    const firstCombat = report.combat.encounters[0];
    const baselineRounds = Array.isArray(firstCombat.rounds) ? firstCombat.rounds.length : 0;
    const originalThreshold = greedyPolicy.retreatHpRatio;
    const pressOnThreshold = Math.max(0, firstCombat.hpAfter / firstCombat.maxHp - 0.01);
    let extended;
    try {
      greedyPolicy.retreatHpRatio = pressOnThreshold;
      extended = baseResolve(expedition, state);
    } finally {
      greedyPolicy.retreatHpRatio = originalThreshold;
    }

    const extendedEncounters = extended && extended.combat && Array.isArray(extended.combat.encounters)
      ? extended.combat.encounters
      : [];
    const extendedFirst = extendedEncounters[0];
    const extendedRounds = extendedFirst && Array.isArray(extendedFirst.rounds) ? extendedFirst.rounds.length : 0;
    if (!extended || !extendedFirst || extendedRounds <= baselineRounds) return report;

    extended.supplyOpportunity = {
      id: HERB_PRESS_ON_OPPORTUNITY.id,
      equipmentId: HERB_PRESS_ON_OPPORTUNITY.equipmentId,
      policyId: HERB_PRESS_ON_OPPORTUNITY.policyId,
      spent: true,
      baselineRounds,
      extendedRounds,
    };
    if (!Array.isArray(extended.log)) extended.log = [];
    if (!extended.log.some((entry) => entry && entry.type === "supply-use" && entry.causes && entry.causes.includes(HERB_PRESS_ON_OPPORTUNITY.id))) {
      const combatEntry = extended.log.find((entry) => entry && entry.type === "combat-encounter");
      const minute = combatEntry ? Math.max(0, combatEntry.minute - 1) : 64;
      const time = combatEntry && combatEntry.time || "";
      extended.log.push({
        minute,
        time,
        type: "supply-use",
        text: "薬草包みの残りを使い切って傷を押さえ、撤退判断を一度だけ先送りした。",
        causes: [HERB_PRESS_ON_OPPORTUNITY.id, "herb-kit", "greedy"],
      });
      extended.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    const supplyEvent = extended.log.find((entry) => entry && entry.type === "supply-use" && entry.causes && entry.causes.includes(HERB_PRESS_ON_OPPORTUNITY.id));
    if (supplyEvent) extended.notableEvent = supplyEvent;
    return extended;
  }

  function persistEquipmentOpportunityReward(state, report) {
    if (!state || !report || !report.equipmentOpportunity || !Array.isArray(report.loot)) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    const rewards = report.loot.filter((item) => item && Array.isArray(item.tags) && item.tags.includes("equipment-opportunity"));
    for (const item of rewards) {
      if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
    }
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__equipmentOpportunitiesInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithEquipmentOpportunities(expedition, state) {
      const affinityState = stateWithRegionalRoadCapability(expedition, state);
      const affinityResolve = (nextExpedition, nextState) => baseResolve(nextExpedition, stateWithRegionalRoadCapability(nextExpedition, nextState));
      let report = baseResolve(expedition, affinityState);
      report = resolveHerbPressOnOpportunity(affinityResolve, report, expedition, state, system.policies && system.policies.greedy);
      report = applyRopeShaftOpportunity(report, expedition);
      report = applyRegionalRoadLoot(report, expedition, state);
      return annotateRegionalRoadEffect(report, expedition, state);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithEquipmentOpportunities(state, report) {
      const applied = baseApplyReport(state, report);
      persistEquipmentOpportunityReward(applied, report);
      return persistRegionalGear(applied, report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithEquipmentOpportunities(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const now = Number.isFinite(nowMs) ? nowMs : Date.now();
      const regionalPrepared = Boolean(expedition && selectedRegionalRoadGear(expedition, state) && isRoadAffinityDestination(destinationFor(state, expedition)));
      if (expedition && now >= expedition.expectedReturnAt && (
        regionalPrepared
        || expedition.inputs && expedition.inputs.policyId === HERB_PRESS_ON_OPPORTUNITY.policyId && hasEquipment(expedition, HERB_PRESS_ON_OPPORTUNITY.equipmentId)
      )) {
        const report = system.resolveExpedition(expedition, state);
        if (regionalPrepared || report && report.supplyOpportunity && report.supplyOpportunity.id === HERB_PRESS_ON_OPPORTUNITY.id) {
          return { state: system.applyReport(state, report), report, status: "completed" };
        }
      }
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        applyRopeShaftOpportunity(advanced.report, expedition);
        persistEquipmentOpportunityReward(advanced.state, advanced.report);
        applyRegionalRoadLoot(advanced.report, expedition, state);
        annotateRegionalRoadEffect(advanced.report, expedition, state);
        persistRegionalGear(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__equipmentOpportunitiesInstalled = true;
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
    ROPE_SHAFT_OPPORTUNITY,
    HERB_PRESS_ON_OPPORTUNITY,
    REGIONAL_ROAD_CLOAK,
    hasEquipment,
    destinationFor,
    isRoadAffinityDestination,
    selectedRegionalRoadGear,
    stateWithRegionalRoadCapability,
    applyRegionalRoadLoot,
    annotateRegionalRoadEffect,
    persistRegionalGear,
    qualifiesForRopeShaft,
    applyRopeShaftOpportunity,
    baselineCanSpendHerbs,
    resolveHerbPressOnOpportunity,
    persistEquipmentOpportunityReward,
    installSystemHooks,
    install,
  };
});