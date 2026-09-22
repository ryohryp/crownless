(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const Camp = window.CrownlessFieldCamp;
  if (!E || !Camp) return;

  function currentExpedition() {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!['demo', 'walk'].includes(mode)) return null;
      return E.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`))?.expedition || null;
    } catch { return null; }
  }

  function sync() {
    const actions = document.querySelector('.path-actions');
    if (!actions || actions.querySelector('[data-action="field-camp"]')) return;
    const x = currentExpedition();
    if (!x || x.stage !== 'path') return;
    const preview = Camp.preview({ ...x, maxHp: Number(x.maxHp) || Number(document.querySelector('.vitals [aria-valuemax]')?.getAttribute('aria-valuemax')) || 30 });
    if (!preview) return;
    const button = document.createElement('button');
    button.className = 'choice';
    button.dataset.action = 'field-camp';
    button.innerHTML = `<strong>野営する · 体力 +${preview.recover}</strong><small>遠征中1回 / 次の遭遇は敵体力 +${preview.nextRisk}</small>`;
    const stack = actions.querySelector('.button-stack');
    (stack || actions).appendChild(button);
  }

  const observer = new MutationObserver(sync);
  observer.observe(document.querySelector('#game'), { childList: true, subtree: true });
  sync();
})();