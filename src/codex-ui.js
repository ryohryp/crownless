/* Minimal player-facing arsenal codex for #838. Reads existing save state only. */
(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!E || !root) return;
  const saveKey = mode => `crownless-expedition-v1-${mode}`;
  const readState = () => {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      return E.parse(mode ? localStorage.getItem(saveKey(mode)) : null);
    } catch { return null; }
  };
  const renderCodex = panel => {
    const s = readState();
    if (!s) { panel.innerHTML = '<p class="small">遠征の記録はまだありません。</p>'; return; }
    const ids = Object.keys(E.GEAR).filter(id => id !== 'crown');
    const found = new Set(s.owned || []);
    panel.innerHTML = `<p class="kicker">TRAVELER'S CODEX · ARSENAL</p><h2>旅人の手記 · 武具録</h2><p class="small">焚き火まで持ち帰った武具だけが、この頁に刻まれる。 ${ids.filter(id => found.has(id)).length}/${ids.length}</p><div class="gear-list">${ids.map(id => found.has(id) ? `<div class="choice"><strong>${E.GEAR[id].name} · ${E.qualityLabel(E.weaponQuality(s,id))}</strong><small>補強 ${E.weaponLevel(s,id)}/4 · ${E.gearText(s,id)}</small></div>` : '<div class="choice" aria-label="未発見の武具"><strong>？ 未発見の武具</strong><small>霧の向こうで、まだ名を持たない。</small></div>').join('')}</div>`;
  };
  // The core owns all navigation. This module only paints journal content.
  window.CrownlessCodexUI = { renderCodex };
})();
