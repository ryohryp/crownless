(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const resetButton = document.querySelector('#reboot-dev-reset');
  if (!base || !resetButton) return;

  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm('Reboot Prototypeの世界状態だけを消して、最初からやり直しますか？');
    if (!confirmed) return;

    window.localStorage.removeItem('crownless_reboot_phase9_world_v1');
    window.localStorage.removeItem(base.STORAGE_KEY);
    window.location.reload();
  });
})();
