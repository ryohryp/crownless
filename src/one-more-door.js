/* #618 One More Door: one optional last temptation before a safe return. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.CrownlessOneMoreDoor = factory(root);
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  const MARK = '半開きの扉を調べた。';

  function available(state) {
    const x = state?.expedition;
    return !!(x && x.stage === 'cleared' && x.depth < 3 && x.hp > 6 && (x.scrap > 0 || x.gear?.length) && !x.log?.some(v => v.startsWith(MARK)));
  }

  function enter(state) {
    if (!available(state)) return state;
    const n = JSON.parse(JSON.stringify(state));
    const x = n.expedition;
    const reward = 4 + x.depth * 3;
    x.hp -= 6;
    x.scrap += reward;
    x.log = [`${MARK} 物音の正体は崩れた物置だった。体力 −6 / 鉄片 +${reward}。もう寄り道はない。`];
    return n;
  }

  function install(engine) {
    if (!engine || engine.__oneMoreDoorInstalled) return engine;
    const originalAct = engine.act.bind(engine);
    engine.act = function (state, action) {
      if (action === 'last-door') return enter(state);
      return originalAct(state, action);
    };
    engine.__oneMoreDoorInstalled = true;
    return engine;
  }

  function enhance() {
    const engine = (root && root.CrownlessSlice) || (typeof window !== 'undefined' ? window.CrownlessSlice : null);
    const game = document.querySelector('#game');
    if (!engine || !game) return;
    install(engine);
    const decorate = () => {
      const panel = game.querySelector('.path-decision');
      const safe = panel?.querySelector('button[data-action="return"]');
      const deeper = panel?.querySelector('button[data-action="deeper"]');
      if (!panel || !safe || !deeper || panel.querySelector('[data-action="last-door"]')) return;
      const status = panel.querySelector('.path-mobile-status')?.textContent || '';
      const hp = Number(status.match(/あなたの体力\s*(\d+)/)?.[1] || 0);
      const scrap = Number(status.match(/鉄片\s*(\d+)/)?.[1] || 0);
      const hasGear = /装備\s*[1-9]\d*\s*個/.test(status);
      const already = panel.textContent.includes(MARK);
      if (hp <= 6 || (!scrap && !hasGear) || already) return;
      const button = document.createElement('button');
      button.className = 'choice one-more-door';
      button.dataset.action = 'last-door';
      button.innerHTML = '<strong>半開きの扉を覗く</strong><small>体力 −6 / 追加の鉄片 / 無視すれば安全に生還</small>';
      deeper.before(button);
    };
    new MutationObserver(decorate).observe(game, { childList: true, subtree: true });
    decorate();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
    else enhance();
  }

  return { MARK, available, enter, install };
});
