(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!E || !root) return;

  const currentState = () => {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!mode) return null;
      return E.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`));
    } catch { return null; }
  };

  function applyMark() {
    const state = currentState();
    if (!state?.equipped) return;
    const level = E.weaponLevel(state, state.equipped);
    if (!level) return;
    root.querySelectorAll('.scene svg:not([data-reinforced])').forEach(svg => {
      svg.dataset.reinforced = String(level);
      const marks = Array.from({ length: level }, (_, i) =>
        `<path d="M${390 + i * 9} 448l5-7 5 7-5 7z" fill="#d7bd79" stroke="#fff1bd" stroke-width="1"/>`
      ).join('');
      svg.insertAdjacentHTML('beforeend', `<g data-upgrade-mark aria-label="装備補強 ${level}" role="img">${marks}</g>`);
    });
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; applyMark(); });
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
})();