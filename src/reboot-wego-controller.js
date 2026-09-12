(function () {
  'use strict';

  const battlefield = window.CrownlessRebootWegoBattlefield;
  if (!battlefield) {
    const existing = document.querySelector('script[data-wego-battlefield-loader]');
    if (existing) return;
    const loader = document.createElement('script');
    loader.src = 'src/reboot-wego-battlefield.js';
    loader.dataset.wegoBattlefieldLoader = 'true';
    loader.addEventListener('load', () => boot(window.CrownlessRebootWegoBattlefield));
    loader.addEventListener('error', () => {
      const status = document.querySelector('#location-status');
      if (status) {
        status.textContent = '戦況図を読み込めなかった。ページを再読み込みしてもう一度試す。';
        status.dataset.tone = 'warning';
      }
    });
    document.head.appendChild(loader);
    return;
  }

  boot(battlefield);

  function boot(boardModel) {
    const p3 = window.CrownlessRebootPhase3State;
    const p4 = window.CrownlessRebootPhase4State;
    const fieldModel = window.CrownlessRebootPhase7Exploration;
    const wego = window.CrownlessRebootWegoEncounter;
    if (!p3 || !p4 || !fieldModel || !wego || !boardModel) throw new Error('Reboot WEGO encounter dependencies are required');

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
              <p>文章ではなく戦況図を先に見る。敵も自分も、一手ごとに同時に位置を変える。</p>
            </div>
            <b id="wego-round-mark">遭遇前</b>
          </header>

          <div id="wego-battlefield" class="wego-battlefield" data-certainty="vague" data-gear="shield" data-retreat="open" data-outcome="none">
            <div class="wego-battlefield-meta">
              <span>戦況図 / ROAD AMBUSH</span>
              <div>
                <b id="wego-visual-read">狙いは不明</b>
                <small id="wego-gear-visual">丸盾 / 射線防御</small>
              </div>
            </div>
            <div id="wego-board" class="wego-board" role="img" aria-label="あなたの前方に前衛、その後方右手に弓兵。左上に崩れ石、左下が退路。">
              <div class="wego-road-axis" aria-hidden="true"><span>古街道</span></div>
              <div class="wego-rubble wego-rubble-a" aria-hidden="true"><span>崩れ石</span></div>
              <div class="wego-rubble wego-rubble-b" aria-hidden="true"></div>
              <div id="wego-retreat-lane" class="wego-retreat-lane" aria-hidden="true"><span>退路</span></div>

              <svg class="wego-intent-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker id="wego-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L8,4 L0,8 Z" />
                  </marker>
                </defs>
                <path id="wego-intent-front" class="wego-intent-path wego-front-path" d="" />
                <path id="wego-intent-shot" class="wego-intent-path wego-shot-path" d="" />
              </svg>

              <div id="wego-player-unit" class="wego-unit wego-player-unit" style="--x:26%;--y:61%;">
                <span class="wego-token">自</span>
                <small>あなた</small>
                <i class="wego-reach-ring" aria-hidden="true"></i>
                <i class="wego-shield-arc" aria-hidden="true"></i>
                <i class="wego-mobility-mark" aria-hidden="true"></i>
              </div>

              <div id="wego-front-unit" class="wego-unit wego-enemy-unit wego-front-unit" style="--x:61%;--y:57%;">
                <span class="wego-token">前</span>
                <small>前衛</small>
                <b id="wego-front-cue" class="wego-unit-cue">?</b>
              </div>

              <div id="wego-archer-unit" class="wego-unit wego-enemy-unit wego-archer-unit" style="--x:79%;--y:31%;">
                <span class="wego-token">弓</span>
                <small>弓兵</small>
                <b id="wego-archer-cue" class="wego-unit-cue">?</b>
              </div>

              <span id="wego-uncertainty" class="wego-uncertainty" aria-hidden="true">?</span>
            </div>
            <div class="wego-battlefield-legend" aria-hidden="true">
              <span><i class="wego-legend-line front"></i>前衛の動き</span>
              <span><i class="wego-legend-line shot"></i>弓の射線</span>
              <span><i class="wego-legend-block"></i>遮蔽</span>
            </div>
          </div>

          <div id="wego-staging" class="wego-staging">
            <p class="wego-stop-note"><strong>ここで停止。</strong> 歩行中には判断しない。安全に立ち止まってから、戦況図と持ち込む装備を確認する。</p>
            <div class="wego-known">
              <span>探索で持ち込んだ情報</span>
              <ul id="wego-known-list"></ul>
            </div>
            <fieldset class="wego-gear">
              <legend>今回持ち込む装備</legend>
              <button type="button" data-wego-gear="long_spear" aria-pressed="false"><strong>長槍</strong><small>間合いでpress</small></button>
              <button type="button" data-wego-gear="round_shield" aria-pressed="true"><strong>丸盾</strong><small>射線をguard</small></button>
              <button type="button" data-wego-gear="light_kit" aria-pressed="false"><strong>軽装・素手</strong><small>地形へmaneuver</small></button>
            </fieldset>
            <p id="wego-gear-note" class="wego-gear-note"></p>
            <button id="wego-engage" class="ink-button primary-action" type="button">この布陣で対峙する</button>
          </div>

          <div id="wego-round" class="wego-round" hidden>
            <div class="wego-state-line" aria-label="現在の戦況">
              <span id="wego-position">主導権: 互角</span>
              <span id="wego-pressure">退路: 確保</span>
              <span id="wego-injury">負傷: なし</span>
            </div>
            <div class="wego-readout">
              <article><span>盤面から読める兆候</span><p id="wego-intent"></p></article>
              <article><span>直前の盤面変化</span><p id="wego-resolution"></p></article>
            </div>
            <div id="wego-actions" class="wego-actions" aria-label="このラウンドの行動を選ぶ">
              <button type="button" data-wego-action="press"><span class="wego-action-mark">攻</span><span><strong>押す <em>press</em></strong><small>間合いを詰めて連携を崩す</small></span></button>
              <button type="button" data-wego-action="guard"><span class="wego-action-mark">守</span><span><strong>守る <em>guard</em></strong><small>射線を切り、次手を読む</small></span></button>
              <button type="button" data-wego-action="maneuver"><span class="wego-action-mark">回</span><span><strong>回る <em>maneuver</em></strong><small>石と轍を使って位置を変える</small></span></button>
              <button type="button" data-wego-action="retreat"><span class="wego-action-mark">退</span><span><strong>退く <em>retreat</em></strong><small>情報を持って退路へ戻る</small></span></button>
            </div>
          </div>

          <div id="wego-result" class="wego-result" hidden>
            <b id="wego-result-mark"></b>
            <h4 id="wego-result-title"></h4>
            <p id="wego-result-copy"></p>
            <p id="wego-result-intel"></p>
            <button id="wego-return" class="ink-button primary-action" type="button">変わった土地へ戻る</button>
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
      renderBattlefield(wego.createEncounter({ clues: encounterClues, gear: selectedGear }));
      setStatus('敵対遭遇。歩くのを止め、まず戦況図から敵の位置・射線・退路を読む。', 'warning');
      if (persistenceNote) persistenceNote.textContent = '戦況図・ラウンド・入力・敵意図は一時状態。生還後の結果と負傷、土地の変化だけを残す。';
    }

    function selectGear(gearId) {
      selectedGear = wego.gearDefinition(gearId).id;
      if (!surface) return;
      surface.querySelectorAll('[data-wego-gear]').forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.wegoGear === selectedGear ? 'true' : 'false');
      });
      $('#wego-gear-note').textContent = wego.gearDefinition(selectedGear).note;
      if (surface.dataset.mode === 'staging') {
        renderBattlefield(wego.createEncounter({ clues: encounterClues, gear: selectedGear }));
      }
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

    function compactResolution(value) {
      const sentences = String(value || '').split('。').map((part) => part.trim()).filter(Boolean);
      if (!sentences.length) return 'まだ動いていない。';
      return `${sentences.slice(0, 2).join('。')}。`;
    }

    function renderEncounter() {
      if (!encounter) return;
      renderBattlefield(encounter);
      $('#wego-resolution').textContent = compactResolution(encounter.lastResolution);
      $('#wego-position').textContent = advantageLabel(encounter.advantage);
      $('#wego-pressure').textContent = pressureLabel(encounter.pressure);
      $('#wego-injury').textContent = `負傷: ${wego.injuryLabel(encounter.injury)}`;

      if (encounter.status === 'resolved') return finishEncounter();

      $('#wego-round-mark').textContent = `ROUND ${encounter.round} / ${wego.MAX_ROUNDS}`;
      $('#wego-intent').textContent = wego.intentPresentation(encounter);
      $('#wego-actions').querySelectorAll('button').forEach((button) => { button.disabled = false; });
      setStatus(`ROUND ${encounter.round}: 線と駒の動きを見て、押す / 守る / 回る / 退くから一手を選ぶ。`, 'trace');
    }

    function renderBattlefield(state) {
      const plan = state && state.status === 'active' ? wego.enemyPlan(state) : null;
      const scene = boardModel.sceneFor(state, plan);
      const field = $('#wego-battlefield');
      const board = $('#wego-board');
      if (!field || !board) return;

      field.dataset.certainty = scene.certainty;
      field.dataset.gear = scene.gear;
      field.dataset.retreat = scene.retreatTone;
      field.dataset.outcome = scene.outcome || 'none';
      field.dataset.plan = scene.planId || 'resolved';
      board.dataset.lastAction = state && state.lastAction ? state.lastAction : 'none';

      positionUnit($('#wego-player-unit'), scene.player);
      positionUnit($('#wego-front-unit'), scene.frontliner);
      positionUnit($('#wego-archer-unit'), scene.archer);
      renderIntentPath($('#wego-intent-front'), scene.frontIntent, scene.certainty);
      renderIntentPath($('#wego-intent-shot'), scene.shotIntent, scene.certainty);

      const vague = scene.certainty === boardModel.CERTAINTY.VAGUE;
      const partial = scene.certainty === boardModel.CERTAINTY.PARTIAL;
      $('#wego-front-cue').textContent = vague ? '?' : scene.frontliner.cue;
      $('#wego-archer-cue').textContent = vague ? '?' : scene.archer.cue;
      $('#wego-visual-read').textContent = scene.status === 'resolved'
        ? outcomeLabel(scene.outcome)
        : boardModel.certaintyLabel(scene.certainty);
      $('#wego-gear-visual').textContent = ({
        reach: '長槍 / 間合いが見える',
        shield: '丸盾 / 射線防御が見える',
        mobility: '軽装 / 移動余地が見える'
      })[scene.gear];

      const uncertainty = $('#wego-uncertainty');
      uncertainty.hidden = scene.status === 'resolved' || scene.certainty === boardModel.CERTAINTY.CLEAR;
      uncertainty.textContent = vague ? '?' : '…';

      const retreatText = ({ open: '退路は開いている', watched: '退路を見られている', danger: '退路を塞がれかけている' })[scene.retreatTone];
      const certaintyText = scene.status === 'resolved' ? outcomeLabel(scene.outcome) : boardModel.certaintyLabel(scene.certainty);
      board.setAttribute('aria-label', `戦況図。あなた、前衛1人、弓兵1人、崩れ石、退路。${certaintyText}。${retreatText}。`);
    }

    function outcomeLabel(outcome) {
      if (outcome === 'cleared') return '敵が街道から退いた';
      if (outcome === 'forced_retreat') return '敵が街道を押さえた';
      return '情報を持って撤退した';
    }

    function positionUnit(element, unit) {
      if (!element || !unit) return;
      element.style.setProperty('--x', `${unit.x}%`);
      element.style.setProperty('--y', `${unit.y}%`);
    }

    function renderIntentPath(element, intent, certainty) {
      if (!element) return;
      if (!intent) {
        element.setAttribute('d', '');
        element.dataset.kind = 'none';
        return;
      }

      const scale = certainty === boardModel.CERTAINTY.VAGUE ? 0.5
        : certainty === boardModel.CERTAINTY.PARTIAL ? 0.78
          : 1;
      const endX = intent.from[0] + ((intent.to[0] - intent.from[0]) * scale);
      const endY = intent.from[1] + ((intent.to[1] - intent.from[1]) * scale);
      element.setAttribute('d', `M ${intent.from[0]} ${intent.from[1]} L ${endX} ${endY}`);
      element.dataset.kind = intent.kind;
    }

    function finishEncounter() {
      renderBattlefield(encounter);
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
      $('#wego-result-copy').textContent = presentation.text;
      $('#wego-result-intel').textContent = `持ち帰った情報: ${record.intel.join(' / ') || '敵構成を確認した'}`;
      applyPersistentLandState(record);
      setStatus(persisted
        ? '戦況図の結末だけを世界状態へ残した。途中の駒位置や入力は保存していない。'
        : '遭遇は解決したが、端末へ結果を保存できなかった。このタブでは土地の変化を確認できる。', persisted ? 'found' : 'warning');
    }

    function applyPersistentLandState(record) {
      const presentation = wego.presentationForPersistent(record);
      if (!presentation) return;
      if (map) map.dataset.wegoRoad = presentation.tone;
      response.dataset.wegoResult = presentation.tone;
      response.dataset.territoryOwner = presentation.owner || 'npc';

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
        setStatus(`街道の状態が変わった: ${presentation.mark}。${presentation.nextDecision}`, 'found');
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
  }
})();
