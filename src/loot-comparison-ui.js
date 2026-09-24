(() => {
  'use strict';
  const C = window.CrownlessLootComparison, E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!C || !E || !root) return;

  function enhance() {
    root.querySelectorAll('.loot-comparison-moment').forEach(node => node.remove());
    const ledger = root.querySelector('.loot-ledger');
    if (!ledger) return;
    const currentLine = [...ledger.querySelectorAll('small')]
      .map(node => node.textContent?.trim() || '')
      .find(text => text.startsWith('現在装備：'));
    const currentGearName = currentLine?.slice('現在装備：'.length).split(' · ')[0].trim();
    const currentName = E.GEAR && Object.entries(E.GEAR).find(([, gear]) => gear.name === currentGearName)?.[0];
    if (!currentName) return;
    const found = [...ledger.querySelectorAll('p')].map(p => p.textContent.trim()).find(text => text.startsWith('＋ '));
    if (!found) return;
    const foundName = found.slice(2).split('\n')[0].trim();
    const foundId = Object.entries(E.GEAR).find(([, gear]) => gear.name === foundName)?.[0];
    if (!foundId) return;
    const comparison = C.compare(currentName, foundId, E, window.__crownlessState || null);
    if (!comparison) return;
    const rows = comparison.rows.map(row => `<li><small>${row.label}</small><strong>${row.value}</strong></li>`).join('');
    ledger.insertAdjacentHTML('afterend', `<div class="rule-line loot-comparison-moment" aria-label="拾った装備と現在装備の比較"><p class="kicker">FOUND · 持ち帰る価値</p><h3>${comparison.found}</h3><p class="small">現在：${comparison.current}</p><ul class="loot-comparison-rows">${rows}</ul></div>`);
  }

  new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  enhance();
})();
