(() => {
  'use strict';

  const RECOVER_HP = 8;
  const RISK_PENALTY = 4;

  function canCamp(expedition) {
    return Boolean(expedition && !expedition.fieldCampUsed && Number(expedition.hp) > 0 && Number(expedition.hp) < Number(expedition.maxHp || 30));
  }

  function preview(expedition) {
    if (!canCamp(expedition)) return null;
    const maxHp = Number(expedition.maxHp || 30);
    const hp = Number(expedition.hp || 0);
    const recover = Math.min(RECOVER_HP, Math.max(0, maxHp - hp));
    return { recover, nextRisk: RISK_PENALTY, label: `野営する — HP +${recover} / 次の遭遇は敵体力 +${RISK_PENALTY}` };
  }

  function apply(expedition) {
    if (!canCamp(expedition)) return expedition;
    const maxHp = Number(expedition.maxHp || 30);
    return { ...expedition, hp: Math.min(maxHp, Number(expedition.hp || 0) + RECOVER_HP), fieldCampUsed: true, fieldCampRisk: RISK_PENALTY };
  }

  function consumeRisk(expedition) {
    if (!expedition || !expedition.fieldCampRisk) return { expedition, risk: 0 };
    const risk = Number(expedition.fieldCampRisk) || 0;
    return { expedition: { ...expedition, fieldCampRisk: 0 }, risk };
  }

  const api = Object.freeze({ canCamp, preview, apply, consumeRisk, RECOVER_HP, RISK_PENALTY });
  window.CrownlessFieldCamp = api;

  const E = window.CrownlessSlice;
  if (!E || E.__fieldCampWired) return;
  const originalStart = E.start;
  const originalAct = E.act;

  E.start = function (state, placeId) {
    const next = originalStart(state, placeId);
    if (next !== state && next.expedition) next.expedition.maxHp = E.maxHp(next);
    return next;
  };

  E.act = function (state, action) {
    const x = state?.expedition;
    if (action === 'field-camp') {
      if (!x || x.stage !== 'path') return state;
      const next = JSON.parse(JSON.stringify(state));
      next.expedition.maxHp = E.maxHp(next);
      const beforeHp = next.expedition.hp;
      next.expedition = apply(next.expedition);
      if (!next.expedition.fieldCampUsed) return state;
      next.expedition.log = [`野営で体力 +${next.expedition.hp - beforeHp}。次の遭遇は敵体力 +${RISK_PENALTY}。`];
      return next;
    }
    if (x && x.stage === 'path' && ['careful', 'risky'].includes(action) && x.fieldCampRisk) {
      const prepared = JSON.parse(JSON.stringify(state));
      const consumed = consumeRisk(prepared.expedition);
      prepared.expedition = consumed.expedition;
      const next = originalAct(prepared, action);
      if (next?.expedition?.enemy && consumed.risk > 0) {
        next.expedition.enemy.hp += consumed.risk;
        next.expedition.enemy.maxHp += consumed.risk;
        next.expedition.log = [`野営の火を嗅ぎつけた強敵。敵体力 +${consumed.risk}。`];
      }
      return next;
    }
    return originalAct(state, action);
  };
  E.__fieldCampWired = true;

  function currentExpedition() {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!['demo', 'walk'].includes(mode)) return null;
      return E.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`))?.expedition || null;
    } catch { return null; }
  }

  function syncButton() {
    const actions = document.querySelector('.path-actions');
    if (!actions || actions.querySelector('[data-action="field-camp"]')) return;
    const x = currentExpedition();
    if (!x || x.stage !== 'path') return;
    const maxHp = Number(x.maxHp) || Number(document.querySelector('.vitals [aria-valuemax]')?.getAttribute('aria-valuemax')) || 30;
    const p = preview({ ...x, maxHp });
    if (!p) return;
    const button = document.createElement('button');
    button.className = 'choice';
    button.dataset.action = 'field-camp';
    button.innerHTML = `<strong>野営する · 体力 +${p.recover}</strong><small>遠征中1回 / 次の遭遇は敵体力 +${p.nextRisk}</small>`;
    (actions.querySelector('.button-stack') || actions).appendChild(button);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = document.querySelector('#game');
    if (!game) return;
    new MutationObserver(syncButton).observe(game, { childList: true, subtree: true });
    syncButton();
  });
})();