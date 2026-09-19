/**
 * Application UI controller for Crownless Expedition Slice.
 *
 * Manages view rendering, user interactions, local storage persistence,
 * and stationary geolocation observation.
 * Deliberately contains no network client, telemetry, background GPS,
 * or persistent coordinate storage.
 */
(() => {
  'use strict';

  const engine = window.CrownlessSlice;
  const art = window.CrownlessArt;
  const rootElement = document.querySelector('#game');

  // ==========================================================================
  // 1. Application State & Storage Keys
  // ==========================================================================

  let state = engine.initial();
  let selectedPlaceId = 'wood';
  let activeTab = 'explore';
  let statusNotice = '';
  let isGpsBusy = false;

  let geoSession = engine.locationSession();
  let currentStorageKey = null;
  let lastSavedRawJson = null;
  let isSaveBlocked = false;
  let isTabConflict = false;
  let locationRequestId = 0;

  const storageKeyForMode = (mode) => `crownless-expedition-v1-${mode}`;

  /**
   * Escapes HTML characters for safe template interpolation.
   */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  /**
   * Updates the banner warning and footer label for save state status.
   */
  function updateSaveWarning(message) {
    const warningEl = document.querySelector('#save-status');
    const labelEl = document.querySelector('#save-label');
    if (warningEl) {
      warningEl.hidden = !message;
      warningEl.textContent = message;
    }
    if (labelEl) {
      labelEl.textContent = message ? '保存停止中・この画面でのみ進行' : '端末に自動保存';
    }
  }

  // ==========================================================================
  // 2. Storage & Mode Lifecycle
  // ==========================================================================

  /**
   * Loads saved data for the selected play mode ('demo' or 'walk').
   */
  function loadMode(mode) {
    state = engine.initial();
    state.mode = mode;
    currentStorageKey = storageKeyForMode(mode);
    lastSavedRawJson = null;
    isSaveBlocked = false;
    isTabConflict = false;
    updateSaveWarning('');

    try {
      lastSavedRawJson = localStorage.getItem(currentStorageKey);
      const parsedState = engine.parse(lastSavedRawJson);

      if (parsedState && (!parsedState.mode || parsedState.mode === mode)) {
        state = parsedState;
        state.mode = mode;
      } else {
        isSaveBlocked = true;
        updateSaveWarning('セーブを読み込めませんでした。元データを保持し、この回は保存せずに遊べます。');
      }
      localStorage.setItem('crownless-expedition-mode', mode);
    } catch {
      isSaveBlocked = true;
      updateSaveWarning('このブラウザでは保存できません。ページを閉じると今回の進行は失われます。');
    }

    locationRequestId++;
    isGpsBusy = false;
    geoSession = engine.locationSession();
    selectedPlaceId = state.expedition?.place || 'wood';
    activeTab = 'explore';
    statusNotice = '';
    render();
  }

  /**
   * Persists current state to localStorage, detecting cross-tab concurrency conflicts.
   */
  function persistState() {
    if (!currentStorageKey || isSaveBlocked) return;

    try {
      const liveStoredRaw = localStorage.getItem(currentStorageKey);
      if (liveStoredRaw !== lastSavedRawJson) {
        isTabConflict = true;
        updateSaveWarning('別のタブで進行が変わりました。上書きを防ぐため停止しました。再読み込みしてください。');
        return;
      }
      lastSavedRawJson = engine.serialize(state);
      localStorage.setItem(currentStorageKey, lastSavedRawJson);
    } catch {
      isSaveBlocked = true;
      updateSaveWarning('保存に失敗しました。この画面では続けられますが、再読み込みで進行が戻る場合があります。');
    }
  }

  // ==========================================================================
  // 3. UI Component Helpers
  // ==========================================================================

  /**
   * Renders an interactive button with standardized markup.
   */
  function renderButton(action, title, body = '', options = {}) {
    const className = options.class || 'choice';
    const valueAttr = options.value ? `data-value="${escapeHtml(options.value)}"` : '';
    const disabledAttr = options.disabled ? 'disabled' : '';

    const labelContent = body
      ? `<strong>${title}</strong><small>${body}</small>`
      : title;

    return `<button class="${className}" data-action="${action}" ${valueAttr} ${disabledAttr}>${labelContent}</button>`;
  }

  /**
   * Renders the visual vector scenery card.
   */
  function renderScene(placeId, title, subtitle, enemy = null, tag = '') {
    const vectorSvg = art.scene(placeId, enemy, state.equipped);
    const topBadge = enemy ? 'HOLD YOUR GROUND' : 'BEYOND THE MIST';
    const tagHtml = tag ? `<span class="scene-tag">${tag}</span>` : '';

    return `
      <div class="scene">
        ${vectorSvg}
        <span class="scene-top">${topBadge}</span>
        ${tagHtml}
        <div class="scene-caption">
          <p class="kicker">${subtitle}</p>
          <h2>${title}</h2>
        </div>
      </div>
    `;
  }

  /**
   * Renders recent combat/expedition log entries.
   */
  function renderLogs(expedition) {
    const messages = expedition.log.map((msg) => `<p>${escapeHtml(msg)}</p>`).join('');
    return `<div class="combat-log" role="status" aria-live="polite">${messages}</div>`;
  }

  /**
   * Renders the loot ledger currently at risk during the run.
   */
  function renderLootLedger(expedition) {
    const gearList = expedition.gear
      .map((gearKey) => `<p>＋ ${engine.GEAR[gearKey].name}</p>`)
      .join('');

    return `
      <div class="loot-ledger">
        <p class="kicker">AT RISK · 生還で確定</p>
        <strong>${expedition.scrap}</strong> <small>鉄片 / 背嚢の中</small>
        ${gearList}
      </div>
    `;
  }

  /**
   * Renders player vitals (HP bar and stamina pips).
   */
  function renderVitals(expedition) {
    const maxHealth = engine.maxHp(state);
    const hpPercent = (100 * expedition.hp) / maxHealth;
    const isDanger = expedition.hp < 10 ? 'danger' : '';
    const activeStaminaPips = '◆'.repeat(expedition.stamina);
    const emptyStaminaPips = '◇'.repeat(3 - expedition.stamina);

    return `
      <div class="vitals">
        <div>
          <div class="hp-row">
            <span>あなたの体力</span>
            <strong class="${isDanger}">${expedition.hp} <small class="small">/ ${maxHealth}</small></strong>
          </div>
          <div class="bar" role="meter" aria-label="あなたの体力" aria-valuenow="${expedition.hp}" aria-valuemin="0" aria-valuemax="${maxHealth}">
            <span style="width:${hpPercent}%"></span>
          </div>
        </div>
        <div>
          <span class="small">気力 · ${expedition.stamina} / 3</span>
          <div class="stamina" aria-hidden="true">${activeStaminaPips}<span class="empty">${emptyStaminaPips}</span></div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the 5-room route progression indicator.
   */
  function renderRoute(expedition) {
    const roomLabels = ['足跡', '灯り', '狩場', '遺品', '土地の主'];
    const stepsHtml = roomLabels
      .map((label, idx) => {
        const isCurrent = idx === expedition.room;
        const isDone = idx < expedition.room;
        const classNames = `route-step ${isCurrent ? 'current' : isDone ? 'done' : ''}`;
        const markerContent = isDone ? '✓' : idx + 1;
        return `<span class="${classNames}"><i>${markerContent}</i>${label}</span>`;
      })
      .join('');

    return `<div class="route" aria-label="遠征の進み具合">${stepsHtml}</div>`;
  }

  /**
   * Renders the destination selector pins.
   */
  function renderMapPins() {
    const pinsHtml = engine.PLACES.map((p) => {
      const isSelected = selectedPlaceId === p.id;
      const isUnlocked = state.unlocked.includes(p.id);
      const classNames = `place-pin ${isSelected ? 'selected' : ''} ${isUnlocked ? '' : 'locked'}`;
      const placeName = isUnlocked ? p.name : '霧の向こう';

      return `
        <button class="${classNames}" data-action="select" data-value="${p.id}" aria-pressed="${isSelected}">
          ${art.icon(p.id)}
          <span>${placeName}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="places" aria-label="発見した土地の模式図">
        ${pinsHtml}
      </div>
      <p class="atlas-note">${state.unlocked.length} / 4 の土地を発見 · 架空の模式図。現実の目的地案内ではありません。</p>
    `;
  }

  /**
   * Renders the scouting / discovery panel (simulated or stationary GPS).
   */
  function renderScoutingSection() {
    const isDemoMode = state.mode === 'demo';
    const instructions = isDemoMode
      ? '散策を体験する — 歩く道で出会う土地が変わる。'
      : '画面を閉じて散策し、安全に止まれる場所で発見する。';

    let controlsHtml = '';
    if (isDemoMode) {
      controlsHtml = `
        <div class="choice-grid">
          ${renderButton('scout', '丘の道を歩いた', '', { value: 'tower' })}
          ${renderButton('scout', '水辺の道を歩いた', '', { value: 'fen' })}
          ${renderButton('scout', '南の小道を歩いた', '', { value: 'crypt' })}
          ${renderButton('scout', '森の道を歩いた', '', { value: 'wood' })}
        </div>
      `;
    } else {
      const gpsButtonLabel = isGpsBusy
        ? '現在地を確認中…'
        : geoSession.anchor
          ? '立ち止まった場所で発見する'
          : 'ここを散策の起点にする';

      controlsHtml = `
        ${renderButton('gps', gpsButtonLabel, '', { class: 'secondary', disabled: isGpsBusy })}
        <p class="small" style="margin-top:10px">
          最初の観測点からおよそ 150〜270 m 離れた広い領域で土地を発見。距離の累積報酬はありません。無理に移動せず、後日でも続けられます。
        </p>
      `;
    }

    const noticeHtml = statusNotice
      ? `<p class="notice" role="status">${escapeHtml(statusNotice)}</p>`
      : '';

    return `
      <div class="discovery">
        <p>${instructions}</p>
        ${controlsHtml}
        ${noticeHtml}
      </div>
    `;
  }

  // ==========================================================================
  // 4. Primary View Renderers
  // ==========================================================================

  /**
   * Onboarding view: mode selection (Demo vs Walk).
   */
  function renderOnboardView() {
    return `
      <div class="game-layout onboard">
        <section class="visual-column">
          ${renderScene('camp', 'まだ、名もなき旅人。', 'A FIRE WORTH RETURNING TO')}
          <div class="journey-note">
            <b>01</b>
            <span>霧の先には、まだ知らない場所。<br>その手の戦利品を、この火まで持ち帰ろう。</span>
          </div>
        </section>
        <section class="panel">
          <p class="kicker">A SMALL JOURNEY. SOMETHING TO LOSE.</p>
          <h1>霧の向こうへ。<br>生きて、帰ろう。</h1>
          <p class="intro">
            欠けた剣と、ふた束の薬草。<br>
            あなたの旅は、それだけで始まる。<br>
            踏み込むか、引き返すか。<br>
            持ち帰った一本の剣が、次の旅を変える。
          </p>
          <div class="button-stack">
            ${renderButton('mode', 'まずは体験する <span>約 15 分</span>', '', { class: 'primary', value: 'demo' })}
            ${renderButton('mode', '現実の散策で発見する', '', { class: 'secondary', value: 'walk' })}
          </div>
          <p class="small rule-line">
            体験モードは、室内で移動を再現します。<br>
            散策モードは、安全に立ち止まって現在地を確認。<br>
            位置情報を送信せず、移動履歴も残しません。
          </p>
        </section>
      </div>
    `;
  }

  /**
   * Destination detail panel inside the Camp view.
   */
  function renderExplorePanel() {
    const placeInfo = engine.place(selectedPlaceId);
    const isUnlocked = state.unlocked.includes(placeInfo.id);
    const isCryptLocked = placeInfo.id === 'crypt' && state.cleared.length < 2;

    let destinationDetailHtml = '';
    if (isUnlocked) {
      const isCleared = state.cleared.includes(placeInfo.id);
      const clearBadgeHtml = isCleared
        ? '<span class="badge">踏破済み · 深層でさらに鉄片を集められる</span>'
        : '';

      const departButtonTitle = isCryptLocked
        ? `他の土地をあと ${2 - state.cleared.length} か所踏破する`
        : 'この土地へ遠征する';

      destinationDetailHtml = `
        <div class="reward">
          <span class="reward-icon">♢</span>
          <div>
            <strong>${placeInfo.reward}</strong>
            <small>${placeInfo.hint}</small>
          </div>
        </div>
        <p class="small">
          5 つの場面 / 戦闘 3 回 / 休息 2 回<br>
          ${placeInfo.id === 'crypt' ? '危険度：高い。装備と体力を整えてから。' : '初回は 3〜5 分。戦闘の合間はいつでも帰還。'}
        </p>
        ${clearBadgeHtml}
        <div class="button-stack">
          ${renderButton('depart', departButtonTitle, '', { class: 'primary', value: placeInfo.id, disabled: isCryptLocked })}
        </div>
      `;
    }

    return `
      <p class="kicker">${isUnlocked ? placeInfo.terrain : 'UNDISCOVERED'}</p>
      <h2>${isUnlocked ? placeInfo.name : 'まだ、霧の向こう。'}</h2>
      <p class="intro">
        ${isUnlocked ? placeInfo.subtitle : 'いつもと違う道を歩くと、別の土地に出会えるかもしれない。発見した場所には、あとから何度でも遠征できる。'}
      </p>
      ${destinationDetailHtml}
      ${renderScoutingSection()}
    `;
  }

  /**
   * Gear and upgrade panel inside the Camp view.
   */
  function renderGearPanel() {
    const weaponsHtml = state.owned
      .filter((gearId) => gearId !== 'crown')
      .map((gearId) => {
        const isEquipped = state.equipped === gearId;
        const gearInfo = engine.GEAR[gearId];
        const title = `${gearInfo.name}${isEquipped ? ' · 装備中' : ''}`;
        const cssClass = `choice ${isEquipped ? 'selected' : ''}`;
        return renderButton('equip', title, gearInfo.text, { value: gearId, class: cssClass });
      })
      .join('');

    const crownBadgeHtml = state.owned.includes('crown')
      ? '<p class="badge">灰の王冠 · 永続で最大体力 +6</p>'
      : '';

    const isMaxLevel = state.level >= 4;
    const upgradeCost = engine.upgradeCost(state);
    const cannotAffordUpgrade = state.scrap < upgradeCost;
    const upgradeButtonLabel = isMaxLevel
      ? '補強を終えた'
      : `鉄片 ${upgradeCost} で補強する`;

    const noticeHtml = statusNotice
      ? `<p class="notice" role="status">${escapeHtml(statusNotice)}</p>`
      : '';

    return `
      <p class="kicker">MAKE IT HOME. MAKE IT YOURS.</p>
      <h2>次の旅の、戦い方。</h2>
      <p class="small">装備は生還して初めて手に入る。失敗しても、持っていた装備は失わない。</p>
      <div class="gear-list">${weaponsHtml}</div>
      ${crownBadgeHtml}
      <div class="rule-line">
        <div class="section-heading">
          <h3 style="margin:0">旅装を補強する</h3>
          <span class="small">${state.level} / 4</span>
        </div>
        <p class="small">最大体力 +5。毎回の遠征で効果が続く。</p>
        ${renderButton('upgrade', upgradeButtonLabel, '', {
          class: 'secondary',
          disabled: isMaxLevel || cannotAffordUpgrade
        })}
        ${noticeHtml}
      </div>
    `;
  }

  /**
   * Safe Camp view: preparation, destination selection, and gear management.
   */
  function renderCampView() {
    const isDemo = state.mode === 'demo';
    const modePillText = isDemo ? '散策体験モード' : '現実の散策モード';
    const switchButtonText = isDemo ? '現実の散策モードへ' : '散策体験モードへ';

    return `
      <div class="game-layout">
        <section class="visual-column">
          <div class="mode-strip">
            <span class="mode-pill">${modePillText}</span>
            <span>遠征 ${state.runs} 回 · 生還 ${state.victories} 回</span>
          </div>
          ${renderScene('camp', '帰りを待つ火。', 'THE LAST HEARTH', null, '安全な拠点')}
          ${renderMapPins()}
          <div class="stat-strip">
            <div class="stat">最大体力<b>${engine.maxHp(state)}</b></div>
            <div class="stat">手元の鉄片<b>${state.scrap}</b></div>
            <div class="stat">装備<b><em>${engine.GEAR[state.equipped].name}</em></b></div>
          </div>
        </section>
        <section class="panel">
          <nav class="camp-tabs" aria-label="拠点">
            ${renderButton('tab', '遠征先', '', { class: activeTab === 'explore' ? 'active' : '', value: 'explore' })}
            ${renderButton('tab', '装備と補強', '', { class: activeTab === 'gear' ? 'active' : '', value: 'gear' })}
          </nav>
          ${activeTab === 'gear' ? renderGearPanel() : renderExplorePanel()}
          <button class="text-button" data-action="switch-mode">
            ${switchButtonText} <span aria-hidden="true">↗</span>
          </button>
        </section>
      </div>
    `;
  }

  /**
   * Combat encounter view.
   */
  function renderFightPanel(expedition) {
    const enemy = expedition.enemy;
    const nextIntent = engine.intent(enemy);
    const weapon = engine.GEAR[state.equipped];
    const totalAttack = weapon.attack + expedition.focus;

    // Damage calculations for button previews
    const hitDamage = (amount) => Math.max(0, amount - (nextIntent.id === 'guard' ? 5 : 0));
    const strongDamage = state.equipped === 'bow' ? totalAttack + 4 : hitDamage(totalAttack + 4);

    const strikeActionName = state.equipped === 'bow' ? '射る' : '斬る';
    const guardSubtext = state.equipped === 'shield' ? '12 軽減・3 反撃' : '9 ダメージ軽減';
    const dodgeBonus = state.equipped === 'fang' ? 5 : 3;

    const escapeCost = Math.max(2, nextIntent.damage);
    const cannotEscape = expedition.hp <= escapeCost;
    const canHeal = expedition.potions > 0 && expedition.hp < engine.maxHp(state);

    const enemyHpPercent = (enemy.hp / enemy.maxHp) * 100;
    const gearSummary = expedition.gear.length ? ` / 装備 ${expedition.gear.length} 個` : '';
    const focusSummary = expedition.focus ? ` / 追撃 +${expedition.focus}` : '';

    return `
      <p class="kicker">${enemy.elite ? 'GUARDIAN' : 'ENCOUNTER'} / ${weapon.name}</p>
      <div class="hp-row">
        <h2 style="margin:0">${enemy.elite ? '主・' : ''}${engine.ENEMIES[enemy.kind].name}</h2>
        <span>${enemy.hp} <small class="small">/ ${enemy.maxHp}</small></span>
      </div>
      <div class="bar enemy-bar" role="meter" aria-label="敵の体力" aria-valuenow="${enemy.hp}" aria-valuemin="0" aria-valuemax="${enemy.maxHp}">
        <span style="width:${enemyHpPercent}%"></span>
      </div>
      <div class="intent">
        <p class="kicker">次の行動 · 行動を選ぶまで時間は進まない</p>
        <span class="damage">${nextIntent.damage ? nextIntent.damage : '—'}</span>
        <strong>${nextIntent.name}</strong>
        <small>${nextIntent.help}</small>
      </div>
      <div class="choice-grid">
        ${renderButton('strike', `${strikeActionName} <span class="cost">${hitDamage(totalAttack)}</span>`, '気力 +1 / 表示は与えるダメージ')}
        ${renderButton('heavy', `強撃 <span class="cost">${strongDamage}</span>`, '気力 −2 / 大きな一撃', { disabled: expedition.stamina < 2 })}
        ${renderButton('guard', '防御', `気力 +1 / ${guardSubtext}`)}
        ${renderButton('dodge', '回避', `気力 −1 / 無傷・次の攻撃 +${dodgeBonus}`, { disabled: expedition.stamina < 1 })}
      </div>
      ${renderLogs(expedition)}
      <div class="combat-foot">
        ${renderButton('heal', `薬草 ${expedition.potions} · 体力 +12`, '敵も行動する', {
          class: 'choice',
          disabled: !canHeal
        })}
        ${renderButton('flee', `撤退 · 体力 −${escapeCost}`, cannotEscape ? '生還できない' : '残れば戦利品を持ち帰れる', {
          class: 'choice',
          disabled: cannotEscape
        })}
      </div>
      <p class="small" style="margin:12px 0 0">
        背嚢：鉄片 ${expedition.scrap}${gearSummary} · 生還で確定${focusSummary}
      </p>
    `;
  }

  /**
   * Exploration path panel (rest choices, approach, or cleared destination choices).
   */
  function renderPathPanel(expedition) {
    const isRestRoom = [1, 3].includes(expedition.room);
    const isCleared = expedition.stage === 'cleared';

    let title = '最初の足跡をたどる。';
    if (isCleared) {
      title = expedition.place === 'crypt' ? '灰の冠は、あなたの手に。' : '土地の主を越えた。';
    } else if (isRestRoom) {
      title = expedition.room === 1 ? '消えかけの灯り。' : '茨の奥に、銀の光。';
    } else if (expedition.room === 4) {
      title = 'この先に、主がいる。';
    } else if (expedition.room > 0) {
      title = '奥から、息づかい。';
    }

    let kicker = 'ONE MORE ROOM?';
    let intro = '静かな道をたどるか、宝の気配を追うか。深く踏み込むほど、背嚢を失うことが怖くなる。';

    if (isCleared) {
      kicker = 'A WAY HOME';
      intro = '手に入れたものを、焚き火へ。まだ余力があるなら、より危険な深層へ進むこともできる。';
    } else if (isRestRoom) {
      intro = '息を整えるか、傷を引き受けて遺品を拾うか。引き返す道も、まだ残っている。';
    } else if (expedition.room === 4) {
      const placeReward = engine.place(expedition.place).reward;
      intro = `この土地の主が「${placeReward}」を守っている。持ち帰れば次の旅が変わる。`;
    }

    let actionButtonsHtml = '';
    if (isCleared) {
      const returnBtn = renderButton('return', '戦利品を持って生還する', '', { class: 'primary' });
      const deeperBtn = expedition.depth < 3
        ? renderButton('deeper', `深層 ${expedition.depth + 1} へ踏み込む`, `回復なし / 敵が強化 / 鉄片の基本報酬 ×${expedition.depth + 1}`)
        : '<p class="small">最深部へ到達した。火のもとへ帰ろう。</p>';
      actionButtonsHtml = `${returnBtn}${deeperBtn}`;
    } else if (isRestRoom) {
      const restBtn = renderButton('rest', '火のそばで休む', '体力 +6 / 遺品は残す');
      const searchBtn = renderButton('search', '茨の遺品を拾う', `体力 −4 / 鉄片 +${5 * expedition.depth}`, {
        disabled: expedition.hp <= 4
      });
      actionButtonsHtml = `${restBtn}${searchBtn}`;
    } else {
      const carefulBtn = renderButton('careful', expedition.room === 4 ? '主に挑む' : '静かに足跡をたどる', '通常の敵 / 体力を温存したい');
      const riskyBtn = renderButton('risky', '宝の気配を追う', '敵の体力 +3 / 鉄片 +3');
      actionButtonsHtml = `${carefulBtn}${riskyBtn}`;
    }

    let unbankedControlsHtml = '';
    if (!isCleared) {
      const canHeal = expedition.potions > 0 && expedition.hp < engine.maxHp(state);
      unbankedControlsHtml = `
        ${renderButton('return', 'ここで生還する', '', { class: 'secondary' })}
        <div class="combat-foot">
          ${renderButton('heal', `薬草を使う（残り ${expedition.potions}）· 体力 +12`, '', {
            class: 'text-button',
            disabled: !canHeal
          })}
          <span class="small">安全に使える</span>
        </div>
      `;
    }

    return `
      <p class="kicker">${kicker}</p>
      <h2>${title}</h2>
      <p class="intro">${intro}</p>
      ${renderLootLedger(expedition)}
      <div class="button-stack">
        ${actionButtonsHtml}
      </div>
      ${renderLogs(expedition)}
      ${unbankedControlsHtml}
    `;
  }

  /**
   * Active expedition view layout.
   */
  function renderExpeditionView() {
    const expedition = state.expedition;
    const placeInfo = engine.place(expedition.place);
    const isFight = expedition.stage === 'fight';

    const depthPad = String(expedition.depth).padStart(2, '0');
    const roomSubtitle = expedition.stage === 'cleared' ? '踏破' : `${expedition.room + 1} / 5`;
    const layoutClass = `game-layout ${isFight ? 'battle-layout' : ''}`;

    return `
      <div class="${layoutClass}">
        <section class="visual-column">
          ${renderScene(
            expedition.place,
            placeInfo.name,
            `DEPTH ${depthPad} · ${roomSubtitle}`,
            expedition.enemy?.kind,
            engine.GEAR[state.equipped].name
          )}
          ${renderRoute(expedition)}
          ${renderVitals(expedition)}
          <div class="journey-note">
            <b>${depthPad}</b>
            <span>深層 ${expedition.depth} · 戦利品を失っても、持ち込んだ装備は残る。<br>現実に拠点まで戻る必要はありません。</span>
          </div>
        </section>
        <section class="panel">
          ${isFight ? renderFightPanel(expedition) : renderPathPanel(expedition)}
        </section>
      </div>
    `;
  }

  /**
   * Expedition conclusion report view (Safe return or Defeat).
   */
  function renderReportView() {
    const rep = state.report;
    const placeInfo = engine.place(rep.place);
    const died = rep.died;

    const sceneTitle = died ? '火は、まだ消えていない。' : 'おかえり、旅人。';
    const sceneSubtitle = died ? 'THE ROAD IS NOT OVER' : 'YOU MADE IT HOME';

    const kicker = `${died ? 'EXPEDITION LOST' : 'SAFE RETURN'} / ${placeInfo.name}`;
    const heading = died
      ? '命だけを、持ち帰った。'
      : rep.newGear.length
        ? '次は、違う戦い方で。'
        : '欲張らずに、帰る強さ。';

    const intro = died
      ? '背嚢の中身は霧の中へ。手元の鉄片と装備は無事だ。敵の予兆を読み、次は早めに帰ろう。'
      : '背嚢の中身は、もうあなたのもの。傷を癒やし、薬草を補充した。新しい準備で、霧の向こうへ。';

    const scrapDiff = `${died ? '−' : '+'}${rep.scrap}`;
    const scrapNote = died ? '鉄片を失った' : '鉄片を確保';

    const gearReportsHtml = rep.gear.map((gearId) => {
      const gear = engine.GEAR[gearId];
      const gearName = `${died ? '失った：' : ''}${gear.name}`;
      const gearSubtext = died ? 'もう一度、土地の主に挑もう。' : gear.text;
      return `
        <div class="reward">
          <span class="reward-icon">♢</span>
          <div>
            <strong>${gearName}</strong>
            <small>${gearSubtext}</small>
          </div>
        </div>
      `;
    }).join('');

    const crownVictoryNoticeHtml = !died && state.owned.includes('crown')
      ? '<p class="notice">灰冠の廟を越えた。名もなき旅人の、最初の物語が残った。</p>'
      : '';

    const continueButtonTitle = rep.newGear.some((g) => g !== 'crown')
      ? '持ち帰った装備を試す'
      : '焚き火で次の準備をする';

    let ruleLineText = '別の道を歩けば、別の土地と装備に出会えます。';
    if (died) {
      ruleLineText = '遠征の失敗で、恒久的な進行は失われません。';
    } else if (state.cleared.length >= 2 && !state.owned.includes('crown')) {
      ruleLineText = '二つの土地を越えた。次は「灰冠の廟」の主に挑める。';
    }

    return `
      <div class="game-layout">
        <section class="visual-column">
          ${renderScene('camp', sceneTitle, sceneSubtitle)}
        </section>
        <section class="panel">
          <p class="kicker">${kicker}</p>
          <h1>${heading}</h1>
          <p class="intro">${intro}</p>
          <div class="result-number">
            ${scrapDiff} <small>${scrapNote}</small>
          </div>
          ${gearReportsHtml}
          ${crownVictoryNoticeHtml}
          <div class="button-stack">
            ${renderButton('continue', continueButtonTitle, '', { class: 'primary' })}
          </div>
          <p class="small rule-line">${ruleLineText}</p>
        </section>
      </div>
    `;
  }

  /**
   * Main render function that swaps the root container contents.
   */
  function render() {
    if (isTabConflict) {
      rootElement.innerHTML = `
        <div class="help">
          <h2>別のタブで旅が進んでいます。</h2>
          <p>最新のセーブを読み直してください。</p>
          <button class="primary" data-action="reload">再読み込み</button>
        </div>
      `;
      return;
    }

    if (!state.mode) {
      rootElement.innerHTML = renderOnboardView();
    } else if (state.expedition) {
      rootElement.innerHTML = renderExpeditionView();
    } else if (state.report) {
      rootElement.innerHTML = renderReportView();
    } else {
      rootElement.innerHTML = renderCampView();
    }
  }

  // ==========================================================================
  // 5. Geolocation Handlers
  // ==========================================================================

  /**
   * Processes a location fix through the pure observation rules.
   */
  function handleLocationFix(fix) {
    const result = engine.observe(geoSession, fix);
    const feedbackMessages = {
      inaccurate: '位置の精度が足りません。進行は変わっていません。安全な場所で後ほど試してください。',
      moving: '移動中のようです。安全に立ち止まってから試してください。',
      anchored: 'ここを今回の起点にしました。次の安全な立ち止まり場所で、別の土地を探せます。',
      nearby: '起点の近くです。この地域の森はすでに発見済み。別の機会に違う道を散策してみましょう。'
    };

    if (result.status === 'discovered') {
      const alreadyKnown = state.unlocked.includes(result.place);
      state = engine.discover(state, result.place);
      selectedPlaceId = result.place;

      const placeName = engine.place(result.place).name;
      statusNotice = alreadyKnown
        ? `この地域では「${placeName}」を発見済み。いつでも再訪できます。`
        : `霧が晴れた。「${placeName}」を発見。以後はその場にいなくても遠征できます。`;

      persistState();
    } else {
      statusNotice = feedbackMessages[result.status];
    }

    isGpsBusy = false;
    render();
  }

  // ==========================================================================
  // 6. Event Dispatcher & Interaction Handling
  // ==========================================================================

  rootElement.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target || target.disabled) return;

    const { action, value } = target.dataset;

    if (action === 'reload') {
      location.reload();
      return;
    }

    if (isTabConflict) return;

    const stateBeforeAction = state;

    // --- Mode & Navigation Actions ---
    if (action === 'mode') {
      loadMode(value);
      persistState();
      return;
    }

    if (action === 'switch-mode') {
      loadMode(state.mode === 'demo' ? 'walk' : 'demo');
      persistState();
      return;
    }

    if (action === 'select') {
      selectedPlaceId = value;
      activeTab = 'explore';
      statusNotice = '';
    } else if (action === 'tab') {
      activeTab = value;
      statusNotice = '';
    } else if (action === 'scout') {
      // Demo simulated walking
      const demoSession = engine.locationSession();
      engine.observe(demoSession, { latitude: 0, longitude: 0, accuracy: 5 });
      geoSession = demoSession;

      const offsets = {
        tower: [0.003, 0],
        fen: [0, 0.003],
        crypt: [-0.003, 0],
        wood: [0, -0.003]
      };
      const [offsetLat, offsetLon] = offsets[value];
      handleLocationFix({
        latitude: offsetLat,
        longitude: offsetLon,
        accuracy: 5,
        speed: 0
      });
      return;
    } else if (action === 'gps') {
      // Real Geolocation
      if (!navigator.geolocation || !window.isSecureContext) {
        statusNotice = 'この環境では位置情報を使えません。HTTPS または localhost で開くか、散策体験モードで遊べます。';
        render();
        return;
      }

      isGpsBusy = true;
      const currentRequestId = ++locationRequestId;
      render();

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const isStillValid =
            currentRequestId === locationRequestId &&
            state.mode === 'walk' &&
            !state.expedition &&
            !isTabConflict;

          if (isStillValid) {
            handleLocationFix(position.coords);
          }
        },
        (error) => {
          const isStillValid =
            currentRequestId === locationRequestId &&
            state.mode === 'walk' &&
            !state.expedition &&
            !isTabConflict;

          if (!isStillValid) return;

          isGpsBusy = false;
          statusNotice = error.code === 1
            ? '位置情報は許可されませんでした。設定を変えずに、散策体験モードでも遊べます。'
            : '現在地を取得できませんでした。後ほど試すか、散策体験モードで続けられます。';
          render();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
      );
      return;
    } else if (action === 'depart') {
      locationRequestId++;
      isGpsBusy = false;
      state = engine.start(state, value);
    } else if (action === 'equip') {
      state = engine.equip(state, value);
      statusNotice = `${engine.GEAR[value].name}を装備した。`;
    } else if (action === 'upgrade') {
      state = engine.upgrade(state);
      if (state !== stateBeforeAction) {
        statusNotice = `旅装を補強した。最大体力 ${engine.maxHp(state)}。`;
      }
    } else if (action === 'continue') {
      activeTab = state.report.newGear.some((g) => g !== 'crown') ? 'gear' : 'explore';
      state = { ...state, report: null };
      statusNotice = '';
    } else {
      // Expedition Action
      state = engine.act(state, action);
    }

    if (state !== stateBeforeAction) {
      persistState();
    }

    render();

    // Keyboard accessibility: retain focus on active button or fallback to primary strike
    if (event.detail === 0) {
      const focusTarget =
        document.querySelector(`[data-action="${action}"]:not(:disabled)`) ||
        document.querySelector('[data-action="strike"]');
      focusTarget?.focus({ preventScroll: true });
    }

    // Keep the decision panel in view on mobile screens after major transitions
    const isMajorPhaseChange =
      ['depart', 'continue', 'return', 'flee'].includes(action) ||
      (stateBeforeAction.expedition &&
        state.expedition?.stage !== stateBeforeAction.expedition.stage);

    if (isMajorPhaseChange) {
      document.querySelector('.panel')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  });

  // ==========================================================================
  // 7. Global Listeners & Bootstrap
  // ==========================================================================

  const helpToggleButton = document.querySelector('#help-toggle');
  if (helpToggleButton) {
    helpToggleButton.addEventListener('click', (e) => {
      const helpElement = document.querySelector('#help');
      if (helpElement) {
        helpElement.hidden = !helpElement.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!helpElement.hidden));
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (currentStorageKey && event.key === currentStorageKey && event.newValue !== lastSavedRawJson) {
      isTabConflict = true;
      updateSaveWarning('別のタブで進行が変わりました。再読み込みすると最新の旅へ戻れます。');
      render();
    }
  });

  // Initial load
  try {
    const savedMode = localStorage.getItem('crownless-expedition-mode');
    if (['demo', 'walk'].includes(savedMode)) {
      loadMode(savedMode);
    } else {
      render();
    }
  } catch {
    render();
    updateSaveWarning('このブラウザでは保存を利用できません。');
  }
})();
