(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const phase9 = window.CrownlessRebootPhase9Combat;
  const resetButton = document.querySelector('#reboot-dev-reset');
  if (!base || !resetButton) return;

  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm('Reboot Prototypeの世界状態だけを消して、最初からやり直しますか？');
    if (!confirmed) return;

    if (phase9 && phase9.STORAGE_KEY) window.localStorage.removeItem(phase9.STORAGE_KEY);
    window.localStorage.removeItem(base.STORAGE_KEY);
    window.location.reload();
  });
})();
