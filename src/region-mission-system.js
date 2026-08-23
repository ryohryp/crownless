(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) {
    root.CrownlessCore = factory(root.CrownlessCore, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function installRegionMissions(Core, root) {
  "use strict";

  if (!Core || Core.__regionMissionsInstalled) return Core;

  const MISSION = Object.freeze({
    id: "missing-pack-train",
    title: "消えた荷駄隊",
    theme: "road",
    requiredClues: 2,
    knowledge: "この街道には組織的な襲撃者がいる",
    clues: Object.freeze([
      "泥の轍が途中で二つに割れ、重い荷車だけが脇道へ引きずられている。",
      "切られた荷縄に同じ黒い煤印が残っている。野盗の仕事にしては手際が揃いすぎている。"
    ]),
    finalPoi: Object.freeze({
      name: "街道荒らしの野営地",
      kicker: "荷駄隊は消えていない。ここへ運び込まれた。",
      description: "潰れた荷車を柵代わりにした野営地。積荷の箱が火のそばに並び、見張りがこちらへ振り向く。",
      omen: "組織的な襲撃者の拠点。踏み込めば戦いになる",
      palette: "road",
      risk: 4,
      reward: 4,
      enemyBias: "rusher"
    }),
    nextHuntId: "ash-hound"
  });

  const MISSION_PREFIX = `region-mission:${MISSION.id}:`;
  const POI_PREFIX = `region-poi:${MISSION.id}:`;
  const RUMOR_PREFIX = `region-rumor:${MISSION.id}:`;

  const base = {
    generateExplorationChoices: Core.generateExplorationChoices,
    discoverLocation: Core.discoverLocation,
    resolveEventChoice: Core.resolveEventChoice,
    resolveVictory: Core.resolveVictory,
    returnHome: Core.returnHome,
    resolveDefeat: Core.resolveDefeat
  };

  let presentedFinalMission = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function safeTerrain(value) {
    return Array.isArray(value)
      ? [...new Set(value.map((item) => cleanText(item)).filter(Boolean))].slice(0, 8)
      : [];
  }

  function ensureWorldKnowledge(state) {
    if (!state || typeof state !== "object") return state;
    if (Core.sanitizeWorldKnowledge) state.worldKnowledge = Core.sanitizeWorldKnowledge(state.worldKnowledge);
    else if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
    if (!state.worldKnowledge.discoveries || typeof state.worldKnowledge.discoveries !== "object" || Array.isArray(state.worldKnowledge.discoveries)) {
      state.worldKnowledge.discoveries = {};
    }
    return state;
  }

  function geographicIdentity(discovery) {
    if (!discovery || typeof discovery !== "object") return null;
    if (discovery.geographicDiscovery && typeof discovery.geographicDiscovery === "object") return discovery.geographicDiscovery;
    if (discovery.sourceRef || Array.isArray(discovery.features)) return discovery;
    return null;
  }

  function regionThemeForDiscovery(discovery) {
    if (!discovery || typeof discovery !== "object") return null;
    const geographic = geographicIdentity(discovery);
    if (geographic) {
      const features = safeTerrain(geographic.features);
      if (features.includes("road_hub") || features.includes("crossing")) return "road";
      return null;
    }
    const locationId = cleanText(discovery.locationId || discovery.id);
    return locationId === "dead-kings-road" ? "road" : null;
  }

  function selectRegionMissionCandidate(discovery) {
    return regionThemeForDiscovery(discovery) === MISSION.theme ? clone(MISSION) : null;
  }

  function sourceKnowledgeEntry(state, discovery) {
    ensureWorldKnowledge(state);
    const key = cleanText(discovery && discovery.discoveryKey);
    return key ? state.worldKnowledge.discoveries[key] || null : null;
  }

  function regionKeyForDiscovery(state, discovery) {
    const source = sourceKnowledgeEntry(state, discovery);
    const areaId = cleanText(source && source.areaId);
    if (/^area:\d{1,2}:\d+:\d+$/.test(areaId)) return areaId;

    if (geographicIdentity(discovery)) return "geo:road";

    const locationId = cleanText(discovery && (discovery.locationId || discovery.id), "dead-kings-road");
    return `sim:${locationId}`;
  }

  function missionKey(regionKey) {
    return `${MISSION_PREFIX}${regionKey}`;
  }

  function regionKeyFromMissionKey(key) {
    const text = cleanText(key);
    return text.startsWith(MISSION_PREFIX) ? text.slice(MISSION_PREFIX.length) : "";
  }

  function stableHash(text) {
    let hash = 2166136261;
    const source = cleanText(text);
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function missionEntries(state) {
    ensureWorldKnowledge(state);
    return Object.values(state.worldKnowledge.discoveries)
      .filter((entry) => entry && typeof entry === "object" && entry.contentKind === "region-mission" && cleanText(entry.key).startsWith(MISSION_PREFIX))
      .sort((left, right) => (Number(right.firstDiscoveredAt) || 0) - (Number(left.firstDiscoveredAt) || 0) || cleanText(left.key).localeCompare(cleanText(right.key)));
  }

  function missionEntry(state, key) {
    ensureWorldKnowledge(state);
    const entry = state.worldKnowledge.discoveries[cleanText(key)];
    return entry && entry.contentKind === "region-mission" ? entry : null;
  }

  function missionView(entry) {
    if (!entry) return null;
    const clues = Math.min(MISSION.requiredClues, Math.max(0, Number(entry.visits) || 0));
    return {
      key: entry.key,
      id: MISSION.id,
      title: MISSION.title,
      theme: MISSION.theme,
      regionKey: regionKeyFromMissionKey(entry.key),
      areaId: cleanText(entry.areaId),
      clues,
      clueGoal: MISSION.requiredClues,
      clueTexts: MISSION.clues.slice(0, clues),
      stage: entry.state,
      finalPoiDiscovered: entry.state === "investigated" || entry.state === "cleared",
      completed: entry.state === "cleared",
      knowledge: entry.state === "cleared" ? MISSION.knowledge : "",
      nextHuntId: MISSION.nextHuntId,
      nextRumorUnlocked: entry.state === "cleared"
    };
  }

  function activeFinalMission(state) {
    const victories = state && state.expedition && state.expedition.regionMissionVictories;
    const entry = missionEntries(state).find((candidate) => candidate.state === "investigated" && !(victories && victories[candidate.key]));
    return missionView(entry);
  }

  function activeTrackingMission(state) {
    return missionView(missionEntries(state).find((candidate) => candidate.state === "discovered"));
  }

  function appendSummary(state, text) {
    if (!state || !state.expedition || !text) return;
    state.expedition.lastEventSummary = state.expedition.lastEventSummary
      ? `${state.expedition.lastEventSummary} ${text}`
      : text;
  }

  function journalEntry(key, name, baseTitle, contentKind, stateName, areaId, timestamp) {
    const entry = {
      key,
      name,
      baseTitle,
      terrain: ["road_hub"],
      contentKind,
      state: stateName,
      firstDiscoveredAt: timestamp,
      visits: 1
    };
    if (/^area:\d{1,2}:\d+:\d+$/.test(cleanText(areaId))) entry.areaId = areaId;
    return entry;
  }

  function finalPoiKey(regionKey) {
    return `${POI_PREFIX}${regionKey}`;
  }

  function recordFinalPoiKnowledge(state, mission, now = Date.now()) {
    ensureWorldKnowledge(state);
    const key = finalPoiKey(mission.regionKey);
    const existing = state.worldKnowledge.discoveries[key];
    if (existing) return existing;
    const entry = journalEntry(
      key,
      MISSION.finalPoi.name,
      `${MISSION.title} / 追跡地点`,
      "encounter",
      "discovered",
      mission.areaId,
      now
    );
    state.worldKnowledge.discoveries[key] = entry;
    return entry;
  }

  function recordMissionClue(state, discovery, now = Date.now()) {
    if (!selectRegionMissionCandidate(discovery)) return { changed: false, mission: null, clue: "" };
    ensureWorldKnowledge(state);

    const regionKey = regionKeyForDiscovery(state, discovery);
    const key = missionKey(regionKey);
    const existing = missionEntry(state, key);
    if (existing && (existing.state === "investigated" || existing.state === "cleared")) {
      return { changed: false, mission: missionView(existing), clue: "" };
    }

    const source = sourceKnowledgeEntry(state, discovery);
    const areaId = cleanText(source && source.areaId);
    const previousClues = existing ? Math.max(1, Number(existing.visits) || 1) : 0;
    const nextClues = Math.min(MISSION.requiredClues, previousClues + 1);
    const nextState = nextClues >= MISSION.requiredClues ? "investigated" : "discovered";
    const timestamp = Number(now);

    const entry = existing || journalEntry(
      key,
      MISSION.title,
      "地域依頼 / 街道",
      "region-mission",
      nextState,
      areaId,
      Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
    );
    entry.name = MISSION.title;
    entry.baseTitle = "地域依頼 / 街道";
    entry.terrain = ["road_hub"];
    entry.contentKind = "region-mission";
    entry.state = nextState;
    entry.visits = nextClues;
    if (/^area:\d{1,2}:\d+:\d+$/.test(areaId)) entry.areaId = areaId;
    state.worldKnowledge.discoveries[key] = entry;

    const mission = missionView(entry);
    const clue = MISSION.clues[nextClues - 1];
    if (nextState === "investigated") {
      recordFinalPoiKnowledge(state, mission, now);
      appendSummary(state, `地域依頼「${MISSION.title}」――${clue} 痕跡が繋がった。${MISSION.finalPoi.name}を地図に記した。`);
    } else {
      appendSummary(state, `地域依頼「${MISSION.title}」――${clue} あと${MISSION.requiredClues - nextClues}つ、痕跡が要る。`);
    }

    if (typeof Core.saveWorldKnowledge === "function") Core.saveWorldKnowledge(state);
    return { changed: true, mission, clue };
  }

  function targetChoice(mission, depth) {
    const hash = stableHash(mission.key);
    return {
      id: `region-bandit-camp-${hash}`,
      locationId: `region-bandit-camp-${hash}`,
      choiceId: `region-mission-final:${hash}:99`,
      name: MISSION.finalPoi.name,
      kicker: MISSION.finalPoi.kicker,
      description: MISSION.finalPoi.description,
      omen: MISSION.finalPoi.omen,
      palette: MISSION.finalPoi.palette,
      risk: MISSION.finalPoi.risk,
      reward: MISSION.finalPoi.reward,
      enemyBias: MISSION.finalPoi.enemyBias,
      signal: "地域依頼 / 追跡地点",
      eventKind: "region-mission",
      regionMissionFinal: true,
      regionMissionKey: mission.key,
      depth: Number(depth) + 1
    };
  }

  function finalDiscovery(choice, state) {
    return {
      id: `${choice.id}-${state.expedition.depth}-${state.expedition.discoveries.length}`,
      locationId: choice.locationId,
      name: choice.name,
      kicker: choice.kicker,
      flavor: choice.description,
      omen: choice.omen,
      risk: choice.risk,
      reward: choice.reward,
      palette: choice.palette,
      depth: state.expedition.depth + 1,
      signal: choice.signal,
      eventKind: "region-mission",
      regionMissionFinal: true,
      regionMissionKey: choice.regionMissionKey
    };
  }

  function discoverFinalPoi(state, mission) {
    if (!state || !state.expedition || state.phase !== "explore") throw new Error("No active exploration step");
    const next = clone(state);
    const choice = targetChoice(mission, next.expedition.depth);
    const discovery = finalDiscovery(choice, next);
    const seedSalt = Number.parseInt(stableHash(mission.key), 16) || 1;
    const rng = Core.createRng(next.expedition.seed + next.expedition.depth * 977 + seedSalt);

    next.expedition.discoveries.push(discovery);
    next.expedition.lastDiscovery = discovery;
    next.expedition.encounter = {
      kind: "region-mission",
      regionMissionKey: mission.key,
      discovery,
      enemies: Core.buildEnemies(next.expedition.depth, rng, MISSION.finalPoi, 1),
      rewardBonus: 2
    };
    next.expedition.lastEventSummary = `${MISSION.finalPoi.name}へ踏み込んだ。荷駄隊を襲った連中が待ち構えている。`;
    next.phase = "combat";
    presentedFinalMission = null;
    return next;
  }

  function rumorEntry(state, mission, now = Date.now()) {
    const hunt = Array.isArray(Core.HUNTS) ? Core.HUNTS.find((candidate) => candidate.id === MISSION.nextHuntId) : null;
    const key = `${RUMOR_PREFIX}${mission.regionKey}:${MISSION.nextHuntId}`;
    const existing = state.worldKnowledge.discoveries[key];
    if (existing) return existing;
    const name = hunt ? `次の噂：${hunt.name}――${hunt.epithet}` : "次の噂：街道を喰う者";
    const baseTitle = hunt ? hunt.rumor : "荷駄隊を襲った連中の背後には、名を持つ狩人がいるらしい。";
    const entry = journalEntry(key, name, baseTitle, "rumor", "discovered", mission.areaId, now);
    state.worldKnowledge.discoveries[key] = entry;
    return entry;
  }

  function completeMissionKnowledge(state, key, now = Date.now()) {
    ensureWorldKnowledge(state);
    const entry = missionEntry(state, key);
    if (!entry || entry.state === "cleared") return false;
    const mission = missionView(entry);
    entry.state = "cleared";
    entry.name = MISSION.knowledge;
    entry.baseTitle = `${MISSION.title} / 完了`;
    entry.visits = MISSION.requiredClues;

    const poi = state.worldKnowledge.discoveries[finalPoiKey(mission.regionKey)];
    if (poi) poi.state = "cleared";
    rumorEntry(state, mission, now);
    return true;
  }

  function annotateTrackingChoice(choice, tracking) {
    if (!tracking || !choice || choice.id !== "dead-kings-road") return choice;
    return {
      ...choice,
      signal: `${choice.signal} / 地域依頼`,
      omen: `消えた荷駄隊の痕跡を追える。${choice.omen}`,
      regionMissionTrace: true
    };
  }

  Core.generateExplorationChoices = function generateExplorationChoicesWithRegionMission(state) {
    const choices = base.generateExplorationChoices(state).map((choice) => ({ ...choice }));
    const finalMission = activeFinalMission(state);
    if (finalMission && choices.length) {
      choices[0] = targetChoice(finalMission, state.expedition ? state.expedition.depth : 0);
      presentedFinalMission = finalMission;
      queuePresentationRepair();
      return choices;
    }

    presentedFinalMission = null;
    const tracking = activeTrackingMission(state);
    return choices.map((choice) => annotateTrackingChoice(choice, tracking));
  };

  Core.discoverLocation = function discoverLocationWithRegionMission(state, choiceId) {
    const finalMission = activeFinalMission(state);
    if (finalMission) {
      const finalChoice = targetChoice(finalMission, state.expedition ? state.expedition.depth : 0);
      if (choiceId === finalChoice.choiceId) return discoverFinalPoi(state, finalMission);
    }

    const next = base.discoverLocation(state, choiceId);
    if (next && next.phase === "decision" && next.expedition && next.expedition.lastDiscovery) {
      recordMissionClue(next, next.expedition.lastDiscovery);
    }
    return next;
  };

  Core.resolveEventChoice = function resolveEventChoiceWithRegionMission(state, optionId) {
    const discovery = state && state.expedition && state.expedition.pendingEvent
      ? clone(state.expedition.pendingEvent.discovery)
      : null;
    const next = base.resolveEventChoice(state, optionId);
    if (next && next.phase === "decision" && discovery) recordMissionClue(next, discovery);
    return next;
  };

  Core.resolveVictory = function resolveVictoryWithRegionMission(state, remainingHealth) {
    const encounter = state && state.expedition && state.expedition.encounter
      ? clone(state.expedition.encounter)
      : null;
    const next = base.resolveVictory(state, remainingHealth);

    if (encounter && encounter.kind === "region-mission" && encounter.regionMissionKey && next.expedition) {
      if (!next.expedition.regionMissionVictories || typeof next.expedition.regionMissionVictories !== "object") {
        next.expedition.regionMissionVictories = {};
      }
      next.expedition.regionMissionVictories[encounter.regionMissionKey] = true;
      next.expedition.lastEventSummary = `${MISSION.finalPoi.name}を潰した。奪われた荷の中から戦利品を拾った。灰炉まで生還すれば、この土地の知識として残る。`;
      return next;
    }

    if (encounter && encounter.discovery && next && next.phase === "decision") {
      recordMissionClue(next, encounter.discovery);
    }
    return next;
  };

  Core.returnHome = function returnHomeWithRegionMission(state) {
    const victories = state && state.expedition && state.expedition.regionMissionVictories
      ? Object.keys(state.expedition.regionMissionVictories).filter((key) => state.expedition.regionMissionVictories[key])
      : [];
    const next = base.returnHome(state);
    let changed = false;
    victories.forEach((key) => {
      if (completeMissionKnowledge(next, key)) changed = true;
    });
    if (changed && typeof Core.saveWorldKnowledge === "function") Core.saveWorldKnowledge(next);
    return next;
  };

  Core.resolveDefeat = function resolveDefeatWithRegionMission(state) {
    presentedFinalMission = null;
    return base.resolveDefeat(state);
  };

  Core.REGION_MISSIONS = [clone(MISSION)];
  Core.selectRegionMissionCandidate = selectRegionMissionCandidate;
  Core.recordRegionMissionClue = recordMissionClue;
  Core.getRegionMissionBoard = function getRegionMissionBoard(state) {
    return missionEntries(state).map((entry) => missionView(entry));
  };
  Core.__regionMissionsInstalled = true;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function repairPresentedFinalLead() {
    if (!presentedFinalMission || !root || !root.document) return;
    const card = root.document.querySelector("#lead-list .lead-card");
    if (!card) return;
    const choice = targetChoice(presentedFinalMission, 0);
    const className = `lead-card palette-${choice.palette} region-mission-target`;
    if (card.className !== className) card.className = className;
    if (card.style.display === "none") card.style.display = "";
    if (card.dataset.discoverySource !== "region-mission") card.dataset.discoverySource = "region-mission";
    setText(card.querySelector(".lead-topline span"), choice.kicker);
    setText(card.querySelector("h3"), choice.name);
    setText(card.querySelector("p"), choice.description);
    setText(card.querySelector(".lead-omen"), `噂：${choice.omen}`);
    setText(card.querySelector(".lead-signals label strong"), choice.signal);
  }

  function queuePresentationRepair() {
    if (!root || !root.document || !presentedFinalMission) return;
    const schedule = typeof root.queueMicrotask === "function" ? root.queueMicrotask.bind(root) : (callback) => Promise.resolve().then(callback);
    schedule(repairPresentedFinalLead);
  }

  if (root && root.document && typeof root.MutationObserver === "function") {
    const leadList = root.document.getElementById("lead-list");
    if (leadList) {
      const observer = new root.MutationObserver(() => repairPresentedFinalLead());
      observer.observe(leadList, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  }

  return Core;
});
