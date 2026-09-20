(function (root, factory) {
  const api = factory(root.CrownlessExpeditionPostcard);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessReturnPostcard = api;
    const game = document.querySelector('#game');
    if (!game || typeof MutationObserver !== 'function') return;
    const apply = () => {
      const panel = game.querySelector('.panel');
      if (!panel || panel.querySelector('[data-expedition-postcard]')) return;
      const card = api.fromReportPanel(panel.textContent || '');
      if (!card) return;
      const result = panel.querySelector('.result-number');
      if (!result) return;
      const note = document.createElement('div');
      note.className = 'reward';
      note.dataset.expeditionPostcard = 'true';
      note.innerHTML = `<span class="reward-icon">✦</span><div><strong>${api.escape(card.title)} · ${api.escape(card.region)}</strong><small>${api.escape(card.memory)}</small></div>`;
      result.insertAdjacentElement('afterend', note);
    };
    new MutationObserver(apply).observe(game, { childList: true, subtree: true });
    apply();
  }
})(typeof globalThis === 'object' ? globalThis : this, function (postcardApi) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function fromReportPanel(text) {
    const value = String(text || '');
    if (!value.includes('SAFE RETURN') || value.includes('EXPEDITION LOST')) return null;
    const kicker = value.match(/SAFE RETURN\s*\/\s*([^\n\r<]+)/)?.[1] || '';
    const place = kicker.split(/\s{2,}|\r?\n|欲張らずに|命だけを|新しい一本/)[0].trim() || '名もなき土地';
    const gear = value.match(/新しい一本を、火へ。/) ? '新しい武具を火へ持ち帰った' : '戦利品を火へ持ち帰った';
    const create = postcardApi && postcardApi.createExpeditionPostcard;
    return create ? create({ location: { label: place }, event: gear }) : { title: '遠征の記録', region: place, memory: gear };
  }
  return { fromReportPanel, escape };
});
