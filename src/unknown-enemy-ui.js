(() => {
  'use strict';
  const U = window.CrownlessUnknownEnemy;
  const root = document.querySelector('#game');
  if (!U || !root) return;

  const KEY = 'crownless-unknown-enemy-v1';
  const combatActions = new Set(['strike', 'heavy', 'guard', 'dodge', 'heal', 'flee']);
  const readMemory = () => {
    try { return U.initial(JSON.parse(localStorage.getItem(KEY) || '[]')); }
    catch { return U.initial(); }
  };
  const writeMemory = memory => {
    try { localStorage.setItem(KEY, JSON.stringify(memory.known)); }
    catch { /* The encounter remains playable when storage is unavailable. */ }
  };

  function renderUnknownIntent() {
    const heading = root.querySelector('.panel h2');
    const intent = root.querySelector('.intent');
    if (!heading || !intent || !heading.textContent.includes('茨牙の狼')) return;
    const memory = readMemory();
    const view = U.describe(memory, U.TARGET, '');
    if (!view.hidden || intent.dataset.unknownEnemyRendered === U.TARGET) return;
    intent.dataset.unknownEnemyRendered = U.TARGET;
    intent.innerHTML = '<p class="kicker">次の行動 · 初遭遇</p><span class="damage">?</span><strong>動きが読めない</strong><small>低く身構えている。攻撃の瞬間までは読めない。防御か回避なら様子を見やすい。</small>';
    intent.setAttribute('aria-label', '初遭遇の敵。次の行動はまだ読めない');
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !combatActions.has(button.dataset.action)) return;
    const heading = root.querySelector('.panel h2');
    if (!heading?.textContent.includes('茨牙の狼')) return;
    const memory = readMemory();
    if (!memory.known.includes(U.TARGET)) writeMemory(U.learn(memory, U.TARGET));
  });

  new MutationObserver(renderUnknownIntent).observe(root, { childList: true, subtree: true });
  renderUnknownIntent();
})();