(() => {
  'use strict';
  const R = window.CrownlessExpeditionRiskyIdentification;
  const root = document.querySelector('#game');
  if (!R || !root) return;
  const key = 'crownless-risky-identification-v1';
  let item = null;
  try { item = JSON.parse(localStorage.getItem(key) || 'null'); } catch { item = null; }
  const persist = () => { try { item ? localStorage.setItem(key, JSON.stringify(item)) : localStorage.removeItem(key); } catch {} };
  function enhance() {
    const existing = root.querySelector('.risky-identification');
    const choice = R.describeChoice(item), panel = root.querySelector('.panel'), ledger = root.querySelector('.loot-ledger');
    const canShow = Boolean(choice && panel && ledger && !panel.querySelector('.enemy-bar'));
    if (!canShow) {
      existing?.remove();
      return;
    }
    if (existing) return;
    ledger.insertAdjacentHTML('afterend', `<div class="rule-line risky-identification" role="group" aria-label="未知装備の鑑定"><p class="kicker">UNKNOWN LOOT</p><h3>${choice.title}</h3><p class="small">${choice.description}</p><div class="choice-grid">${choice.choices.map(c => `<button class="choice" data-risky-identification="${c.id}"><strong>${c.label}</strong><small>${c.consequence}</small></button>`).join('')}</div></div>`);
  }
  root.addEventListener('click', event => {
    const choice = event.target.closest('[data-risky-identification]');
    if (choice) { item = R.choose(item, choice.dataset.riskyIdentification); persist(); enhance(); return; }
    const action = event.target.closest('button[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'risky' && !item) {
      const depth = Number(root.querySelector('.journey-note b')?.textContent || 0);
      if (depth >= 2) { item = R.createUnknownLoot(); persist(); }
    }
    if (item?.fieldTested && !item.identified && ['strike','heavy','guard','dodge','heal'].includes(action)) { item = R.revealAfterCombat(item); persist(); }
    if (item && !item.identified && ['return','flee'].includes(action)) { item = R.appraiseOnSafeReturn(item); persist(); }
    if (action === 'continue' && item?.identified) { item = null; persist(); }
    queueMicrotask(enhance);
  });
  new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  enhance();
})();
