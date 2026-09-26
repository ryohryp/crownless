(() => {
  'use strict';
  const C = window.CrownlessLootComparison, E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!C || !E || !root) return;

  function enhance() {
    if (root.querySelector('.loot-comparison-moment')) return;
    const ledger = root.querySelector('.loot-ledger');
    if (!ledger) return;
    const currentName = ledger.querySelector('[data-current-gear-id]')?.dataset.currentGearId;
    if (!currentName || !E.GEAR?.[currentName]) return;
    const foundId = ledger.querySelector('[data-found-gear-id]')?.dataset.foundGearId;
    if (!foundId || !E.GEAR?.[foundId]) return;
    const comparison = C.compare(currentName, foundId, E, window.__crownlessState || null);
    if (!comparison) return;
    const rows = comparison.rows.map(row => `<li><small>${row.label}</small><strong>${row.value}</strong></li>`).join('');
    const comparisonAnchor = ledger.closest('.path-desktop-details') || ledger;
    comparisonAnchor.insertAdjacentHTML('afterend', `<div class="rule-line loot-comparison-moment" aria-label="拾った装備と現在装備の比較"><p class="kicker">FOUND · 持ち帰る価値</p><h3>${comparison.found}</h3><p class="small">現在：${comparison.current}</p><ul class="loot-comparison-rows">${rows}</ul></div>`);
  }

  new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  enhance();
})();
