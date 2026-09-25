/* #621 Emergency Escape: make survival a tactical choice without adding a chase system. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.CrownlessEmergencyEscape = factory(root);
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  function escapeCost(state) {
    const x = state?.expedition;
    if (!x || x.stage !== 'fight') return null;
    if (x.gear?.length) return { kind: 'gear', id: x.gear[x.gear.length - 1] };
    if (x.scrap > 0) return { kind: 'scrap', amount: x.scrap };
    return null;
  }

  function safeEscape(state) {
    const cost = escapeCost(state);
    if (!cost) return state;
    const n = JSON.parse(JSON.stringify(state));
    const x = n.expedition;
    if (cost.kind === 'gear') x.gear.pop();
    else x.scrap = 0;
    const found = x.gear.filter(g => !n.owned.includes(g));
    n.report = { died: false, place: x.place, depth: x.depth, scrap: x.scrap, gear: [...x.gear], newGear: found, hp: x.hp, cleared: [...x.seals] };
    n.scrap += x.scrap;
    n.owned = [...new Set([...n.owned, ...x.gear])];
    n.cleared = [...new Set([...n.cleared, ...x.seals])];
    n.victories++;
    n.expedition = null;
    return n;
  }

  function install(engine) {
    if (!engine || engine.__emergencyEscapeInstalled) return engine;
    const originalAct = engine.act.bind(engine);
    engine.act = function (state, action) {
      if (action === 'flee-drop') return safeEscape(state);
      return originalAct(state, action);
    };
    engine.__emergencyEscapeInstalled = true;
    return engine;
  }

  function enhance() {
    const engine = (root && root.CrownlessSlice) || (typeof window !== 'undefined' ? window.CrownlessSlice : null);
    if (!engine) return;
    install(engine);
    const renderChoice = () => {
      const foot = document.querySelector('.combat-foot');
      const flee = foot?.querySelector('[data-action="flee"]');
      if (!foot || !flee || foot.querySelector('[data-action="flee-drop"]')) return;
      const stateText = document.querySelector('.combat-bagline')?.textContent || '';
      const gearMatch = stateText.match(/装備\s+(\d+)\s+個/);
      const scrapMatch = stateText.match(/鉄片\s+(\d+)/);
      const hasGear = Number(gearMatch?.[1] || 0) > 0;
      const scrap = Number(scrapMatch?.[1] || 0);
      if (!hasGear && scrap <= 0) return;
      const button = document.createElement('button');
      button.className = 'choice';
      button.dataset.action = 'flee-drop';
      button.innerHTML = `<strong>背嚢を捨てて確実に逃げる</strong><small>${hasGear ? '最後に拾った装備を1つ失う / 被弾なし' : `未帰還の鉄片 ${scrap} を全て失う / 被弾なし`}</small>`;
      foot.appendChild(button);
    };
    new MutationObserver(renderChoice).observe(document.querySelector('#game'), { childList: true, subtree: true });
    renderChoice();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
    else enhance();
  }

  return { escapeCost, safeEscape, install };
});
