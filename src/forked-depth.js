/* #654 Forked Depth: one small route choice before entering depth 2. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessForkedDepth = factory(root);
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  function canFork(state) {
    const x = state?.expedition;
    return !!x && x.stage === 'cleared' && x.depth === 1;
  }

  function install(engine) {
    if (!engine || engine.__forkedDepthInstalled) return engine;
    const originalAct = engine.act.bind(engine);
    engine.act = function (state, action) {
      if (!['fork-danger', 'fork-mystery'].includes(action) || !canFork(state)) return originalAct(state, action);
      const next = originalAct(state, 'deeper');
      const x = next.expedition;
      if (!x || x.depth !== 2) return next;
      if (action === 'fork-danger') {
        x.room = 0;
        x.log = ['獣道を選ぶ。敵の気配が濃い。戦いを越えれば、深層の戦利品へ近づける。'];
      } else {
        x.room = 1;
        x.log = ['刻印の残る脇道を選ぶ。敵影は薄いが、何かを調べる余地がある。'];
      }
      return next;
    };
    engine.__forkedDepthInstalled = true;
    return engine;
  }

  function enhance() {
    const engine = root.CrownlessSlice;
    const game = typeof document !== 'undefined' && document.querySelector('#game');
    if (!engine || !game) return;
    install(engine);
    const inject = () => {
      const deeper = game.querySelector('[data-action="deeper"]');
      if (!deeper || game.querySelector('[data-action="fork-danger"]')) return;
      const text = game.textContent || '';
      if (!/深度\s*1\b/.test(text)) return;
      const danger = document.createElement('button');
      danger.className = 'choice'; danger.dataset.action = 'fork-danger';
      danger.innerHTML = '<strong>獣道を進む</strong><small>敵の気配が濃い · 戦闘寄り</small>';
      const mystery = document.createElement('button');
      mystery.className = 'choice'; mystery.dataset.action = 'fork-mystery';
      mystery.innerHTML = '<strong>刻印の脇道を調べる</strong><small>敵影は薄い · 探索寄り</small>';
      deeper.replaceWith(danger, mystery);
    };
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; inject(); });
    };
    new MutationObserver(schedule).observe(game, { childList: true, subtree: true });
    schedule();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
    else enhance();
  }

  return { canFork, install };
});
