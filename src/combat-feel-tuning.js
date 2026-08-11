(() => {
  "use strict";

  const Core = window.CrownlessCore;
  if (!Core || Core.__combatFeelTuned) return;

  const ROLE_PACE = {
    rusher: { speed: 1.06, range: 68 },
    guard: { speed: 0.94, range: 74 },
    skirmisher: { speed: 0.96, range: 245 }
  };

  const RUSHER_IDENTITY = Object.freeze({
    healthScale: 0.84,
    damageScale: 1.18,
    role: "fast / dangerous / fragile"
  });

  const PLAYER_MOVE_SCALE = {
    fists: 1.05,
    dagger: 1.05,
    sword: 1.04
  };

  function tuneEnemy(enemy) {
    if (!enemy || enemy.boss) return enemy;
    const pace = ROLE_PACE[enemy.kind];
    if (!pace) return enemy;
    enemy.moveSpeed = Math.round(enemy.moveSpeed * pace.speed);
    enemy.attackRange = pace.range;

    if (enemy.kind === "rusher") {
      enemy.maxHealth = Math.max(1, Math.round(enemy.maxHealth * RUSHER_IDENTITY.healthScale));
      enemy.damage = Math.max(1, Math.round(enemy.damage * RUSHER_IDENTITY.damageScale));
      enemy.combatRole = "rusher";
    }

    return enemy;
  }

  function tuneEncounterState(state) {
    const enemies = state && state.expedition && state.expedition.encounter && state.expedition.encounter.enemies;
    if (!Array.isArray(enemies)) return state;
    enemies.forEach(tuneEnemy);
    return state;
  }

  ["discoverLocation", "resolveEventChoice", "discoverNextCell"].forEach((name) => {
    const original = Core[name];
    if (typeof original !== "function") return;
    Core[name] = function tunedEncounterTransition(...args) {
      return tuneEncounterState(original.apply(this, args));
    };
  });

  const originalBuildEnemies = Core.buildEnemies;
  if (typeof originalBuildEnemies === "function") {
    Core.buildEnemies = function tunedBuildEnemies(...args) {
      return originalBuildEnemies.apply(this, args).map(tuneEnemy);
    };
  }

  const originalCombatTuning = Core.getCombatTuning;
  if (typeof originalCombatTuning === "function") {
    Core.getCombatTuning = function tunedCombatTuning(...args) {
      const tuning = originalCombatTuning.apply(this, args);
      const scale = PLAYER_MOVE_SCALE[tuning.weaponType] || 1.04;
      return {
        ...tuning,
        moveSpeed: Math.round(tuning.moveSpeed * scale),
        reach: tuning.reach + (tuning.weaponType === "sword" ? 2 : 3)
      };
    };
  }

  Core.__combatFeelTuned = true;
  window.CrownlessCombatFeel = Object.freeze({
    rolePace: ROLE_PACE,
    rusherIdentity: RUSHER_IDENTITY,
    playerMoveScale: PLAYER_MOVE_SCALE,
    intent: "create clearer stop-to-strike openings and a readable high-risk rusher without adding controls or new systems"
  });
})();
