/* #647 Wounded Prey: one short chase after a wounded strong enemy. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownlessWoundedPrey = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const THRESHOLD = 0.35;

  function wrapEngine(E) {
    if (!E || E.__woundedPreyWrapped) return E;
    const originalAct = E.act;
    E.act = function (state, action) {
      const before = state?.expedition?.enemy;
      const canFlee = before && before.elite && !before.woundedChase && before.hp > 0;
      const next = originalAct(state, action);
      const x = next?.expedition;

      if (canFlee && x?.enemy && x.enemy.elite && x.enemy.hp > 0 && x.enemy.hp <= Math.ceil(x.enemy.maxHp * THRESHOLD)) {
        const wounded = { kind: x.enemy.kind, hp: x.enemy.hp, maxHp: x.enemy.maxHp, depth: x.enemy.depth };
        x.enemy = null;
        x.stage = 'wounded-prey';
        x.woundedPrey = wounded;
        x.log = [`${wounded.kind === 'wolf' ? '土地の主' : '強敵'}が血の跡を残して逃げた。追えば傷はそのまま。今なら生還を選べる。`];
      }
      return next;
    };
    Object.defineProperty(E, '__woundedPreyWrapped', { value: true });
    return E;
  }

  function installUi(doc, getState, setState, render) {
    if (!doc?.addEventListener) return;
    doc.addEventListener('click', event => {
      const button = event.target.closest?.('[data-wounded-prey]');
      if (!button) return;
      const state = getState?.();
      const x = state?.expedition;
      if (!x || x.stage !== 'wounded-prey' || !x.woundedPrey) return;
      if (button.dataset.woundedPrey === 'return') {
        setState?.(state, 'return');
        return;
      }
      if (button.dataset.woundedPrey !== 'chase') return;
      x.enemy = { ...x.woundedPrey, turn: 0, elite: true, risky: true, woundedChase: true };
      delete x.woundedPrey;
      x.stage = 'fight';
      x.log = ['血の跡を追いつめた。傷ついた強敵が、もう一度こちらを向く。'];
      render?.();
    });
  }

  function chaseMarkup(state) {
    const x = state?.expedition;
    if (!x || x.stage !== 'wounded-prey' || !x.woundedPrey) return '';
    const e = x.woundedPrey;
    return `<section class="choice-panel wounded-prey" aria-label="傷ついた獲物"><p class="kicker">WOUNDED PREY</p><h2>血の跡を追う？</h2><p>敵の傷は ${e.hp}/${e.maxHp} のまま。追えば再戦、帰れば今の戦利品を確定する。</p><div class="choices"><button class="choice" data-wounded-prey="chase"><strong>追う</strong><small>傷ついた強敵と再戦する</small></button><button class="choice" data-wounded-prey="return"><strong>帰る</strong><small>今の戦利品を持ち帰る</small></button></div></section>`;
  }

  if (typeof window !== 'undefined' && window.CrownlessSlice) wrapEngine(window.CrownlessSlice);
  return { THRESHOLD, wrapEngine, installUi, chaseMarkup };
});
