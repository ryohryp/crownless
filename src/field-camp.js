(() => {
  'use strict';

  const RECOVER_HP = 8;
  const RISK_PENALTY = 4;

  function canCamp(expedition) {
    return Boolean(expedition && !expedition.fieldCampUsed && Number(expedition.hp) > 0 && Number(expedition.hp) < Number(expedition.maxHp || 20));
  }

  function preview(expedition) {
    if (!canCamp(expedition)) return null;
    const maxHp = Number(expedition.maxHp || 20);
    const hp = Number(expedition.hp || 0);
    return {
      recover: Math.min(RECOVER_HP, Math.max(0, maxHp - hp)),
      nextRisk: RISK_PENALTY,
      label: `野営する — HP +${Math.min(RECOVER_HP, Math.max(0, maxHp - hp))} / 次の遭遇は危険 +${RISK_PENALTY}`
    };
  }

  function apply(expedition) {
    if (!canCamp(expedition)) return expedition;
    const maxHp = Number(expedition.maxHp || 20);
    return {
      ...expedition,
      hp: Math.min(maxHp, Number(expedition.hp || 0) + RECOVER_HP),
      fieldCampUsed: true,
      fieldCampRisk: RISK_PENALTY
    };
  }

  function consumeRisk(expedition) {
    if (!expedition || !expedition.fieldCampRisk) return { expedition, risk: 0 };
    const risk = Number(expedition.fieldCampRisk) || 0;
    return { expedition: { ...expedition, fieldCampRisk: 0 }, risk };
  }

  window.CrownlessFieldCamp = Object.freeze({ canCamp, preview, apply, consumeRisk, RECOVER_HP, RISK_PENALTY });
})();
