/* Player-facing expedition supply choice, kept outside the core engine. */
(() => {
  'use strict';
  const E = window.CrownlessSlice, S = window.CrownlessSupplies;
  if (!E || !S) return;

  let pendingPlace = null;
  let activeSupply = null;
  const originalStart = E.start;
  const originalAct = E.act;
  const originalLootCue = E.lootCue;

  E.start = function (state, place) {
    const next = originalStart(state, place);
    if (next?.expedition && activeSupply) S.applyStart(next.expedition, activeSupply);
    return next;
  };

  E.act = function (state, action) {
    const wasRationRest = action === 'rest' && state?.expedition?.supply === 'ration' && !state.expedition.supplyUsed;
    const next = originalAct(state, action);
    if (wasRationRest && next?.expedition) {
      next.expedition.supply = 'ration';
      next.expedition.supplyUsed = true;
      next.expedition.hp = Math.min(E.maxHp(next), next.expedition.hp + 4);
    }
    if (!next?.expedition) activeSupply = null;
    return next;
  };

  E.lootCue = function (...args) {
    const cue = originalLootCue(...args);
    return activeSupply === 'torch' ? `${cue}${S.cueSuffix({ supply: 'torch' })}` : cue;
  };

  function chooser(place) {
    const options = Object.entries(S.SUPPLIES).map(([id, item]) =>
      `<button class="choice" data-supply="${id}"><strong>${item.name}</strong><small>${item.help}</small></button>`
    ).join('');
    return `<div class="help supply-chooser" role="dialog" aria-modal="true" aria-label="遠征の持ち物"><p class="kicker">ONE THING FOR THE ROAD</p><h2>ひとつだけ、持っていく。</h2><p class="small">荷物管理はしない。今回の遠征で頼るものを一つ選ぶ。</p><div class="button-stack">${options}</div><button class="text-button" data-supply-cancel>戻る</button></div>`;
  }

  document.addEventListener('click', event => {
    const depart = event.target.closest('button[data-action="depart"]');
    if (depart && !depart.dataset.supplyReady) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingPlace = depart.dataset.value;
      const game = document.querySelector('#game');
      if (game) game.insertAdjacentHTML('beforeend', chooser(pendingPlace));
      document.querySelector('.supply-chooser [data-supply]')?.focus();
      return;
    }
    const choice = event.target.closest('[data-supply]');
    if (choice && pendingPlace) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeSupply = choice.dataset.supply;
      const place = pendingPlace;
      pendingPlace = null;
      document.querySelector('.supply-chooser')?.remove();
      const departButton = document.querySelector(`button[data-action="depart"][data-value="${place}"]`);
      if (departButton) {
        departButton.dataset.supplyReady = '1';
        departButton.click();
      }
      return;
    }
    if (event.target.closest('[data-supply-cancel]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pendingPlace = null;
      document.querySelector('.supply-chooser')?.remove();
    }
  }, true);
})();
