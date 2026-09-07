(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const resetButton = document.querySelector('#reboot-dev-reset');
  if (!base || !resetButton) return;

  loadPhase9();

  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm('Reboot Prototypeの世界状態だけを消して、最初からやり直しますか？');
    if (!confirmed) return;

    try {
      window.localStorage.removeItem(base.STORAGE_KEY);
      window.localStorage.removeItem('crownless_reboot_phase9_world_v1');
    } finally {
      window.location.reload();
    }
  });

  function loadPhase9() {
    if (!document.querySelector('link[data-reboot-phase9]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'reboot-phase9.css';
      link.dataset.rebootPhase9 = 'true';
      document.head.appendChild(link);
    }
    if (window.CrownlessRebootPhase9Combat || document.querySelector('script[data-reboot-phase9]')) return;
    const script = document.createElement('script');
    script.src = 'src/reboot-phase9-combat.js';
    script.async = false;
    script.dataset.rebootPhase9 = 'true';
    document.body.appendChild(script);
  }
})();
