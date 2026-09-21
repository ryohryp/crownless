(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CrownlessGearStory = api; api.install(root); }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function storyFor(report, gear, placeName) {
    if (!report || report.died || !Array.isArray(report.newGear) || !report.newGear.includes(gear)) return null;
    return `${placeName}・深層${report.depth}から生還`;
  }

  function install(root) {
    const E = root.CrownlessSlice;
    const game = root.document?.querySelector('#game');
    if (!E || !game || !root.localStorage) return;
    const key = (mode, gear) => `crownless-gear-story-v1-${mode}-${gear}`;
    const current = () => {
      try {
        const mode = root.localStorage.getItem('crownless-expedition-mode');
        const state = mode && E.parse(root.localStorage.getItem(`crownless-expedition-v1-${mode}`));
        return mode && state ? { mode, state } : null;
      } catch { return null; }
    };
    const remember = (mode, state) => {
      const report = state.report;
      if (!report || report.died) return;
      const placeName = E.place(report.place)?.name || '名もなき土地';
      report.newGear.forEach(gear => {
        if (gear === 'crown') return;
        const text = storyFor(report, gear, placeName);
        try { if (text && !root.localStorage.getItem(key(mode, gear))) root.localStorage.setItem(key(mode, gear), text); } catch {}
      });
    };
    const decorate = () => {
      const value = current();
      if (!value) return;
      remember(value.mode, value.state);
      game.querySelectorAll('button[data-action="equip"][data-value]').forEach(button => {
        const gear = button.dataset.value;
        let text = null;
        try { text = root.localStorage.getItem(key(value.mode, gear)); } catch {}
        const old = button.querySelector('[data-gear-story]');
        if (!text) { old?.remove(); return; }
        if (old?.textContent === `✦ ${text}`) return;
        old?.remove();
        const note = root.document.createElement('small');
        note.dataset.gearStory = '';
        note.textContent = `✦ ${text}`;
        button.appendChild(note);
      });
    };
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      root.requestAnimationFrame(() => { queued = false; decorate(); });
    };
    new root.MutationObserver(schedule).observe(game, { childList: true, subtree: true });
    schedule();
  }

  return { storyFor, install };
});
