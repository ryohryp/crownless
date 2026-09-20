(() => {
  'use strict';
  const root = document.querySelector('#game');
  if (!root || typeof navigator.vibrate !== 'function') return;

  const modeKey = () => {
    try {
      const mode = localStorage.getItem('crownless-expedition-mode');
      return mode ? `crownless-expedition-v1-${mode}` : null;
    } catch { return null; }
  };

  const discoveredCount = () => {
    try {
      const key = modeKey();
      if (!key) return null;
      const save = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(save?.unlocked) ? save.unlocked.length : null;
    } catch { return null; }
  };

  let previous = discoveredCount();
  let queued = false;
  const inspect = () => {
    queued = false;
    const current = discoveredCount();
    if (current == null) return;
    if (previous != null && current > previous) navigator.vibrate(70);
    previous = current;
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(inspect);
  };

  // The game only writes a discovery after the player has stopped and explicitly
  // observed/scouted. We react to the saved result; no background GPS or prompt to
  // keep looking at the screen is introduced.
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  root.addEventListener('click', schedule);
})();
