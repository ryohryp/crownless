/* #647 Wounded Prey: one short chase after a wounded strong enemy. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownlessWoundedPrey = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const THRESHOLD = 0.35;
  let latestState = null;

  function chaseMarkup(state) {
    const x = state?.expedition;
    if (!x || x.stage !== 'wounded-prey' || !x.woundedPrey) return '';
    const e = x.woundedPrey;
    return `<div class="path-decision wounded-prey"><div class="path-mobile-status"><div class="path-risk"><span>背嚢</span><strong>鉄片 ${x.scrap}</strong><small>生還で確定</small></div></div><div class="path-copy"><p class="kicker">WOUNDED PREY</p><h2>血の跡を追う？</h2><p class="path-summary">敵の傷は ${e.hp}/${e.maxHp} のまま。追えば再戦、帰れば今の戦利品を確定する。</p></div><div class="path-actions"><div class="button-stack"><button class="choice" data-action="chase"><strong>追う</strong><small>傷ついた強敵と再戦する</small></button><button class="secondary" data-action="return">ここで生還する</button></div></div></div>`;
  }

  function paint(doc) {
    const html = chaseMarkup(latestState);
    if (!html) return;
    const panel = doc?.querySelector?.('#game .panel');
    if (panel && !panel.querySelector('.wounded-prey')) panel.innerHTML = html;
  }

  function validWoundedPrey(e) {
    return e && typeof e.kind === 'string'
      && Number.isInteger(e.hp) && e.hp > 0
      && Number.isInteger(e.maxHp) && e.maxHp >= e.hp && e.maxHp <= 80
      && Number.isInteger(e.depth) && e.depth >= 1 && e.depth <= 3;
  }

  function parseWithExtension(originalParse, context, raw) {
    if (typeof raw !== 'string') return originalParse.call(context, raw);
    let saved;
    try { saved = JSON.parse(raw); } catch { return originalParse.call(context, raw); }
    const x = saved?.expedition;
    const pending = x?.stage === 'wounded-prey' && validWoundedPrey(x.woundedPrey) ? { ...x.woundedPrey } : null;
    const chased = x?.stage === 'fight' && x.enemy?.woundedChase === true;
    if (!pending && !chased) return originalParse.call(context, raw);

    const base = JSON.parse(JSON.stringify(saved));
    if (pending) {
      delete base.expedition.woundedPrey;
      base.expedition.stage = 'path';
    }
    if (chased) delete base.expedition.enemy.woundedChase;
    const parsed = originalParse.call(context, JSON.stringify(base));
    if (!parsed?.expedition) return parsed;
    if (pending) {
      parsed.expedition.stage = 'wounded-prey';
      parsed.expedition.woundedPrey = pending;
    }
    if (chased && parsed.expedition.enemy) parsed.expedition.enemy.woundedChase = true;
    return parsed;
  }

  function wrapEngine(E) {
    if (!E || E.__woundedPreyWrapped) return E;
    const originalAct = E.act, originalStart = E.start, originalParse = E.parse;
    E.parse = function (...args) { latestState = parseWithExtension(originalParse, this, args[0]); return latestState; };
    E.start = function (...args) { latestState = originalStart.apply(this, args); return latestState; };
    E.act = function (state, action) {
      const pending = state?.expedition?.stage === 'wounded-prey' && state.expedition.woundedPrey;
      if (pending && action === 'chase') {
        const next = JSON.parse(JSON.stringify(state));
        const x = next.expedition;
        x.enemy = { ...x.woundedPrey, turn: 0, elite: true, risky: true, woundedChase: true };
        delete x.woundedPrey;
        x.stage = 'fight';
        x.log = ['血の跡を追いつめた。傷ついた強敵が、もう一度こちらを向く。'];
        latestState = next;
        return next;
      }
      const before = state?.expedition?.enemy;
      const canEscape = before && before.elite && !before.woundedChase && before.hp > 0;
      const next = originalAct(state, action);
      const x = next?.expedition;
      if (canEscape && x?.enemy && x.enemy.elite && x.enemy.hp > 0 && x.enemy.hp <= Math.ceil(x.enemy.maxHp * THRESHOLD)) {
        x.woundedPrey = { kind: x.enemy.kind, hp: x.enemy.hp, maxHp: x.enemy.maxHp, depth: x.enemy.depth };
        x.enemy = null;
        x.stage = 'wounded-prey';
        x.log = ['土地の主が血の跡を残して逃げた。追えば傷はそのまま。今なら生還を選べる。'];
      }
      latestState = next;
      return next;
    };
    Object.defineProperty(E, '__woundedPreyWrapped', { value: true });
    return E;
  }

  function installBrowser(doc) {
    if (!doc || typeof MutationObserver === 'undefined') return;
    new MutationObserver(() => paint(doc)).observe(doc.documentElement, { childList: true, subtree: true });
  }

  if (typeof window !== 'undefined' && window.CrownlessSlice) { wrapEngine(window.CrownlessSlice); installBrowser(document); }
  return { THRESHOLD, wrapEngine, chaseMarkup };
});
