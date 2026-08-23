(() => {
  "use strict";

  if (typeof document !== "undefined"
      && document.readyState === "loading"
      && !window.__crownlessInkFeelLoader) {
    window.__crownlessInkFeelLoader = true;
    document.write('<script src="src/combat-depth-order-v1.js"><\/script>');
    document.write('<script src="src/combat-ink-feel-v3.js"><\/script>');
  }

  const Core = window.CrownlessCore;
  if (!Core || Core.__combatFeelTuned) return;

  const ENEMY_ROLE_TUNING = Object.freeze({
    rusher: Object.freeze({
      speed: 1.06,
      range: 68,
      healthScale: 0.84,
      damageScale: 1.18,
      role: "fast / dangerous / fragile"
    }),
    guard: Object.freeze({
      speed: 0.88,
      range: 76,
      healthScale: 1.08,
      damageScale: 0.92,
      role: "slow / armored / break then punish"
    }),
    skirmisher: Object.freeze({
      speed: 1.10,
      range: 245,
      healthScale: 0.90,
      damageScale: 1.12,
      role: "mobile / evasive / punish neglect"
    })
  });

  const ROLE_PACE = Object.freeze(Object.fromEntries(
    Object.entries(ENEMY_ROLE_TUNING).map(([kind, tuning]) => [
      kind,
      Object.freeze({ speed: tuning.speed, range: tuning.range })
    ])
  ));

  function identityFor(kind) {
    const tuning = ENEMY_ROLE_TUNING[kind];
    return Object.freeze({
      healthScale: tuning.healthScale,
      damageScale: tuning.damageScale,
      role: tuning.role
    });
  }

  const RUSHER_IDENTITY = identityFor("rusher");
  const GUARD_IDENTITY = identityFor("guard");
  const SKIRMISHER_IDENTITY = identityFor("skirmisher");

  const PLAYER_MOVE_SCALE = Object.freeze({
    fists: 1.05,
    dagger: 1.05,
    sword: 1.04
  });

  function tuneEnemy(enemy) {
    if (!enemy || enemy.boss) return enemy;
    const tuning = ENEMY_ROLE_TUNING[enemy.kind];
    if (!tuning) return enemy;

    enemy.moveSpeed = Math.round(enemy.moveSpeed * tuning.speed);
    enemy.attackRange = tuning.range;
    enemy.maxHealth = Math.max(1, Math.round(enemy.maxHealth * tuning.healthScale));
    enemy.damage = Math.max(1, Math.round(enemy.damage * tuning.damageScale));
    enemy.combatRole = enemy.kind;
    return enemy;
  }

  function tuneEncounterState(state) {
    const enemies = state && state.expedition && state.expedition.encounter && state.expedition.encounter.enemies;
    if (!Array.isArray(enemies)) return state;
    enemies.forEach(tuneEnemy);
    return state;
  }

  function wrapEncounterTransition(name) {
    const original = Core[name];
    if (typeof original !== "function") return;
    Core[name] = function tunedEncounterTransition(...args) {
      return tuneEncounterState(original.apply(this, args));
    };
  }

  ["discoverLocation", "resolveEventChoice", "discoverNextCell"].forEach(wrapEncounterTransition);

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
    guardIdentity: GUARD_IDENTITY,
    skirmisherIdentity: SKIRMISHER_IDENTITY,
    playerMoveScale: PLAYER_MOVE_SCALE,
    intent: "make enemy roles demand different movement choices using existing combat interactions instead of new controls or systems"
  });
})();
