(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const Camp = window.CrownlessFieldCamp;
  if (!E || !Camp || E.__fieldCampWired) return;

  const originalStart = E.start;
  const originalAct = E.act;

  E.start = function fieldCampStart(state, placeId) {
    const next = originalStart(state, placeId);
    if (next !== state && next.expedition) next.expedition.maxHp = E.maxHp(next);
    return next;
  };

  E.act = function fieldCampAct(state, action) {
    const x = state?.expedition;
    if (action === 'field-camp') {
      if (!x || x.stage !== 'path') return state;
      const next = JSON.parse(JSON.stringify(state));
      next.expedition.maxHp = E.maxHp(next);
      next.expedition = Camp.apply(next.expedition);
      if (next.expedition === x || !next.expedition.fieldCampUsed) return state;
      next.expedition.log = [`野営で体力を ${Camp.RECOVER_HP} までではなく、最大 ${Camp.RECOVER_HP} 回復。次の遭遇は危険 +${Camp.RISK_PENALTY}。`];
      return next;
    }

    if (x && x.stage === 'path' && ['careful', 'risky'].includes(action) && x.fieldCampRisk) {
      const prepared = JSON.parse(JSON.stringify(state));
      const consumed = Camp.consumeRisk(prepared.expedition);
      prepared.expedition = consumed.expedition;
      const next = originalAct(prepared, action);
      if (next?.expedition?.enemy && consumed.risk > 0) {
        next.expedition.enemy.hp += consumed.risk;
        next.expedition.enemy.maxHp += consumed.risk;
        next.expedition.log = [`野営の火を嗅ぎつけた強敵。体力 +${consumed.risk}。`];
      }
      return next;
    }
    return originalAct(state, action);
  };

  E.__fieldCampWired = true;
})();