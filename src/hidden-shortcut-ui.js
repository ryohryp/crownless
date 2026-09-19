(() => {
  'use strict';
  const Shortcut = window.CrownlessHiddenShortcut;
  const E = window.CrownlessSlice;
  if (!Shortcut || !E) return;

  let routeChoice = 'normal';
  const originalStart = E.start;
  E.start = function startWithShortcutChoice(state, place) {
    const next = originalStart(state, place);
    if (routeChoice === 'shortcut') Shortcut.applyToExpedition(next, 'shortcut');
    routeChoice = 'normal';
    return next;
  };

  function savedState() {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!['demo', 'walk'].includes(mode)) return null;
      return JSON.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`) || 'null');
    } catch { return null; }
  }

  function renderChoice() {
    const depart = document.querySelector('[data-action="depart"]');
    if (!depart || document.querySelector('.shortcut-route-choice')) return;
    const saved = savedState();
    if (!saved || !Shortcut.choices(saved).some(choice => choice.id === 'shortcut')) return;

    const box = document.createElement('div');
    box.className = 'shortcut-route-choice rule-line';
    box.innerHTML = '<p class="kicker">見つけた近道</p><p class="small">次の遠征だけ、道を選べる。</p><div class="choice-grid"><button type="button" class="choice selected" data-shortcut-route="normal" aria-pressed="true"><strong>通常ルート</strong><small>浅層の戦利品機会を残す</small></button><button type="button" class="choice" data-shortcut-route="shortcut" aria-pressed="false"><strong>近道を使う</strong><small>浅層1区画を飛ばす · 戦利品機会を失う</small></button></div>';
    depart.parentElement.insertBefore(box, depart);
    box.addEventListener('click', event => {
      const button = event.target.closest('[data-shortcut-route]');
      if (!button) return;
      routeChoice = button.dataset.shortcutRoute;
      box.querySelectorAll('[data-shortcut-route]').forEach(item => {
        const active = item === button;
        item.classList.toggle('selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
  }

  const observer = new MutationObserver(renderChoice);
  observer.observe(document.querySelector('#game'), { childList: true, subtree: true });
  renderChoice();
})();