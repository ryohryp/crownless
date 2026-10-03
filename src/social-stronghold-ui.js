(() => {
  'use strict';

  const T = window.CrownlessStronghold;
  const root = document.querySelector('#game');
  if (!T || !root) return;

  const mode = () => {
    try { return localStorage.getItem('crownless-expedition-mode') || 'demo'; }
    catch { return 'demo'; }
  };
  const key = () => `crownless-territory-v1-${mode()}`;
  const gameKey = () => `crownless-expedition-v1-${mode()}`;

  const load = () => {
    try { return T.parse(localStorage.getItem(key())); }
    catch { return T.fresh(); }
  };
  const save = s => {
    try { localStorage.setItem(key(), JSON.stringify(s)); }
    catch { /* Optional local social fixture must never block play. */ }
  };
  const game = () => {
    try { return JSON.parse(localStorage.getItem(gameKey()) || 'null'); }
    catch { return null; }
  };

  function districtTitle(g, id) {
    const d = g?.neighborhood?.districts?.find(v => v.id === id);
    if (!d) return 'この砦';
    const dir = [
      d.y > 0 ? '北' : d.y < 0 ? '南' : '',
      d.x > 0 ? '東' : d.x < 0 ? '西' : '',
    ].join('');
    const kind = { wood:'木立', tower:'見張り跡', fen:'水辺', crypt:'石塚' }[d.biome] || '砦';
    return `${dir}の${kind}`;
  }

  // Simulated rival acts asynchronously between visits, never during walking.
  let initial = load();
  let initialGame = game();
  if (initial.rivalArmed) {
    initial = T.simulateRival(initial, districtTitle(initialGame, initial.stronghold));
    save(initial);
  }

  function recordClaim(g, s) {
    const result = g?.neighborhood?.result;
    const report = root.querySelector('.report-panel .home-return strong');
    if (!report || !result || result.died || report.dataset.strongholdRecorded) return s;

    const initialClaim = result.claimed && !s.stronghold;
    const retake = s.owner === 'rival' && result.id === s.stronghold;
    if (!initialClaim && !retake) return s;

    report.dataset.strongholdRecorded = 'true';
    const next = T.claim(s, result.id, districtTitle(g, result.id));
    if (next !== s) save(next);
    return next;
  }

  function render() {
    const g = game();
    let s = load();
    s = recordClaim(g, s);

    const detail = root.querySelector('.map-home-detail');
    if (!detail || !s.stronghold || detail.querySelector('.stronghold-status')) return;

    const title = districtTitle(g, s.stronghold);
    const selected = g?.neighborhood?.selected === s.stronghold;
    const card = document.createElement('section');
    card.className = 'stronghold-status rule-line';
    card.dataset.strongholdOwner = s.owner || 'none';

    const stateCopy = s.owner === 'rival'
      ? '奪われた砦へ遠征し、土地の主を越えて生還すれば奪い返せる。'
      : s.rivalArmed
        ? `${T.RIVAL}の偵察痕が残っている。次に戻った時、この砦がどうなっているか分からない。`
        : 'この場所には、あなたの遠征の痕跡が残っている。';

    card.innerHTML = `
      <p class="kicker">STRONGHOLD · ${title}</p>
      <h3>${T.ownerLabel(s)}</h3>
      <p class="small">${stateCopy}</p>
      <details>
        <summary>支配の記録</summary>
        ${s.history.slice().reverse().map(v => `<p class="small">${v.text}</p>`).join('')}
      </details>
      ${s.owner === 'rival' && !selected
        ? '<p class="notice">地図でこの砦を選ぶと、再奪取へ向かえる。</p>'
        : ''}
    `;

    detail.prepend(card);

    const selector = `.district-pin[data-value="${CSS.escape(s.stronghold)}"] small`;
    const pin = root.querySelector(selector);
    if (pin) pin.textContent = s.owner === 'rival'
      ? `${T.RIVAL}が占拠`
      : s.rivalArmed
        ? `${T.RIVAL}の偵察痕`
        : 'あなたの砦';
  }

  new MutationObserver(render).observe(root, { childList:true, subtree:true });
  render();
})();
