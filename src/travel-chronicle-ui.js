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
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const footprintKey = mode => `crownless-travel-footprints-v1-${mode === 'demo' ? 'demo' : 'walk'}`;
  const footprintMode = () => {
    try { return localStorage.getItem('crownless-expedition-mode') === 'demo' ? 'demo' : 'walk'; }
    catch { return 'walk'; }
  };
  function getFootprints(mode = footprintMode()) {
    const F = window.CrownlessTravelFootprints;
    if (!F) return {version:3,places:[]};
    try { return F.parse(localStorage.getItem(footprintKey(mode))); }
    catch { return F.initial(); }
  }
  function modifyFootprints(mode, change) {
    const F=window.CrownlessTravelFootprints;
    if (!F) return {status:'unavailable'};
    const key=footprintKey(mode);
    try {
      const raw=localStorage.getItem(key), current=F.parse(raw);
      const next=change(current);
      if (next.journal === current) return next;
      if (localStorage.getItem(key)!==raw) return {status:'conflict'};
      localStorage.setItem(key,JSON.stringify(next.journal));
      return next;
    } catch { return {status:'save-failed'}; }
  }
  function recordFootprint(coords,mode = footprintMode(),day) {
    return modifyFootprints(mode,journal=>window.CrownlessTravelFootprints.record(journal,coords,day));
  }
  let lastDiscovery = '';
  function showFootprints(message = '') { currentSubtab='footprints'; lastDiscovery=String(message); }
  // Do not hide a failed/absent game save behind an apparently valid "unclaimed"
  // status. Footprints and conquest are stored separately: a readable footprint
  // never proves the conquest save is readable.
  function landmarkGameState(mode = footprintMode()) {
    try {
      const raw=localStorage.getItem('crownless-expedition-v1-'+mode);
      if (!raw) return {status:'missing',state:null};
      const E=window.CrownlessSlice;
      if (!E?.parse) return {status:'unavailable',state:null};
      const state=E.parse(raw);
      return state ? {status:'ok',state} : {status:'invalid',state:null};
    } catch { return {status:'blocked',state:null}; }
  }
  function controlledLandmarks(mode = footprintMode()) {
    return landmarkGameState(mode).state?.claimedLandmarks || [];
  }
  function landmarkProgress(place,control) {
    if (control.status !== 'ok') {
      const reason=control.status==='missing' ? '対応するゲームセーブがありません'
        : control.status==='invalid' ? 'ゲームセーブを読み取れません'
        : 'ゲームセーブにアクセスできません';
      return {type:'error',message:`⚠ ${reason}。訪問記録は残っていますが、支配状態を判定できません。セーブを削除せず、冒険画面の保存警告を確認してください。`};
    }
    const state=control.state;
    if (state.claimedLandmarks?.includes(place.id)) return {type:'owned',message:'⚑ 支配確定済み'};
    const x=state.expedition;
    if (x?.landmarkId===place.id) {
      return x.stage==='cleared' && x.seals?.includes(x.place)
        ? {type:'pending',message:'⚑ この名所の主を撃破済み。遠征画面の「旗を立てて帰還する」で支配が確定します。'}
        : {type:'pending',message:'⚔ この名所の遠征が進行中。主を倒して、生還すると旗が立ちます。'};
    }
    const report=state.report;
    if (report?.landmarkId===place.id && !report.died && report.cleared?.includes(report.place)) {
      return {type:'error',message:'⚠ この名所の主を倒して生還した記録がありますが、支配旗が保存されていません。セーブを維持して確認してください。'};
    }
    if (report?.landmarkId===place.id) {
      return {type:'pending',message:'この名所の直近の遠征は、主撃破・生還が完了していません。'};
    }
    if (state.cleared?.includes(place.biome)) return {
      type:'generic',
      message:'⚠ この地域種別の主を倒した履歴はありますが、この名所の攻略記録ではありません。「このランドマークを攻略する」から出発してください。'
    };
    return {type:'new',message:'この名所の主を倒して旗を立てて帰還すると支配できます。'};
  }

  let currentSubtab = 'footprints';

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

    // Only visits actually earned by the player should appear as stamps.
    return data;
  }

  function getOutposts() {
    const FO = window.CrownlessFrontierOutpost;
    const initial = FO ? FO.createInitialState() : { version: 1, outposts: {} };
    let data = readJson(STORAGE_KEY_OUTPOSTS, initial);

    // Viewing the travel map must not silently grant ownership or mutate storage.
    // Outposts are earned through explicit gameplay, never by opening this tab.
    return data;
  }

  function getPlayerScrap() {
    const E = window.CrownlessSlice;
    if (!E) return 0;
    try {
      const mode = footprintMode();
      const raw = localStorage.getItem(`crownless-expedition-v1-${mode}`);
      // Reading the travel map must never write the game's save behind the
      // active slice app. Doing so desynchronizes its concurrency guard, which
      // then blocks the siege result from being saved.
      const state = E.parse(raw);
      return Number(state?.scrap) || 0;
    } catch (_) {
      return 0;
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
    const footprints = getFootprints();

    const stats = TC ? TC.getChronicleStats(chronicle) : { totalStamps: 0, totalRelics: 0, totalCards: 0 };
    const outpostsList = Object.values(outpostsState.outposts || {});
    const controlled=controlledLandmarks();

    container.innerHTML = `
      <div class="chronicle-container">
        <header class="chronicle-header">
          <p class="chronicle-kicker">TRAVELER'S CHRONICLE & PASSPORT</p>
          <h2 class="chronicle-title">旅の地図 · 発見した世界</h2>
          <p class="chronicle-subtitle">現実のランドマークは、こちらの世界にも姿を現す。</p>
          <div class="chronicle-stats-ribbon">
            <div class="stat-item">
              <span class="stat-num">${currentSubtab === 'footprints' ? footprints.places.length : stats.totalStamps}</span>
              <span class="stat-label">${currentSubtab === 'footprints' ? '👣 旅の足跡' : '⛩️ 踏破消印'}</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${stats.totalRelics}</span>
              <span class="stat-label">⚔️ ご当地遺物</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${outpostsList.length + controlled.length}</span>
              <span class="stat-label">🚩 開拓拠点</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${playerScrap}</span>
              <span class="stat-label">⚙️ 所持鉄片</span>
            </div>
          </div>
        </header>

        <nav class="chronicle-subtabs" aria-label="冒険録の項目">
          <button class="subtab-btn ${currentSubtab === 'footprints' ? 'active' : ''}" data-subtab="footprints">旅の地図</button>
          <button class="subtab-btn ${currentSubtab === 'stamps' ? 'active' : ''}" data-subtab="stamps">旅の印章</button>
          <button class="subtab-btn ${currentSubtab === 'relics' ? 'active' : ''}" data-subtab="relics">ご当地武具</button>
          <button class="subtab-btn ${currentSubtab === 'outposts' ? 'active' : ''}" data-subtab="outposts">開拓拠点</button>
          <button class="subtab-btn ${currentSubtab === 'travelog' ? 'active' : ''}" data-subtab="travelog">冒険譚</button>
        </nav>

        <div class="chronicle-body">
          ${currentSubtab === 'footprints' && lastDiscovery ? `<p class="landmark-discovery-banner" role="status">${esc(lastDiscovery)}</p>` : ''}
          ${renderSubtabContent(currentSubtab, chronicle, outpostsState, playerScrap)}
        </div>
      </div>
    `;

    lastDiscovery='';

    // Bind subtab buttons
    container.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentSubtab = e.currentTarget.dataset.subtab;
        renderChronicle(container);
      });
    });

    /* Place discoveries require no text editing or secondary save action. */
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
    if (subtab === 'footprints') {
      const F=window.CrownlessTravelFootprints;
      const found=F ? F.discovered(getFootprints()) : [];
      const control=landmarkGameState();
      const owned=new Set(control.state?.claimedLandmarks || []);
      if (!found.length) return '<div class="empty-state">まだ幻想の名所は見つかっていない。<p>現実のランドマークの近くで、安全に立ち止まって現在地を確認しよう。訪問すると地図に発見の印が付く。文字入力はいらない。</p></div>';
      // Illustration only: coordinates below are fantasy-map placements and are
      // intentionally NOT a precise representation of real-world locations.
      const pins=found.map((p,i)=>`<div class="fantasy-landmark-pin" style="left:${14+(i%3)*36}%;top:${24+(Math.floor(i/3)%2)*44}%;" aria-label="${esc(p.name)}、${control.status!=='ok'?'支配状態不明':owned.has(p.id)?'支配済み':'発見済み'}">
          <span class="fantasy-landmark-icon" aria-hidden="true">${esc(p.icon)}</span><span class="fantasy-landmark-footstep" aria-hidden="true">${control.status!=='ok'?'?':owned.has(p.id)?'⚑':'👣'}</span>
          <span class="fantasy-landmark-pin-title">${esc(p.name)}</span></div>`).join('');
      return `<section class="fantasy-landmark-map" aria-label="発見した幻想の名所を表示した旅の地図">
        <div class="fantasy-landmark-map-title">発見した土地 · ${found.length}か所</div>
        <div class="fantasy-landmark-map-field">${pins}</div>
        <p class="small">旅の絵地図。現実の位置や経路を示すものではない。</p>
      </section>
      <div class="footprints-list">${found.map(p=>`<article class="footprint-card">
        <div class="footprint-heading"><span class="footprint-seal" aria-hidden="true">${esc(p.icon)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.realName)} 付近で発見</small></div></div>
        <p class="small">${esc(p.description)}</p>
        <p class="footprint-acquired">${control.status!=='ok'?'👣 発見済み · ⚠ 支配情報を確認できません':owned.has(p.id)?'⚑ あなたの支配拠点':'👣 発見済み・未支配'} · ${esc(p.seal)}</p>
        <p class="small">初発見 ${esc(p.firstDate)} · 訪問 ${p.visits.length}日${p.visits.length>1?' · 再訪済み':''}</p>
        <p class="small">${owned.has(p.id)?'支配の効果：この名所からの遠征に薬草 +1（最大3個）':'攻略条件：この名所の主を倒し、旗を立てて帰還する'}</p>
        ${!owned.has(p.id) ? (()=>{const progress=landmarkProgress(p,control);return `<p class="landmark-control-status landmark-control-status--${progress.type}" role="status">${esc(progress.message)}</p>`;})() : ''}
        <button class="landmark-siege-btn" type="button" data-action="landmark-siege" data-value="${esc(p.id)}" ${control.status!=='ok'?'disabled title="ゲームセーブの読み取り状態を確認してください"':''}>${owned.has(p.id)?'この支配拠点から再遠征':'このランドマークを攻略する'}</button>
      </article>`).join('')}</div>`;
    }
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

  // Menu entries are generated by the core renderer, not by a MutationObserver.
  function installChronicleTab() { return false; }

  return {
    getChronicle,
    getOutposts,
    getFootprints,
    controlledLandmarks,
    landmarkGameState,
    landmarkProgress,
    recordFootprint,
    showFootprints,
    renderChronicle,
    installChronicleTab,
  };
});
