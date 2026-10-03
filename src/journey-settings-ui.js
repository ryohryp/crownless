/* Reach the existing preferences and backup controls from the phone camp. */
(() => {
  'use strict';
  const help = document.querySelector('#help');
  const toggle = document.querySelector('#help-toggle');
  if (!help || !toggle) return;

  help.setAttribute('role','dialog');
  help.setAttribute('aria-modal','true');
  help.setAttribute('aria-label','旅の設定と遊び方');
  const controls = document.createElement('div');
  controls.className = 'journey-settings-controls';
  controls.innerHTML = '<button class="secondary" data-settings-close>旅へ戻る</button><h2>旅の設定</h2><div class="choice-grid"><button class="choice" data-preference="audio" aria-pressed="false">効果音 OFF</button><button class="choice" data-preference="sunlight" aria-pressed="false">日光モード OFF</button></div><p class="small">音と画面の明るさは、いつでも切り替えられます。</p><h3>遊び方</h3>';
  help.prepend(controls);
  let opener = null;
  const close = controls.querySelector('[data-settings-close]');
  const originals = {
    audio: document.querySelector('[data-audio-toggle]'),
    sunlight: document.querySelector('#sunlight-toggle')
  };
  function sync() {
    for (const [name, original] of Object.entries(originals)) {
      const button = controls.querySelector(`[data-preference="${name}"]`);
      const enabled = original?.getAttribute('aria-pressed') === 'true';
      button.disabled = !original;
      button.setAttribute('aria-pressed',String(enabled));
      button.textContent = `${name === 'audio' ? '効果音' : '日光モード'} ${enabled ? 'ON' : 'OFF'}`;
    }
  }
  function dismiss() {
    help.hidden = true;
    toggle.setAttribute('aria-expanded','false');
    if (opener?.isConnected) opener.focus({preventScroll:true});
  }
  close.addEventListener('click',dismiss);
  controls.addEventListener('click',event => {
    const name = event.target.closest('[data-preference]')?.dataset.preference;
    if (!name || !originals[name]) return;
    originals[name].click();
    sync();
  });
  document.addEventListener('click',event => {
    const button = event.target.closest('#help-toggle, [data-action="settings"]');
    if (!button || help.hidden) return;
    opener = button;
    sync();
    close.focus({preventScroll:true});
  });
  document.addEventListener('keydown',event => {
    if (help.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
    if (event.key === 'Tab') {
      const focusable = [...help.querySelectorAll('button:not(:disabled), a[href], input, textarea, select')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  sync();
})();
