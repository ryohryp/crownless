(() => {
  'use strict';
  const E = window.CrownlessSlice;
  const root = document.querySelector('#game');
  if (!E || !root) return;

  const current = () => {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      if (!mode) return null;
      const state = E.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`));
      return state ? { mode, state } : null;
    } catch { return null; }
  };
  const key = (mode, gear) => `crownless-gear-mark-v1-${mode}-${gear}`;
  const chosen = (mode, gear) => {
    try { return localStorage.getItem(key(mode, gear)) === 'notch' ? 'notch' : 'diamond'; }
    catch { return 'diamond'; }
  };
  const remember = (mode, gear, mark) => {
    try { localStorage.setItem(key(mode, gear), mark); } catch {}
  };

  function decorate() {
    const value = current();
    if (!value) return;
    const { mode, state } = value;
    const gear = state.equipped;
    const level = E.weaponLevel(state, gear);
    if (!level) return;
    const mark = chosen(mode, gear);

    root.querySelectorAll('[data-upgrade-mark]').forEach(group => {
      if (group.dataset.personalized === `${gear}:${level}:${mark}`) return;
      group.dataset.personalized = `${gear}:${level}:${mark}`;
      group.setAttribute('aria-label', `装備補強 ${level}・${mark === 'notch' ? '刻み印' : '菱印'}`);
      group.innerHTML = mark === 'notch'
        ? Array.from({ length: level }, (_, i) => `<path d="M${390 + i * 9} 442l7 12" fill="none" stroke="#fff1bd" stroke-width="3" stroke-linecap="round"/>`).join('')
        : Array.from({ length: level }, (_, i) => `<path d="M${390 + i * 9} 448l5-7 5 7-5 7z" fill="#d7bd79" stroke="#fff1bd" stroke-width="1"/>`).join('');
    });

    const panel = root.querySelector('.panel');
    if (!panel || !panel.textContent.includes('を補強する') || panel.querySelector('[data-gear-mark-picker]')) return;
    const host = panel.querySelector('.rule-line');
    if (!host) return;
    const picker = document.createElement('div');
    picker.dataset.gearMarkPicker = '';
    picker.className = 'gear-mark-picker';
    picker.innerHTML = `<p class="small">補強印を選ぶ · 性能は変わらない</p><div class="choice-grid"><button class="choice" type="button" data-mark="diamond" aria-pressed="${mark === 'diamond'}"><strong>菱印</strong><small>旅人の補強印</small></button><button class="choice" type="button" data-mark="notch" aria-pressed="${mark === 'notch'}"><strong>刻み印</strong><small>刃に残す刻み</small></button></div>`;
    host.appendChild(picker);
    picker.addEventListener('click', event => {
      const button = event.target.closest('button[data-mark]');
      if (!button) return;
      remember(mode, gear, button.dataset.mark);
      picker.querySelectorAll('button[data-mark]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      root.querySelectorAll('[data-upgrade-mark]').forEach(group => delete group.dataset.personalized);
      decorate();
    });
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decorate(); });
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
})();
