"use strict";

(function expeditionVisualCompositionModule(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionVisualComposition = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function expeditionVisualCompositionFactory() {
  const PLAYER_ASSET = "assets/combat/minimal-v0.1/actors/player-unarmed.png";
  const ENEMY_ASSETS = Object.freeze({
    rusher: "assets/combat/minimal-v0.1/actors/enemy-rusher.png",
    guard: "assets/combat/minimal-v0.1/actors/enemy-guard.png",
    skirmisher: "assets/combat/minimal-v0.1/actors/enemy-skirmisher.png",
  });
  const COMPOSED_KINDS = new Set(["combat-opening", "combat-climax", "injury", "retreat", "defeat"]);

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function stableEventId(entry, index) {
    return String(entry && (entry.eventId || entry.id) || `log-${index}`);
  }

  function sourceEventIndex(report, scene) {
    const sourceIds = new Set(list(scene && scene.sourceEventIds).map(String));
    if (!sourceIds.size) return -1;
    return list(report && report.log).findIndex((entry, index) => sourceIds.has(stableEventId(entry, index)));
  }

  function explicitBattleIndex(scene) {
    for (const id of list(scene && scene.sourceEventIds)) {
      const match = String(id).match(/^battle-(\d+)/);
      if (match) return Number(match[1]);
    }
    return -1;
  }

  function encounterForScene(report, scene) {
    const encounters = list(report && report.combat && report.combat.encounters);
    if (!encounters.length) return { encounter: null, battleIndex: -1 };

    const explicit = explicitBattleIndex(scene);
    if (explicit >= 0 && encounters[explicit]) return { encounter: encounters[explicit], battleIndex: explicit };

    const targetIndex = sourceEventIndex(report, scene);
    const encounterLogIndexes = list(report && report.log)
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry && entry.type === "combat-encounter");

    if (targetIndex >= 0 && encounterLogIndexes.length) {
      let battleIndex = 0;
      encounterLogIndexes.forEach((item, index) => {
        if (item.index <= targetIndex) battleIndex = index;
      });
      return { encounter: encounters[battleIndex] || encounters.at(-1), battleIndex };
    }

    return { encounter: encounters[0], battleIndex: 0 };
  }

  function destinationFamily(report, destinations) {
    const destination = list(destinations).find((item) => item && item.id === report.destinationId);
    if (destination && destination.family) return String(destination.family);
    if (report && report.destinationFamily) return String(report.destinationFamily);
    const id = String(report && report.destinationId || "").toLowerCase();
    const name = String(report && report.destinationName || "");
    if (id.includes("forest") || /森|林/.test(name)) return "forest";
    if (id.includes("village") || /村|集落/.test(name)) return "village";
    if (id.includes("cave") || id.includes("mine") || /洞窟|洞穴|坑|鉱/.test(name)) return "cave";
    return "unknown";
  }

  function outcomeFor(report, scene, encounter) {
    if (scene.kind === "defeat") return "defeat";
    if (scene.kind === "retreat") return "retreat";
    if (encounter && encounter.result) return String(encounter.result);
    if (report && report.outcome === "failed") return "defeat";
    if (report && report.outcome === "early-return") return "retreat";
    return "victory";
  }

  function enemyAsset(encounter, scene) {
    const tags = new Set(list(encounter && encounter.enemyTags).map(String));
    if (tags.has("skirmisher") || tags.has("ranged") || tags.has("archer")) return ENEMY_ASSETS.skirmisher;
    if (tags.has("guard") || tags.has("bandit") || (scene && scene.visualKey === "combat.bandit")) return ENEMY_ASSETS.guard;
    if (tags.has("rusher") || tags.has("beast") || (scene && scene.visualKey === "combat.beast")) return ENEMY_ASSETS.rusher;
    return null;
  }

  function enemyCount(encounter) {
    if (!encounter) return 0;
    const raw = Number(encounter.initialEnemyCount || encounter.enemyCount || list(encounter.enemies).length || 1);
    return Math.min(3, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1));
  }

  function orderedAllies(report, scene) {
    const party = list(report && report.companionIds).filter(Boolean).map(String);
    const focal = list(scene && scene.actorIds).filter(Boolean).map(String)[0]
      || list(report && report.injuries).filter(Boolean).map(String)[0]
      || party[0];
    if (scene.kind !== "injury" || !focal) return party.slice(0, 3);
    return [focal, ...party.filter((id) => id !== focal)].slice(0, 3);
  }

  function allyLayers(report, scene) {
    const allies = orderedAllies(report, scene);
    return allies.map((actorId, index) => ({
      side: "ally",
      actorId,
      assetPath: PLAYER_ASSET,
      slot: scene.kind === "injury" && index === 0
        ? "ally-focus"
        : index === 0 ? "ally-front" : index === 1 ? "ally-rear" : "ally-rear-2",
      focal: scene.kind === "injury" && index === 0,
    }));
  }

  function enemyLayers(encounter, scene) {
    const assetPath = enemyAsset(encounter, scene);
    const count = enemyCount(encounter);
    const slots = ["enemy-front", "enemy-rear", "enemy-rear-2"];
    return Array.from({ length: count }, (_, index) => ({
      side: "enemy",
      enemyIndex: index,
      assetPath,
      slot: slots[index],
      focal: index === 0,
    }));
  }

  function buildBattleComposition(input) {
    const scene = input && input.scene;
    const report = input && input.report;
    if (!scene || !report || !COMPOSED_KINDS.has(scene.kind)) return null;

    const { encounter, battleIndex } = encounterForScene(report, scene);
    const allies = allyLayers(report, scene);
    let enemies = enemyLayers(encounter, scene);
    if (scene.kind === "injury" && enemies.length > 2) enemies = enemies.slice(0, 2);

    return {
      kind: scene.kind,
      outcome: outcomeFor(report, scene, encounter),
      terrain: destinationFamily(report, input.destinations),
      encounterId: encounter && encounter.encounterId ? String(encounter.encounterId) : null,
      battleIndex,
      allyCount: allies.length,
      enemyCount: enemies.length,
      layers: [...allies, ...enemies],
    };
  }

  return { PLAYER_ASSET, ENEMY_ASSETS, buildBattleComposition };
});
