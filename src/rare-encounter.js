/* #611 Rare Encounter: a small, uncommon decision that makes expeditions less predictable. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.CrownlessRareEncounter = factory(root);
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  const MARK = '【希少遭遇】霧の中に、主のいない荷車が止まっている。';

  function shouldAppear(state) {
    const x = state?.expedition;
    return !!(x && x.stage === 'cleared' && x.depth === 1 && state.runs % 4 === 2 && !x.rareEncounterSeen);
  }

  function seed(state) {
    if (!shouldAppear(state)) return state;
    const n = JSON.parse(JSON.stringify(state));
    n.expedition.rareEncounterSeen = true;
    n.expedition.rareEncounterPending = true;
    n.expedition.log = [MARK];
    return n;
  }

  function resolve(state, choice) {
    const x = state?.expedition;
    if (!x?.rareEncounterPending) return state;
    const n = JSON.parse(JSON.stringify(state));
    const e = n.expedition;
    e.rareEncounterPending = false;
    if (choice === 'rare-search') {
      e.hp = Math.max(1, e.hp - 3);
      e.scrap += 7;
      e.log = ['荷車を探った。錆びた留め金の奥から鉄片を拾う。体力 −3 / 鉄片 +7。'];
    } else {
      e.scrap += 2;
      e.log = ['荷車には深入りせず、道端の包みだけを拾った。鉄片 +2。'];
    }
    return n;
  }

  function install(engine) {
    if (!engine || engine.__rareEncounterInstalled) return engine;
    const originalAct = engine.act.bind(engine);
    engine.act = function (state, action) {
      if (action === 'rare-search' || action === 'rare-leave') return resolve(state, action);
      return seed(originalAct(state, action));
    };
    engine.__rareEncounterInstalled = true;
    return engine;
  }

  function enhance() {
    const engine = (root && root.CrownlessSlice) || (typeof window !== 'undefined' ? window.CrownlessSlice : null);
    const game = document.querySelector('#game');
    if (!engine || !game) return;
    install(engine);
    const decorate = () => {
      const panel = game.querySelector('.path-decision');
      if (!panel || panel.querySelector('.rare-encounter')) return;
      if (!panel.textContent.includes(MARK)) return;
      const anchor = panel.querySelector('button[data-action="return"]');
      if (!anchor) return;
      const box = document.createElement('div');
      box.className = 'rare-encounter';
      box.innerHTML = '<strong>主のいない荷車</strong><small>滅多にない気配だ。調べれば何かありそうだが、霧の中で足を止めることになる。</small><button class="choice" data-action="rare-search"><strong>荷車を探る</strong><small>体力 −3 / 鉄片 +7</small></button><button class="choice" data-action="rare-leave"><strong>深入りしない</strong><small>鉄片 +2 / 傷を負わない</small></button>';
      anchor.before(box);
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
