/* #709 Mobile UI: keep high-frequency camp navigation thumb-reachable. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CrownlessBottomNavigation = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function navLabel(value) {
    return value === 'gear' ? '装備' : '遠征';
  }

  function enhance(rootEl) {
    const game = rootEl || (typeof document !== 'undefined' ? document.querySelector('#game') : null);
    if (!game) return false;
    const tabs = game.querySelector('.camp-tabs');
    if (!tabs) return false;
    tabs.classList.add('bottom-navigation');
    tabs.setAttribute('aria-label', '主要ナビゲーション');
    tabs.querySelectorAll('[data-action="tab"]').forEach(button => {
      const value = button.dataset.value || 'explore';
      button.classList.add('bottom-navigation-item');
      button.setAttribute('aria-label', navLabel(value));
      const active = button.classList.contains('active');
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    return true;
  }

  function install() {
    const game = document.querySelector('#game');
    if (!game) return;
    const apply = () => enhance(game);
    new MutationObserver(apply).observe(game, { childList: true, subtree: true });
    apply();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  return { navLabel, enhance };
});
