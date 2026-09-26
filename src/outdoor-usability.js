(() => {
  'use strict';
  const storageKey = 'crownless-sunlight-mode';
  const places = [['N','鐘なき塔','北に鐘の気配'],['E','灰青の湿原','東に湿原の青い光'],['SW','灰冠の廟','南西に廟の重い気配'],['W','囁きの森','西に森のざわめき']];
  const stored = () => { try { return localStorage.getItem(storageKey) === '1'; } catch { return false; } };
  function apply(enabled) {
    document.documentElement.classList.toggle('sunlight-mode', enabled);
    const toggle = document.querySelector('#sunlight-toggle');
    if (toggle) { toggle.setAttribute('aria-pressed', String(enabled)); toggle.textContent = enabled ? '☀ 日光モード ON' : '☀ 日光モード'; }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', enabled ? '#f4efe2' : '#13272b');
  }
  function ensureToggle() {
    const masthead = document.querySelector('.masthead');
    if (!masthead || document.querySelector('#sunlight-toggle')) return;
    const button = document.createElement('button');
    button.id = 'sunlight-toggle'; button.className = 'text-button sunlight-toggle'; button.type = 'button';
    button.addEventListener('click', () => {
      const enabled = !document.documentElement.classList.contains('sunlight-mode');
      try { localStorage.setItem(storageKey, enabled ? '1' : '0'); } catch {}
      apply(enabled);
    });
    masthead.insertBefore(button, document.querySelector('#help-toggle'));
    apply(stored());
  }
  function ensureCompass() {
    const field = document.querySelector('.atlas-field');
    if (!field || field.querySelector('.atlas-compass')) return;
    const compass = document.createElement('aside');
    compass.className = 'atlas-compass'; compass.setAttribute('aria-label', '次に歩く方角の手がかり');
    compass.innerHTML = '<strong>方角の導き</strong><small>歩く前に方角を決め、移動中は画面を見ない。</small><div>' + places.map(([bearing,name,hint]) => '<span><b>'+bearing+'</b><i>'+hint+'</i><em>'+name+'</em></span>').join('') + '</div>';
    field.appendChild(compass);
  }
  function refresh() { ensureToggle(); ensureCompass(); }
  new MutationObserver(refresh).observe(document.documentElement, {childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', refresh); refresh();
})();