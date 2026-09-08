(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const resetButton = document.querySelector('#reboot-dev-reset');
  if (!base || !resetButton) return;

  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm('Reboot Prototypeの世界状態だけを消して、最初からやり直しますか？');
    if (!confirmed) return;

    try {
      window.localStorage.removeItem(base.STORAGE_KEY);
      window.location.reload();
    } catch (_error) {
      const status = document.querySelector('#location-status');
      status.textContent = '保存領域を利用できないため、初期化できなかった。このタブでは続けて遊べる。';
      status.dataset.tone = 'warning';
    }
  });
})();
