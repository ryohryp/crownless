(() => {
  'use strict';
  const root = document.querySelector('#game');
  if (!root) return;

  function enhanceReturn() {
    const kicker = root.querySelector('.panel .kicker');
    const stack = root.querySelector('.panel .button-stack');
    if (!kicker || !stack || !kicker.textContent.includes('SAFE RETURN') || stack.querySelector('[data-quick-re-expedition]')) return;

    const continueButton = stack.querySelector('[data-action="continue"]');
    if (!continueButton) return;

    const again = document.createElement('button');
    again.className = 'secondary';
    again.dataset.quickReExpedition = 'true';
    again.innerHTML = '<strong>同じ土地へ、もう一度</strong><small>今の装備のまま即再出発</small>';
    again.addEventListener('click', () => {
      continueButton.click();
      queueMicrotask(() => root.querySelector('[data-action="depart"]:not(:disabled)')?.click());
    });
    stack.appendChild(again);
  }

  new MutationObserver(enhanceReturn).observe(root, { childList: true, subtree: true });
  enhanceReturn();
})();
