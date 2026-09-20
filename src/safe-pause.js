(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!E || !root) return;

  let paused = false;

  function currentState() {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!mode) return null;
      return E.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`));
    } catch { return null; }
  }

  function pauseSummary(state) {
    const x = state?.expedition;
    if (!x || x.stage === 'fight') return null;
    const place = E.place(x.place);
    const gear = x.gear?.length || 0;
    return {
      title: `${place?.name || '遠征'} · 深層 ${x.depth}`,
      progress: `${x.room + 1} / 5`,
      risk: `未帰還：鉄片 ${x.scrap}${gear ? ` / 装備 ${gear} 個` : ''}`,
      next: x.stage === 'cleared' ? '次は、生還するか深層へ進むか。' : '次は、道を選ぶかここで生還するか。'
    };
  }

  function closePause() {
    paused = false;
    document.querySelector('.safe-pause-overlay')?.remove();
    document.querySelector('[data-safe-pause]')?.focus({ preventScroll: true });
  }

  function openPause() {
    const summary = pauseSummary(currentState());
    if (!summary || paused) return;
    paused = true;
    const overlay = document.createElement('div');
    overlay.className = 'safe-pause-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '遠征を一時停止');
    overlay.innerHTML = `<div class="safe-pause-card"><p class="kicker">SAFE PAUSE · 時間は進まない</p><h2>ここで旅を止める。</h2><p class="safe-pause-place">${summary.title} · ${summary.progress}</p><div class="safe-pause-risk">${summary.risk}</div><p>${summary.next}</p><p class="small">遠征はすでに端末へ保存済み。現実の用事を済ませてから、この続きへ戻れます。</p><button class="primary" data-safe-resume>遠征を再開する</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-safe-resume]')?.focus();
  }

  function decorate() {
    if (paused) return;
    const state = currentState();
    if (!pauseSummary(state)) return;
    const panel = root.querySelector('.path-panel');
    if (!panel || panel.querySelector('[data-safe-pause]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button safe-pause-button';
    button.dataset.safePause = 'true';
    button.textContent = 'ここで一時停止';
    button.setAttribute('aria-label', '遠征を安全に一時停止する');
    panel.prepend(button);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-safe-pause]')) openPause();
    if (event.target.closest('[data-safe-resume]')) closePause();
  });
  document.addEventListener('keydown', event => {
    if (paused && event.key === 'Escape') closePause();
  });

  new MutationObserver(decorate).observe(root, { childList: true, subtree: true });
  decorate();
})();
