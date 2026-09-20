(() => {
  'use strict';

  function decorate(root = document) {
    const panel = root.querySelector('.path-decision');
    if (!panel) return;
    const risk = panel.querySelector('.path-risk');
    if (!risk) return;

    const scrap = risk.querySelector('strong')?.textContent?.trim() || '';
    const gear = risk.querySelector('small')?.textContent?.trim() || '';
    const returnButton = panel.querySelector('button[data-action="return"]');
    const deeperButton = panel.querySelector('button[data-action="deeper"]');
    if (!returnButton || !deeperButton) return;

    const stake = [scrap, gear].filter(Boolean).join(' · ');
    returnButton.classList.add('return-risk-choice', 'return-risk-choice--safe');
    deeperButton.classList.add('return-risk-choice', 'return-risk-choice--risk');

    if (!returnButton.dataset.riskDecorated) {
      returnButton.dataset.riskDecorated = 'true';
      const small = document.createElement('small');
      small.className = 'return-risk-choice__stake';
      small.textContent = `${stake}を確定する`;
      returnButton.appendChild(small);
    }
    if (!deeperButton.dataset.riskDecorated) {
      deeperButton.dataset.riskDecorated = 'true';
      const small = document.createElement('small');
      small.className = 'return-risk-choice__stake';
      small.textContent = `${stake}を賭ける`;
      deeperButton.appendChild(small);
    }
  }

  const root = document.querySelector('#game');
  if (!root) return;
  decorate();
  new MutationObserver(() => decorate()).observe(root, { childList: true, subtree: true });
})();
