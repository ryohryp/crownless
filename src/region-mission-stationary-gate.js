(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) root.CrownlessCore = factory(root.CrownlessCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function installRegionMissionStationaryGate(Core) {
  "use strict";

  if (!Core || Core.__regionMissionStationaryGateInstalled) return Core;
  if (typeof Core.getRegionMissionBoard !== "function") return Core;

  const originalGenerateExplorationChoices = Core.generateExplorationChoices.bind(Core);
  const originalDiscoverLocation = Core.discoverLocation.bind(Core);
  let armedMissionKey = "";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function activeFinalMission(state) {
    const board = Core.getRegionMissionBoard(state);
    return Array.isArray(board)
      ? board.find((mission) => mission && mission.stage === "investigated" && !mission.completed) || null
      : null;
  }

  function suppressFinalMission(state, missionKey) {
    const next = clone(state);
    if (!next.expedition || typeof next.expedition !== "object") return next;
    if (!next.expedition.regionMissionVictories || typeof next.expedition.regionMissionVictories !== "object") {
      next.expedition.regionMissionVictories = {};
    }
    next.expedition.regionMissionVictories[missionKey] = true;
    return next;
  }

  Core.generateExplorationChoices = function generateExplorationChoicesWithStationaryGate(state) {
    const mission = activeFinalMission(state);
    if (!mission || armedMissionKey === mission.key) return originalGenerateExplorationChoices(state);
    return originalGenerateExplorationChoices(suppressFinalMission(state, mission.key));
  };

  Core.discoverLocation = function discoverLocationWithStationaryGate(state, choiceId) {
    const next = originalDiscoverLocation(state, choiceId);
    const encounter = next && next.expedition && next.expedition.encounter;
    if (armedMissionKey && encounter && encounter.regionMissionKey === armedMissionKey) armedMissionKey = "";
    return next;
  };

  Core.armRegionMissionAssault = function armRegionMissionAssault(missionKey) {
    armedMissionKey = cleanText(missionKey);
    return Boolean(armedMissionKey);
  };

  Core.cancelRegionMissionAssault = function cancelRegionMissionAssault() {
    armedMissionKey = "";
  };

  Core.isRegionMissionAssaultArmed = function isRegionMissionAssaultArmed(missionKey) {
    const key = cleanText(missionKey);
    return key ? armedMissionKey === key : Boolean(armedMissionKey);
  };

  Core.__regionMissionStationaryGateInstalled = true;
  return Core;
});
