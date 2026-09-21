(() => {
  'use strict';
  const MapFragment = window.CrownlessTreasureMapFragment;
  const root = document.querySelector('#game');
  if (!MapFragment || !root) return;

  const text = (selector, scope = root) => (scope.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();

  function render() {
    const panel = root.querySelector('.panel');
    const kicker = text('.panel > .kicker');
    if (!panel || !kicker.startsWith('SAFE RETURN') || panel.querySelector('.treasure-map-fragment')) return;

    const place = kicker.split('/').slice(1).join('/').trim();
    const result = text('.result-number');
    const scrap = Number(result.match(/([0-9]+)/)?.[1] || 0);
    const gear = Array.from(panel.querySelectorAll('.reward strong')).map(node => node.textContent.trim());
    const fragment = MapFragment.fragmentFor({ place, died: false, scrap, gear });
    if (!fragment) return;

    const section = document.createElement('section');
    section.className = 'treasure-map-fragment reward';
    section.setAttribute('aria-label', '次の探索につながる地図の断片');
    section.innerHTML = `<span class="reward-icon">⌁</span><div><p class="kicker">FOUND CLUE · 次の未知</p><strong>${fragment.title}</strong><small>${fragment.direction}へ伸びる線。${fragment.hint}<br>何があるかは、まだ分からない。</small></div>`;
    const actions = panel.querySelector('.button-stack');
    panel.insertBefore(section, actions || null);
  }

  new MutationObserver(render).observe(root, { childList: true, subtree: true });
  render();
})();
