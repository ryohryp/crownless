(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessImprovisedWeapon = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createImprovisedWeapon() {
  "use strict";

  const BROKEN_SPEAR = Object.freeze({
    id: "broken-spear",
    name: "折れた槍",
    maxUses: 3,
    strongAgainst: "beast",
    bonusDamage: 2,
  });

  function findBrokenSpear(encounter) {
    if (!encounter || encounter.kind !== "battlefield-remains") return null;
    return { ...BROKEN_SPEAR, usesLeft: BROKEN_SPEAR.maxUses, temporary: true };
  }

  function useImprovisedWeapon(weapon, enemy) {
    if (!weapon || weapon.id !== BROKEN_SPEAR.id || weapon.usesLeft <= 0) {
      return { weapon: null, bonusDamage: 0, broke: false };
    }
    const usesLeft = weapon.usesLeft - 1;
    const bonusDamage = enemy && enemy.kind === BROKEN_SPEAR.strongAgainst ? BROKEN_SPEAR.bonusDamage : 0;
    return {
      weapon: usesLeft > 0 ? { ...weapon, usesLeft } : null,
      bonusDamage,
      broke: usesLeft === 0,
    };
  }

  function discardOnReturn(weapon) {
    return weapon && weapon.temporary ? null : weapon;
  }

  function describe(weapon) {
    if (!weapon) return "拾い物武器なし";
    return `${weapon.name}　残り${weapon.usesLeft}回｜獣に強い｜帰還時に失う`;
  }

  return { BROKEN_SPEAR, findBrokenSpear, useImprovisedWeapon, discardOnReturn, describe };
});
