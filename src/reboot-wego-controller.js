(function () {
  'use strict';

  const p3 = window.CrownlessRebootPhase3State;
  const p4 = window.CrownlessRebootPhase4State;
  const fieldModel = window.CrownlessRebootPhase7Exploration;
  const wego = window.CrownlessRebootWegoEncounter;
  if (!p3 || !p4 || !fieldModel || !wego) throw new Error('Reboot WEGO encounter dependencies are required');

  const $ = (selector) => document.querySelector(selector);
  const navigation = $('#phase6-navigation');
  const response = $('#phase8-response');
  const status = $('#location-status');
  const persistenceNote = $('#persistence-note');
  const map = $('#reboot-map');
  if (!navigation || !response) return;

  let selectedGear = wego.GEAR.ROUND_SHIELD.id;
  let encounter = null;
  let encounterClues = [];
  let surface = null;

  injectSurface();
  clearStalePrototypeOutcome();
  syncFromExploration();

  const observer = new MutationObserver(() => syncFromExploration());
  observer.observe(response, { attributes: true, attributeFilter: ['data-stage', 'data-sector'] });

  function loadWorld() {
    try { return p4.parseState(window.localStorage.getItem(p4.STORAGE_KEY)); }
    catch (_error) { return p4.normalizeState({}); }
  }

  function loadPersistent() {
    try { return wego.parsePersistentRecord(window.localStorage.getItem(wego.STORAGE_KEY)); }
    catch (_error) { return null; }
  }

  function clearStalePrototypeOutcome() {
    const world = loadWorld();
    if (world.choices && world.choices[p3.BLACK_RAVEN_HILL]) return;
    try { window.localStorage.removeItem(wego.STORAGE_KEY); }
    catch (_error) { /* base Reboot already handles unavailable persistence separately */ }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function injectSurface() {
    if ($('#wego-encounter')) {
      surface = $('#wego-encounter');
      return;
    }

    navigation.insertAdjacentHTML('afterend', `
      <section id="wego-encounter" class="wego-encounter" data-mode="staging" hidden aria-live="polite" aria-label="街道の追い剥ぎとのWEGO遭遇戦">
        <p class="eyebrow">#564 / STOPPED WEGO ENCOUNTER</p>
        <header class="wego-heading">
          <div>
            <h3>街道の追い剥ぎ</h3>
            <p>前衛1・弓兵1。行動を選ぶと、敵も同じ瞬間に動く。</p>
          </div>
          <b id="wego-round-mark">遭遇前</b>
        </header>

        <div id="wego-staging" class="wego-staging">
          <p class="wego-stop-note"><strong>ここで停止。</strong> 歩行中には判断しない。安全に立ち止まってから、探索情報と持ち込む装備を確認する。</p>
          <div class="wego-known">
            <span>既知情報</span>
            <ul id="wego-known-list"></ul>
          </div>
          <fieldset class="wego-gear">
            <legend>今回持ち込む装備</legend>
            <button type="button" data-wego-gear="long_spear" aria-pressed="false"><strong>長槍</strong><small>press向き</small></button>
            <button type="button" data-wego-gear="round_shield" aria-pressed="true"><strong>丸盾</strong><small>guard向き</small></button>
            <button type="button" data-wego-gear="light_kit" aria-pressed="false"><strong>軽装・素手</strong><small>maneuver / retreat向き</small></button>
          </fieldset>
          <p id="wego-gear-note" class="wego-gear-note"></p>
          <button id="wego-engage" class="ink-button primary-action" type="button">立ち止まって対峙する</button>
        </div>

        <div id="wego-round" class="wego-round" hidden>
          <div class="wego-readout">
            <article><span>敵の兆候</span><p id="wego-intent"></p></article>
            <article><span>直前の同時解決</span><p id="wego-resolution"></p></article>
          </div>
          <div class="wego-state-line" aria-label="現在の戦況">
            <span id="wego-position">主導権: 互角</span>
            <span id="wego-pressure">退路: 確保</span>
            <span id="wego-injury">負傷: なし</span>
          </div>
          <div id="wego-actions" class="wego-actions" aria-label="このラウンドの行動を選ぶ">
            <button type="button" data-wego-action="press"><strong>press</strong><small>間合いを詰めて攻勢</small></button>
            <button type="button" data-wego-action="guard"><strong>guard</strong><small>守りながら意図を読む</small></button>
            <button type="button" data-wego-action="maneuver"><strong>maneuver</strong><small>地形と位置を変える</small></button>
            <button type="button" data-wego-action="retreat"><strong>retreat</strong><small>情報を持って生還する</small></button>
          </div>
        </div>

        <div id="wego-result" class="wego-result" hidden>
          <b id="wego-result-mark"></b>
          <h4 id="wego-result-title"></h4>
          <p id="wego-result-copy"></p>
          <p id="wego-result-intel"></p>
          <button id="wego-return" class="ink-button primary-action" type="button">土地へ戻る</button>
        </div>
      </section>`);

    surface = $('#wego-encounter');
    surface.querySelectorAll('[data-wego-gear]').forEach((button) => button.addEventListener('click', () => selectGear(button.dataset.wegoGear)));
    $('#wego-engage').addEventListener('click', startEncounter);
    $('#wego-actions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-wego-action]');
      if (!button || !encounter || encounter.status !== 'active') return;
      try {
        encounter = wego.resolveRound(encounter, button.dataset.wegoAction);
        renderEncounter();
      } catch (error) {
        setStatus(error.message, 'warning');
      }
    });
    $('#wego-return').addEventListener('click', returnToLand);
    selectGear(selectedGear);
  }

  function westEncounterClues() {
    const definition = fieldModel.threadDefinition('west', loadWorld());
    return definition ? fieldModel.cluesForThread(definition, 'encounter') : [];
  }

  function syncFromExploration() {
    const record = loadPersistent();
    if (record) applyPersistentLandState(record);

    const isWestEncounter = response.dataset.stage === 'encounter' && response.dataset.sector === 'west';
    if (!isWestEncounter) return;

    if (record) {
      if (!encounter || encounter.status === 'resolved') lockExploration(false);
      return;
    }
    if (encounter) return;

    encounterClues = westEncounterClues();
    prepareStaging();
  }

  function prepareStaging() {
    surface.hidden = false;
    surface.dataset.mode = 'staging';
    $('#wego-staging').hidden = false;
    $('#wego-round').hidden = true;
    $('#wego-result').hidden = true;
    $('#wego-round-mark').textContent = '遭遇前';

    const facts = wego.knownInformation(encounterClues);
    $('#wego-known-list').innerHTML = [
      '<li><b>目視</b> 前衛1人・弓兵1人</li>',
      ...facts.map((fact) => `<li>${escapeHtml(fact)}</li>`)
    ].join('');

    lockExploration(true);
    selectGear(selectedGear);
    setStatus('敵対遭遇。ここからは歩かず、安全に停止したまま状況を読み、1手ずつ同時解決する。', 'warning');
    if (persistenceNote) persistenceNote.textContent = '戦闘中のラウンド・入力・敵意図は保存しない。生還後の結果と負傷、土地の変化だけを残す。';
  }

  function selectGear(gearId) {
    selectedGear = wego.gearDefinition(gearId).id;
    surface.querySelectorAll('[data-wego-gear]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.wegoGear === selectedGear ? 'true' : 'false');
    });
    $('#wego-gear-note').textContent = wego.gearDefinition(selectedGear).note;
  }

  function startEncounter() {
    encounter = wego.createEncounter({ clues: encounterClues, gear: selectedGear });
    surface.dataset.mode = 'active';
    $('#wego-staging').hidden = true;
    $('#wego-round').hidden = false;
    renderEncounter();
  }

  function advantageLabel(value) {
    if (value >= 3) return '主導権: 崩し切る寸前';
    if (value >= 1) return '主導権: こちら寄り';
    if (value <= -1) return '主導権: 敵側';
    return '主導権: 互角';
  }

  function pressureLabel(value) {
    if (value >= 3) return '退路: 危うい';
    if (value >= 2) return '退路: 圧迫';
    if (value >= 1) return '退路: 警戒';
    return '退路: 確保';
  }

  function renderEncounter() {
    if (!encounter) return;
    $('#wego-resolution').textContent = encounter.lastResolution;
    $('#wego-position').textContent = advantageLabel(encounter.advantage);
    $('#wego-pressure').textContent = pressureLabel(encounter.pressure);
    $('#wego-injury').textContent = `負傷: ${wego.injuryLabel(encounter.injury)}`;

    if (encounter.status === 'resolved') return finishEncounter();

    $('#wego-round-mark').textContent = `ROUND ${encounter.round} / ${wego.MAX_ROUNDS}`;
    $('#wego-intent').textContent = wego.intentPresentation(encounter);
    $('#wego-actions').querySelectorAll('button').forEach((button) => { button.disabled = false; });
    setStatus(`WEGO ROUND ${encounter.round}: 敵の兆候を読み、press / guard / maneuver / retreat から一つ選ぶ。`, 'trace');
  }

  function finishEncounter() {
    const record = wego.persistentRecord(encounter);
    let persisted = false;
    try {
      window.localStorage.setItem(wego.STORAGE_KEY, wego.serializePersistentRecord(record));
      persisted = true;
    } catch (_error) {
      persisted = false;
    }

    const presentation = wego.presentationForPersistent(record);
    surface.dataset.mode = 'resolved';
    $('#wego-round').hidden = true;
    $('#wego-result').hidden = false;
    $('#wego-round-mark').textContent = record.result;
    $('#wego-result-mark').textContent = presentation.mark;
    $('#wego-result-title').textContent = presentation.title;
    $('#wego-result-copy').textContent = `${encounter.lastResolution} ${presentation.text}`;
    $('#wego-result-intel').textContent = `持ち帰った情報: ${record.intel.join(' / ') || '敵構成を確認した'}`;
    applyPersistentLandState(record);
    setStatus(persisted
      ? '遭遇の結末だけを世界状態へ残した。ラウンド入力や敵の内部意図は保存していない。'
      : '遭遇は解決したが、端末へ結果を保存できなかった。このタブでは土地の変化を確認できる。', persisted ? 'found' : 'warning');
  }

  function applyPersistentLandState(record) {
    const presentation = wego.presentationForPersistent(record);
    if (!presentation) return;
    if (map) map.dataset.wegoRoad = presentation.tone;
    response.dataset.wegoResult = presentation.tone;

    if (response.dataset.sector === 'west' && response.dataset.stage === 'encounter') {
      const title = $('#phase8-title');
      const stage = $('#phase8-stage');
      const copy = $('#phase8-copy');
      if (title) title.textContent = `西 / ${presentation.title}`;
      if (stage) stage.textContent = presentation.mark;
      if (copy) copy.textContent = presentation.text;
    }
  }

  function returnToLand() {
    const record = loadPersistent() || (encounter && wego.persistentRecord(encounter));
    surface.hidden = true;
    lockExploration(false);
    if (record) {
      applyPersistentLandState(record);
      const presentation = wego.presentationForPersistent(record);
      setStatus(`街道の状態が変わった: ${presentation.mark}。別方向へ戻るか、さらに街道へ踏み込める。`, 'found');
      if (persistenceNote) persistenceNote.textContent = `保存したのは ${record.result} / ${wego.injuryLabel(record.injury)} / 土地状態 / 持ち帰った敵情報だけ。位置・移動経路・ラウンド履歴は残していない。`;
    }
  }

  function lockExploration(locked) {
    navigation.dataset.wegoLocked = locked ? 'true' : 'false';
    navigation.querySelectorAll('button[data-move], #phase6-live-start, #phase6-live-check').forEach((button) => {
      button.disabled = Boolean(locked);
    });
  }

  function setStatus(message, tone) {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone || 'trace';
  }
})();