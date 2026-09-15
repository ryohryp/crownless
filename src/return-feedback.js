(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CrownlessReturnFeedback = api;
    const game = document.querySelector('#game');
    if (!game || typeof MutationObserver !== 'function') return;
    const apply = () => {
      const panel = game.querySelector('.panel');
      const result = panel?.querySelector('.result-number');
      if (!panel || !result || panel.querySelector('[data-return-feedback]')) return;
      const text = api.fromReportPanel(panel.textContent || '');
      if (!text) return;
      const note = document.createElement('p');
      note.className = 'notice';
      note.dataset.returnFeedback = 'true';
      note.textContent = text;
      result.insertAdjacentElement('afterend', note);
    };
    new MutationObserver(apply).observe(game, { childList: true, subtree: true });
    apply();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function fromReportPanel(text) {
    const value = String(text || '');
    if (!value.includes('SAFE RETURN')) return '';
    const match = value.match(/\+(\d+)\s*鉄片を確保/);
    const scrap = match ? Number(match[1]) : 0;
    if (value.includes('新しい一本を、火へ。')) return '今回の手応え：新しい武具を生還確定した。次は装備を比べて、戦い方の違いを試せる。';
    if (scrap >= 15) return `今回の手応え：鉄片 ${scrap} 個を失わず持ち帰った。深く欲張った分を、帰る判断で確定できた。`;
    return `今回の手応え：鉄片 ${scrap} 個を生還確定した。引き際を選んだことも、この旅の成果。`;
  }
  return { fromReportPanel };
});
