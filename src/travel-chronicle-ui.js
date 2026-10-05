(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CrownlessTravelChronicleUI = factory();
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY_CHRONICLE = 'crownless-travel-chronicle-v1';
  const STORAGE_KEY_OUTPOSTS = 'crownless-frontier-outposts-v1';

  let currentSubtab = 'stamps';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  function getChronicle() {
    const TC = window.CrownlessTravelChronicle;
    const initial = TC ? TC.createInitialChronicle() : { version: 1, stamps: [], cards: [], collectedRelics: [] };
    let data = readJson(STORAGE_KEY_CHRONICLE, initial);

    // Seed initial demo landmarks if chronicle is empty so the player immediately enjoys the experience
    if (data.stamps.length === 0 && TC) {
      data = TC.recordVisitAndStamp(data, '囁きの森・大樹の祠', 'sacred');
      data = TC.recordVisitAndStamp(data, '鐘なき塔・見張り台', 'height');
      data = TC.recordVisitAndStamp(data, '星沈みの湿原・渡し場', 'water');

      const RR = window.CrownlessRegionalRelics;
      if (RR) {
        const relic1 = RR.createRegionalRelicInstance('relic_sacred_exorcist_dagger', '囁きの森・大樹の祠');
        data = TC.recordCollectedRelic(data, relic1);
      }

      data = TC.recordExpeditionCard(data, {
        landmarkName: '囁きの森・大樹の祠',
        signal: 'sacred',
        summary: '古木の根元で魔物を払い、最初の開拓旗を立てた。',
        relicName: '破魔の短剣',
        facilityBuilt: '見張り塔 Lv1',
      });
      writeJson(STORAGE_KEY_CHRONICLE, data);
    }

    return data;
  }

  function getOutposts() {
    const FO = window.CrownlessFrontierOutpost;
    const initial = FO ? FO.createInitialState() : { version: 1, outposts: {} };
    let data = readJson(STORAGE_KEY_OUTPOSTS, initial);

    // Seed initial demo outpost if empty
    if (Object.keys(data.outposts).length === 0 && FO) {
      data = FO.claimOutpost(data, 'wood_outpost', '囁きの森・前哨拠点', 'woods');
      writeJson(STORAGE_KEY_OUTPOSTS, data);
    }

    return data;
  }

  function getPlayerScrap() {
    const E = window.CrownlessSlice;
    if (!E) return 12;
    try {
      const mode = localStorage.getItem('crownless-expedition-mode') || 'demo';
      const key = `crownless-expedition-v1-${mode}`;
      const raw = localStorage.getItem(key);
      const state = E.parse(raw);
      if (!state) return 12;
      // In demo mode for first time play, grant starter pioneer grant (12 iron scraps)
      if (mode === 'demo' && Number(state.scrap) === 0 && Number(state.runs) === 0 && !localStorage.getItem('crownless-pioneer-grant-v1')) {
        state.scrap = 12;
        localStorage.setItem(key, JSON.stringify(state));
        localStorage.setItem('crownless-pioneer-grant-v1', 'true');
      }
      return Number(state.scrap) || 0;
    } catch (_) {
      return 12;
    }
  }

  function deductPlayerScrap(amount) {
    const E = window.CrownlessSlice;
    if (!E || amount <= 0) return;
    try {
      const mode = localStorage.getItem('crownless-expedition-mode') || 'demo';
      const key = `crownless-expedition-v1-${mode}`;
      const state = E.parse(localStorage.getItem(key));
      if (state) {
        state.scrap = Math.max(0, state.scrap - amount);
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (_) {}
  }

  function renderChronicle(container) {
    const TC = window.CrownlessTravelChronicle;
    const FO = window.CrownlessFrontierOutpost;
    const chronicle = getChronicle();
    const outpostsState = getOutposts();
    const playerScrap = getPlayerScrap();

    const stats = TC ? TC.getChronicleStats(chronicle) : { totalStamps: 0, totalRelics: 0, totalCards: 0 };
    const outpostsList = Object.values(outpostsState.outposts || {});

    container.innerHTML = `
      <div class="chronicle-container">
        <header class="chronicle-header">
          <p class="chronicle-kicker">TRAVELER'S CHRONICLE & PASSPORT</p>
          <h2 class="chronicle-title">旅人の冒険録 · 旅と開拓</h2>
          <p class="chronicle-subtitle">訪れた土地の霧を払い、旗を立て、刻まれた旅の足跡。</p>
          <div class="chronicle-stats-ribbon">
            <div class="stat-item">
              <span class="stat-num">${stats.totalStamps}</span>
              <span class="stat-label">⛩️ 踏破消印</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${stats.totalRelics}</span>
              <span class="stat-label">⚔️ ご当地遺物</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${outpostsList.length}</span>
              <span class="stat-label">🚩 開拓拠点</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${playerScrap}</span>
              <span class="stat-label">⚙️ 所持鉄片</span>
            </div>
          </div>
        </header>

        <nav class="chronicle-subtabs" aria-label="冒険録の項目">
          <button class="subtab-btn ${currentSubtab === 'stamps' ? 'active' : ''}" data-subtab="stamps">旅の印章</button>
          <button class="subtab-btn ${currentSubtab === 'relics' ? 'active' : ''}" data-subtab="relics">ご当地武具</button>
          <button class="subtab-btn ${currentSubtab === 'outposts' ? 'active' : ''}" data-subtab="outposts">開拓拠点</button>
          <button class="subtab-btn ${currentSubtab === 'travelog' ? 'active' : ''}" data-subtab="travelog">冒険譚</button>
        </nav>

        <div class="chronicle-body">
          ${renderSubtabContent(currentSubtab, chronicle, outpostsState, playerScrap)}
        </div>
      </div>
    `;

    // Bind subtab buttons
    container.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentSubtab = e.currentTarget.dataset.subtab;
        renderChronicle(container);
      });
    });

    // Bind upgrade buttons
    container.querySelectorAll('.facility-upgrade-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const outpostId = e.currentTarget.dataset.outpostId;
        const facility = e.currentTarget.dataset.facility;
        if (!FO) return;

        const currentOutposts = getOutposts();
        const scrap = getPlayerScrap();
        const result = FO.buildFacility(currentOutposts, outpostId, facility, scrap);

        if (result.success) {
          writeJson(STORAGE_KEY_OUTPOSTS, result.state);
          deductPlayerScrap(result.scrapSpent);

          // Record in travel chronicle
          if (TC) {
            const chron = getChronicle();
            TC.recordExpeditionCard(chron, {
              landmarkName: result.outpost.title,
              signal: result.outpost.signal,
              summary: `${FO.FACILITY_NAMES[facility]} を増築し、防衛度を ${result.outpost.defenseRating} に引き上げた。`,
              facilityBuilt: `${FO.FACILITY_NAMES[facility]} Lv${result.outpost.facilities[facility]}`,
            });
            writeJson(STORAGE_KEY_CHRONICLE, chron);
          }

          renderChronicle(container);
        } else {
          alert(result.reason);
        }
      });
    });
  }

  function renderSubtabContent(subtab, chronicle, outpostsState, playerScrap) {
    if (subtab === 'stamps') {
      const stamps = chronicle.stamps || [];
      if (stamps.length === 0) {
        return `<div class="empty-state">まだ旅の消印がありません。<br>散策に出かけて実在の地物や名所を発見しましょう！</div>`;
      }
      return `
        <div class="stamps-grid">
          ${stamps.map(s => `
            <div class="stamp-card">
              <div class="stamp-icon-row">
                <span class="stamp-icon">${s.icon}</span>
                <span class="stamp-badge">${s.badge || '踏破'}</span>
              </div>
              <span class="stamp-name">${s.landmarkName}</span>
              <span class="stamp-seal">${s.sealName}</span>
              <span class="stamp-date">${s.date} 刻印 · 来訪 ${s.visitCount || 1}回</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (subtab === 'relics') {
      const relics = chronicle.collectedRelics || [];
      if (relics.length === 0) {
        return `<div class="empty-state">集めたご当地武具はまだありません。<br>神社の祠や川の古橋などを制圧して発掘しましょう！</div>`;
      }
      return `
        <div class="relics-list">
          ${relics.map(r => `
            <div class="relic-card">
              <div class="relic-head">
                <span class="relic-title">${r.icon || '⚔️'} ${r.name}</span>
                <span class="relic-origin">📍 ${r.originPlace}</span>
              </div>
              <p class="relic-trait">${r.trait}</p>
              <p class="relic-flavor">発見日: ${r.discoveredDate}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (subtab === 'outposts') {
      const FO = window.CrownlessFrontierOutpost;
      const outposts = Object.values(outpostsState.outposts || {});
      if (outposts.length === 0) {
        return `<div class="empty-state">まだ開拓された拠点はありません。<br>探索で砦を制圧すると、ここに開拓基地を設営できます。</div>`;
      }
      return `
        <div class="outposts-list">
          ${outposts.map(op => {
            const isPlayer = op.owner === 'player';
            return `
              <div class="outpost-card">
                <div class="outpost-head">
                  <span class="outpost-title">🚩 ${op.title}</span>
                  <span class="outpost-owner ${op.owner}">${isPlayer ? 'あなたの開拓地' : '灰鴉の占拠'}</span>
                </div>
                <div class="outpost-stats">
                  <span>開拓ランク: Lv${op.level}</span>
                  <span>防衛度: ${op.defenseRating}</span>
                  <span>設立: ${op.establishedDate}</span>
                </div>
                ${isPlayer ? `
                  <div class="outpost-facilities">
                    ${['watchtower', 'forge', 'hearth'].map(type => {
                      const lvl = op.facilities[type] || 0;
                      const nextLvl = lvl + 1;
                      const cost = (FO && FO.FACILITY_COSTS[type][nextLvl]) || 999;
                      const isMax = lvl >= 3;
                      const canAfford = playerScrap >= cost && !isMax;
                      const name = (FO && FO.FACILITY_NAMES[type]) || type;
                      return `
                        <div class="facility-row">
                          <span class="facility-name">${name} (Lv${lvl}/3)</span>
                          <button class="facility-upgrade-btn"
                            data-outpost-id="${op.id}"
                            data-facility="${type}"
                            ${!canAfford ? 'disabled' : ''}>
                            ${isMax ? '増築完了' : `増築 (鉄片 ${cost})`}
                          </button>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <p class="relic-trait">現在ライバルに占拠されています。遠征して奪還しましょう！</p>
                `}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (subtab === 'travelog') {
      const cards = chronicle.cards || [];
      if (cards.length === 0) {
        return `<div class="empty-state">旅の記憶はまだありません。</div>`;
      }
      return `
        <div class="travelog-list">
          ${cards.map(c => `
            <div class="travelog-card">
              <div class="travelog-meta">
                <span>${c.icon} ${c.landmarkName}</span>
                <span>${c.date}</span>
              </div>
              <p class="travelog-summary">${c.summary}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    return '';
  }

  function installChronicleTab() {
    const root = document.querySelector('#game');
    if (!root) return;

    const enhance = () => {
      const nav = root.querySelector('.camp-tabs');
      const panel = nav?.parentElement;
      if (!nav || !panel || nav.querySelector('[data-chronicle-tab]')) return;

      const button = document.createElement('button');
      button.className = 'choice';
      button.dataset.chronicleTab = 'true';
      button.textContent = '冒険録';
      button.setAttribute('aria-label', '旅の冒険録と開拓手帳');

      button.addEventListener('click', () => {
        nav.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        button.classList.add('active');
        [...panel.children].forEach(x => {
          if (x !== nav && !x.matches('.text-button')) x.remove();
        });

        const body = document.createElement('div');
        body.className = 'chronicle-panel';
        nav.after(body);
        renderChronicle(body);
      });

      // Insert right before settings button
      const settingsBtn = nav.querySelector('[data-action="settings"]');
      if (settingsBtn) {
        nav.insertBefore(button, settingsBtn);
      } else {
        nav.appendChild(button);
      }
    };

    new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
    enhance();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installChronicleTab);
    } else {
      installChronicleTab();
    }
  }

  return {
    getChronicle,
    getOutposts,
    renderChronicle,
    installChronicleTab,
  };
});
