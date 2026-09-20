(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!E || !root) return;

  const originalAct = E.act;
  const lowEnough = state => {
    const x = state?.expedition;
    return !!x && x.hp <= Math.ceil(E.maxHp(state) / 3);
  };

  E.canDesperatePush = state => {
    const x = state?.expedition;
    return !!x && x.stage === 'cleared' && x.depth < 3 && lowEnough(state);
  };

  E.act = (state, action) => {
    if (action !== 'desperate') return originalAct(state, action);
    if (!E.canDesperatePush(state)) return state;
    const next = JSON.parse(JSON.stringify(state));
    const x = next.expedition;
    x.depth += 1;
    x.room = 0;
    x.stage = 'path';
    x.potions = 0;
    x.log = [`決死の前進。深度 ${x.depth} へ。深層ほど戦利品は増えるが、薬草は置いていく。退路は細い。`];
    return next;
  };

  function injectChoice() {
    const deeper = root.querySelector('[data-action="deeper"]');
    if (!deeper || root.querySelector('[data-action="desperate"]')) return;
    const hpText = root.textContent || '';
    const hpMatch = hpText.match(/体力\s*(\d+)\s*\/\s*(\d+)/);
    if (!hpMatch || Number(hpMatch[1]) > Math.ceil(Number(hpMatch[2]) / 3)) return;
    const button = document.createElement('button');
    button.className = 'choice desperate-push';
    button.dataset.action = 'desperate';
    button.innerHTML = '<strong>決死の前進</strong><small>深層の戦利品を狙う · 残りの薬草を置いていく</small>';
    deeper.insertAdjacentElement('afterend', button);
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; injectChoice(); });
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
})();
