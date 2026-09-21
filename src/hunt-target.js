/* #616 Hunt Target: one lightweight intention before departure, no daily quests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrownlessHuntTarget = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const TARGETS = {
    gear: { label: '武具を探す', help: '珍しい武具の気配を優先する' },
    scrap: { label: '鉄片を集める', help: '討伐時の鉄片を少し増やす' },
    danger: { label: '強敵を探す', help: '敵を強くする代わりに鉄片も増える' },
  };
  let target = null;
  const setTarget = value => { target = TARGETS[value] ? value : null; return target; };
  const getTarget = () => target;
  function wrapEngine(E) {
    if (!E || E.__huntTargetWrapped) return E;
    const originalStart = E.start, originalAct = E.act;
    E.start = function (state, place) {
      const next = originalStart(state, place);
      if (next !== state && next.expedition && target) {
        next.expedition.log = [`狙い：${TARGETS[target].label}。${TARGETS[target].help}。`, ...next.expedition.log];
        next.expedition.__huntTarget = target;
      }
      return next;
    };
    E.act = function (state, action) {
      const active = state?.expedition?.__huntTarget || null;
      if (state?.expedition?.__huntTarget) delete state.expedition.__huntTarget;
      let next = originalAct(state, action);
      if (active && next?.expedition) next.expedition.__huntTarget = active;
      if (active === 'scrap' && next?.expedition && state?.expedition && next.expedition.scrap > state.expedition.scrap) next.expedition.scrap += 2;
      if (active === 'danger' && next?.expedition?.enemy && !state?.expedition?.enemy) {
        next.expedition.enemy.hp += 3; next.expedition.enemy.maxHp += 3; next.expedition.enemy.risky = true;
      }
      if (active === 'gear' && next?.expedition && next.expedition.depth >= 2 && next.expedition.stage === 'path' && state?.expedition?.stage === 'fight' && !next.expedition.enemy) {
        next.expedition.log.push('武具を探す目で周囲を探る。深層の珍しい武具は、宝の気配を追うほど見つけやすい。');
      }
      return next;
    };
    Object.defineProperty(E, '__huntTargetWrapped', { value: true });
    return E;
  }
  function installUi(doc) {
    if (!doc?.addEventListener) return;
    let bypass = false, pending = null;
    doc.addEventListener('click', event => {
      const depart = event.target.closest?.('[data-action="depart"]');
      if (depart && !bypass) {
        event.preventDefault(); event.stopImmediatePropagation(); pending = depart;
        let sheet = doc.querySelector('#hunt-target-sheet');
        if (!sheet) {
          sheet = doc.createElement('div'); sheet.id = 'hunt-target-sheet'; sheet.className = 'hunt-target-sheet';
          sheet.innerHTML = `<div class="hunt-target-card" role="dialog" aria-modal="true" aria-labelledby="hunt-target-title"><p class="kicker">THIS EXPEDITION</p><h2 id="hunt-target-title">今日は、何を狙う？</h2><p class="small">結果を確定する依頼ではない。遠征の傾向を少しだけ寄せる。</p><div class="hunt-target-options">${Object.entries(TARGETS).map(([id,t]) => `<button class="choice" data-hunt-target="${id}"><strong>${t.label}</strong><small>${t.help}</small></button>`).join('')}</div><button class="text-button" data-hunt-cancel>やめる</button></div>`;
          doc.body.appendChild(sheet);
        }
        sheet.hidden = false; sheet.querySelector('[data-hunt-target]')?.focus(); return;
      }
      const choice = event.target.closest?.('[data-hunt-target]');
      if (choice && pending) {
        setTarget(choice.dataset.huntTarget); doc.querySelector('#hunt-target-sheet').hidden = true;
        bypass = true; pending.click(); bypass = false; pending = null; return;
      }
      if (event.target.closest?.('[data-hunt-cancel]')) { doc.querySelector('#hunt-target-sheet').hidden = true; pending = null; }
    }, true);
  }
  if (typeof window !== 'undefined' && window.CrownlessSlice) { wrapEngine(window.CrownlessSlice); installUi(document); }
  return { TARGETS, setTarget, getTarget, wrapEngine, installUi };
});
