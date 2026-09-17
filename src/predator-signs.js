(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessPredatorSigns = api;
    const boot = () => api.attach(root.document);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SIGNS = {
    wolf: { title: '裂けた樹皮', text: '低い位置に深い爪痕。獣は速く、間合いへ飛び込んでくる。', advice: '防御で受けるか、回避から反撃する準備を。' },
    knight: { title: '砕けた盾', text: '石壁の前に、正面から割られた盾が残る。守りの後に重い一撃が来る。', advice: '守りを固めた時は焦らず、気力を整える。' },
    wraith: { title: '消えた足跡', text: '泥の足跡が途中で途切れ、少し先からまた続く。狙いを外す動きに注意。', advice: '大振りを読んだら回避し、隙を逃さない。' },
    king: { title: '折れた長剣', text: '厚い刃が根元から折れている。主は守りから致命的な一撃へつなぐ。', advice: '重い一撃を受け切ろうとせず、回避の気力を残す。' },
  };
  const PLACE_ENEMY = { '囁きの森':'wolf', '鐘なき塔':'knight', '星沈みの湿原':'wraith', '灰冠の廟':'king' };

  function signFor(enemyKind) {
    const sign = SIGNS[enemyKind];
    return sign ? { ...sign } : null;
  }

  function render(root) {
    const game = root?.querySelector?.('#game');
    if (!game || game.querySelector('[data-predator-sign]')) return;
    const guardianChoice = game.querySelector('button[data-action="careful"]');
    if (!guardianChoice || !guardianChoice.textContent.includes('主に挑む')) return;
    const placeName = game.querySelector('.scene-caption h2')?.textContent?.trim();
    const sign = signFor(PLACE_ENEMY[placeName]);
    const stack = guardianChoice.closest('.button-stack');
    if (!sign || !stack) return;
    const card = root.createElement('div');
    card.className = 'notice';
    card.dataset.predatorSign = 'true';
    card.setAttribute('role', 'note');
    card.innerHTML = `<strong>強敵の痕跡 · ${sign.title}</strong><br>${sign.text}<br><small>${sign.advice}</small>`;
    stack.before(card);
  }

  function attach(root) {
    const game = root?.querySelector?.('#game');
    if (!game || typeof MutationObserver === 'undefined') return false;
    render(root);
    new MutationObserver(() => render(root)).observe(game, { childList: true, subtree: true });
    return true;
  }

  return { signFor, attach };
});
