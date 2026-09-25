/* #656 Curse Loot: a strong find that makes the trip home feel dangerous. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.CrownlessCurseLoot = factory(root);
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  const MARK = '【禍具】拾った武具が、掌の中で脈打っている。';

  function shouldAppear(state) {
    const x = state?.expedition;
    return !!(x && x.stage === 'cleared' && x.depth >= 2 && x.hp > 4 && x.gear?.length && state.runs % 5 === 3 && !x.curseLootSeen);
  }

  function seed(state) {
    if (!shouldAppear(state)) return state;
    const n = JSON.parse(JSON.stringify(state));
    n.expedition.curseLootSeen = true;
    n.expedition.curseLootPending = true;
    n.expedition.log = [MARK];
    return n;
  }

  function resolve(state, choice) {
    if (!state?.expedition?.curseLootPending) return state;
    const n = JSON.parse(JSON.stringify(state));
    const x = n.expedition;
    x.curseLootPending = false;
    if (choice === 'curse-carry') {
      x.hp = Math.max(1, x.hp - 4);
      x.log = ['禍具を抱えて進む。冷気が腕を這う。体力 −4。生還できれば武具はそのまま持ち帰れる。'];
    } else {
      const abandoned = x.gear.pop();
      x.log = [`禍具${abandoned ? `（${abandoned}）` : ''}を霧へ捨てた。体力は失わない。`];
    }
    return n;
  }

  function install(engine) {
    if (!engine || engine.__curseLootInstalled) return engine;
    const originalAct = engine.act.bind(engine);
    engine.act = function (state, action) {
      if (action === 'curse-carry' || action === 'curse-discard') return resolve(state, action);
      return seed(originalAct(state, action));
    };
    engine.__curseLootInstalled = true;
    return engine;
  }

  function enhance() {
    const engine = (root && root.CrownlessSlice) || (typeof window !== 'undefined' ? window.CrownlessSlice : null);
    const game = document.querySelector('#game');
    if (!engine || !game) return;
    install(engine);
    const decorate = () => {
      const panel = game.querySelector('.path-decision');
      if (!panel || panel.querySelector('.curse-loot') || !panel.textContent.includes(MARK)) return;
      const anchor = panel.querySelector('button[data-action="return"]');
      if (!anchor) return;
      const box = document.createElement('div');
      box.className = 'curse-loot';
      box.innerHTML = '<strong>脈打つ禍具</strong><small>強い武具だが、持っているだけで身体が冷える。生還すれば普通の装備になる。</small><button class="choice" data-action="curse-carry"><strong>持ち帰る</strong><small>体力 −4 / 武具を保持</small></button><button class="choice" data-action="curse-discard"><strong>ここで捨てる</strong><small>体力を守る / この武具を失う</small></button>';
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
