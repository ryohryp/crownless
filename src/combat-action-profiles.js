(() => {
  "use strict";

  const TECHNIQUE_PROFILES = Object.freeze({
    fists: Object.freeze({
      standard: Object.freeze({ duration: 0.54, activeAt: 0.23, lunge: 38, damage: 1, stagger: 1, knock: 1, label: "TECHNIQUE" }),
      counter: Object.freeze({ duration: 0.37, activeAt: 0.1, lunge: 54, damage: 1.48, stagger: 1.15, knock: 1.08, label: "RUSH" })
    }),
    dagger: Object.freeze({
      standard: Object.freeze({ duration: 0.5, activeAt: 0.2, lunge: 46, damage: 0.96, stagger: 0.95, knock: 0.9, label: "TECHNIQUE" }),
      counter: Object.freeze({ duration: 0.34, activeAt: 0.09, lunge: 78, damage: 1.75, stagger: 0.9, knock: 0.72, label: "RIPOSTE" })
    }),
    sword: Object.freeze({
      standard: Object.freeze({ duration: 0.68, activeAt: 0.34, lunge: 34, damage: 1.1, stagger: 1.18, knock: 1.2, label: "TECHNIQUE" }),
      counter: Object.freeze({ duration: 0.5, activeAt: 0.18, lunge: 50, damage: 1.6, stagger: 1.75, knock: 1.5, label: "CLASH" })
    })
  });

  const NORMAL_ATTACK_PROFILES = Object.freeze({
    dagger: Object.freeze({ settle: 0.06, reachBonus: 8, comboLength: 6, duration: 0.17, activeAt: 0.046, cadence: 0.015, lunge: 9, damage: 0.82, finisher: 1.5, arc: 0.28 }),
    sword: Object.freeze({ settle: 0.14, reachBonus: 14, comboLength: 3, duration: 0.39, activeAt: 0.145, cadence: 0.055, lunge: 6, damage: 1.18, finisher: 1.3, arc: -0.16 }),
    fists: Object.freeze({ settle: 0.085, reachBonus: 6, comboLength: 4, duration: 0.215, activeAt: 0.06, cadence: 0.02, lunge: 10, damage: 1, finisher: 1.38, arc: 0.04 })
  });

  const FIELD_WEAPONS = Object.freeze({
    guard: Object.freeze({ type: "sword", name: "欠け盾兵の剣" }),
    skirmisher: Object.freeze({ type: "dagger", name: "藪射ちの狩猟刀" }),
    default: Object.freeze({ type: "dagger", name: "街道荒らしの短刀" })
  });

  function clone(profile) {
    return { ...profile };
  }

  function techniqueProfile(weaponType = "fists", counter = false) {
    const weapon = TECHNIQUE_PROFILES[weaponType] || TECHNIQUE_PROFILES.fists;
    return clone(counter ? weapon.counter : weapon.standard);
  }

  function normalAttackProfile(tuning = {}) {
    const weaponType = tuning && tuning.weaponType || "fists";
    const profile = NORMAL_ATTACK_PROFILES[weaponType] || NORMAL_ATTACK_PROFILES.fists;
    const reach = Number.isFinite(tuning && tuning.reach) ? tuning.reach : 53;
    const tempo = weaponType === "fists" && Number.isFinite(tuning && tuning.unarmedTempo) ? tuning.unarmedTempo : 1;
    return {
      settle: profile.settle,
      range: reach + profile.reachBonus,
      comboLength: profile.comboLength,
      duration: profile.duration / tempo,
      activeAt: profile.activeAt / tempo,
      cadence: profile.cadence,
      lunge: profile.lunge,
      damage: profile.damage,
      finisher: profile.finisher,
      arc: profile.arc
    };
  }

  function battlefieldWeaponSpec(enemyKind) {
    return clone(FIELD_WEAPONS[enemyKind] || FIELD_WEAPONS.default);
  }

  function battlefieldWeaponTuning(baseTuning, type) {
    const base = baseTuning || {};
    const lightBase = Math.max(11, Number.isFinite(base.lightDamage) ? base.lightDamage : 11);
    const heavyBase = Math.max(21, Number.isFinite(base.heavyDamage) ? base.heavyDamage : 21);
    if (type === "sword") {
      return {
        style: "blade", weaponType: "sword",
        lightDamage: lightBase * 1.08, heavyDamage: heavyBase * 1.12,
        reach: 82, moveSpeed: 190, heavyStagger: 1.15,
        evadeEmpower: false, unarmedTempo: 1, comboFinisher: 1, lowHealthRisk: false
      };
    }
    return {
      style: "blade", weaponType: "dagger",
      lightDamage: lightBase * 0.92, heavyDamage: heavyBase * 0.95,
      reach: 62, moveSpeed: 218, heavyStagger: 0.95,
      evadeEmpower: false, unarmedTempo: 1, comboFinisher: 1, lowHealthRisk: false
    };
  }

  window.CrownlessCombatActionProfiles = Object.freeze({
    techniqueProfile,
    normalAttackProfile,
    battlefieldWeaponSpec,
    battlefieldWeaponTuning
  });
})();
