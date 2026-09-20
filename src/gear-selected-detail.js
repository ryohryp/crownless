(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!E || !root) return;

  function currentState() {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!mode) return null;
      return E.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`));
    } catch { return null; }
  }

  function applySelectedDetail() {
    const activeGear = root.querySelector('.camp-tabs button.active[data-value="gear"]');
    const reinforce = root.querySelector('.gear-list + .rule-line, .gear-list ~ .rule-line');
    if (!activeGear || !reinforce || reinforce.querySelector('[data-selected-gear-detail]')) return;
    const state = currentState();
    if (!state?.equipped || !E.GEAR[state.equipped]) return;
    const detail = document.createElement('p');
    detail.className = 'small selected-gear-detail';
    detail.dataset.selectedGearDetail = '';
    detail.setAttribute('role', 'status');
    detail.textContent = `装備中：${E.GEAR[state.equipped].name} — ${E.gearText(state, state.equipped)}`;
    reinforce.prepend(detail);
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; applySelectedDetail(); });
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
})();
