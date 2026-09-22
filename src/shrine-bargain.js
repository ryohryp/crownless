/* #615 Shrine Bargain: one clear, optional risk/reward choice in the deep. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessShrineBargain = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const MARK = '【古い祠】欠けた石皿に、まだ温かな灰が残っている。';

  function shouldAppear(state) {
    const x = state?.expedition;
    return !!(x && x.stage === 'cleared' && x.depth >= 2 && x.hp > 6 && !x.shrineBargainSeen && state.runs % 4 === 2);
  }

  function seed(state) {
    if (!shouldAppear(state)) return state;
    const n = JSON.parse(JSON.stringify(state));
    n.expedition.shrineBargainSeen = true;
    n.expedition.shrineBargainPending = true;
    n.expedition.log = [MARK];
    return n;
  }

  function resolve(state, choice) {
    if (!state?.expedition?.shrineBargainPending) return state;
    const n = JSON.parse(JSON.stringify(state));
    const x = n.expedition;
    x.shrineBargainPending = false;
    if (choice === 'shrine-offer') {
      x.hp = Math.max(1, x.hp - 5);
      x.potions = Math.min(3, (x.potions || 0) + 2);
      x.log = ['血を石皿へ落とした。体力 −5。灰が薬草を包み、薬草を2つ得た。'];
    } else {
      x.log = ['祠には触れず、先へ進む。'];
    }
    return n;
  }

  function install(engine) {
    if (!engine || engine.__shrineBargainInstalled) return engine;
    const originalAct = engine.act.bind(engine);
    engine.act = function (state, action) {
      if (action === 'shrine-offer' || action === 'shrine-decline') return resolve(state, action);
      return seed(originalAct(state, action));
    };
    engine.__shrineBargainInstalled = true;
    return engine;
  }

  function enhance() {
    const engine = root.CrownlessSlice;
    const game = document.querySelector('#game');
    if (!engine || !game) return;
    install(engine);
    const decorate = () => {
      const panel = game.querySelector('.path-decision');
      if (!panel || panel.querySelector('.shrine-bargain') || !panel.textContent.includes(MARK)) return;
      const actions = panel.querySelector('.path-actions');
      if (!actions) return;
      const secondaryRow = actions.querySelector('.path-secondary-row');
      const box = document.createElement('div');
      box.className = 'shrine-bargain';
      box.innerHTML = '<strong>灰の祠</strong><small>代償と恵みは選ぶ前に分かる。断っても何も失わない。</small><button class="choice" data-action="shrine-offer"><strong>血を捧げる</strong><small>体力 −5 / 薬草 +2（最大3）</small></button><button class="choice" data-action="shrine-decline"><strong>触れずに去る</strong><small>何も失わない</small></button>';
      actions.insertBefore(box, secondaryRow || null);
    };
    new MutationObserver(decorate).observe(game, { childList: true, subtree: true });
    decorate();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
    else enhance();
  }

  return { MARK, shouldAppear, seed, resolve, install };
});
