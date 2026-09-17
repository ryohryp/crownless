(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessPredatorSigns = api;
    const boot = () => api.attach(root.document, root.localStorage);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const MEMORY_KEY = 'crownless-guardian-tells-v1';
  const SIGNS = {
    wolf: { title: '裂けた樹皮', text: '低い位置に深い爪痕。獣は速く、間合いへ飛び込んでくる。', advice: '防御で受けるか、回避から反撃する準備を。', learned: '前回の記憶：大振りの前に一度、素早く間合いへ入る。回避の気力を残す。' },
    knight: { title: '砕けた盾', text: '石壁の前に、正面から割られた盾が残る。守りの後に重い一撃が来る。', advice: '守りを固めた時は焦らず、気力を整える。', learned: '前回の記憶：守りを固めた次は重い一撃。守り中に気力を整え、次を回避する。' },
    wraith: { title: '消えた足跡', text: '泥の足跡が途中で途切れ、少し先からまた続く。狙いを外す動きに注意。', advice: '大振りを読んだら回避し、隙を逃さない。', learned: '前回の記憶：素早い攻撃が続いた後に隙が来る。焦って気力を使い切らない。' },
    king: { title: '折れた長剣', text: '厚い刃が根元から折れている。主は守りから致命的な一撃へつなぐ。', advice: '重い一撃を受け切ろうとせず、回避の気力を残す。', learned: '前回の記憶：守りから大振りへつなぐ。守りを攻め急がず、回避の気力を残す。' },
  };
  const PLACE_ENEMY = { '囁きの森':'wolf', '鐘なき塔':'knight', '星沈みの湿原':'wraith', '灰冠の廟':'king' };

  function signFor(enemyKind, learned = false) {
    const sign = SIGNS[enemyKind];
    if (!sign) return null;
    const { learned: memory, ...base } = sign;
    return learned ? { ...base, memory } : base;
  }
  function readMemory(storage) {
    try {
      const value = JSON.parse(storage?.getItem?.(MEMORY_KEY) || '[]');
      return Array.isArray(value) ? value.filter(kind => SIGNS[kind]) : [];
    } catch { return []; }
  }
  function remember(storage, enemyKind) {
    if (!SIGNS[enemyKind]) return false;
    const seen = readMemory(storage);
    if (seen.includes(enemyKind)) return false;
    try { storage?.setItem?.(MEMORY_KEY, JSON.stringify([...seen, enemyKind])); return true; }
    catch { return false; }
  }

  function render(root, storage) {
    const game = root?.querySelector?.('#game');
    if (!game || game.querySelector('[data-predator-sign]')) return;
    const guardianChoice = game.querySelector('button[data-action="careful"]');
    if (!guardianChoice || !guardianChoice.textContent.includes('主に挑む')) return;
    const placeName = game.querySelector('.scene-caption h2')?.textContent?.trim();
    const enemyKind = PLACE_ENEMY[placeName];
    const learned = readMemory(storage).includes(enemyKind);
    const sign = signFor(enemyKind, learned);
    const stack = guardianChoice.closest('.button-stack');
    if (!sign || !stack) return;
    const card = root.createElement('div');
    card.className = 'notice';
    card.dataset.predatorSign = 'true';
    card.setAttribute('role', 'note');
    card.innerHTML = `<strong>${learned ? '覚えている強敵の痕跡' : '強敵の痕跡'} · ${sign.title}</strong><br>${sign.text}<br><small>${sign.memory || sign.advice}</small>`;
    stack.before(card);
    remember(storage, enemyKind);
  }

  function attach(root, storage) {
    const game = root?.querySelector?.('#game');
    if (!game || typeof MutationObserver === 'undefined') return false;
    render(root, storage);
    new MutationObserver(() => render(root, storage)).observe(game, { childList: true, subtree: true });
    return true;
  }

  return { MEMORY_KEY, signFor, readMemory, remember, attach };
});
