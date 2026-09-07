(function () {
  'use strict';
  const p3 = window.CrownlessRebootPhase3State;
  const p4 = window.CrownlessRebootPhase4State;
  const locationModel = window.CrownlessRebootPhase6Location;
  const fieldModel = window.CrownlessRebootPhase7Exploration;
  if (!p3 || !p4 || !locationModel || !fieldModel) throw new Error('Reboot Phase 8 exploration model is required');

  const $ = (selector) => document.querySelector(selector);
  const map = $('#reboot-map');
  const phase4Actions = $('#phase4-actions');
  const forkSummary = $('#fork-summary');
  const navigation = $('#phase6-navigation');
  const valleyStrength = $('#phase6-valley-strength');
  const valleyCopy = $('#phase6-valley-copy');
  const valleyTrend = $('#phase7-valley-trend');
  const valleyClues = $('#phase7-valley-clues');
  const roadStrength = $('#phase6-road-strength');
  const roadCopy = $('#phase6-road-copy');
  const roadTrend = $('#phase7-road-trend');
  const roadClues = $('#phase7-road-clues');
  const fieldNote = $('#phase7-field-note');
  const modeLabel = $('#phase6-mode');
  const liveStart = $('#phase6-live-start');
  const liveCheck = $('#phase6-live-check');
  const status = $('#location-status');
  const persistenceNote = $('#persistence-note');
  const hillChoices = $('#hill-choices');

  let session = locationModel.createSession('simulated');
  let previousSession = null;
  let clueMemory = fieldModel.createClueMemory();
  let threadMemory = fieldModel.createThreadMemory();
  let liveOrigin = null;
  let phase8Response = null;
  let phase8Title = null;
  let phase8Stage = null;
  let phase8Copy = null;
  let phase8Memory = null;

  injectPhase8Surface();
  injectMapLayer();
  refresh();

  function loadWorld() {
    try { return p4.parseState(window.localStorage.getItem(p4.STORAGE_KEY)); }
    catch (_error) { return p4.normalizeState({}); }
  }

  function readyForDirectionalDiscovery(world) {
    return Boolean(
      world.choices[p3.BLACK_RAVEN_HILL]
      && !world.choices[p4.FORK_FIRST_VISIT]
    );
  }

  function injectPhase8Surface() {
    if (!navigation) return;
    const eyebrow = navigation.querySelector('.eyebrow');
    const lead = navigation.querySelector('.phase6-lead');
    if (eyebrow) eyebrow.textContent = 'PHASE 8 / WALK INTO THE UNKNOWN';
    if (lead) lead.textContent = '安全に歩ける方向そのものを選ぶ。どちらへ進んでも世界は応答し、踏み込むほど気配が痕跡や出来事へ変わる。';

    if (!$('#phase8-response')) {
      const anchor = lead || navigation.firstElementChild;
      anchor.insertAdjacentHTML('afterend', `
        <article id="phase8-response" class="phase8-response-card" data-stage="unseen">
          <header><strong id="phase8-title">まだ書かれていない方角</strong><b id="phase8-stage">未接触</b></header>
          <p id="phase8-copy">安全に歩ける方向へ踏み出すと、その方向にあった世界の筋が見えてくる。</p>
          <div class="phase8-thread-memory">
            <span>この探索で触れた方向</span>
            <ul id="phase8-memory"><li data-empty="true">まだない</li></ul>
          </div>
        </article>`);
    }

    const pad = navigation.querySelector('.phase6-direction-pad');
    if (pad) {
      const diagonals = [
        ['north_west', '北西へ'],
        ['north_east', '北東へ'],
        ['south_west', '南西へ'],
        ['south_east', '南東へ']
      ];
      for (const [direction, label] of diagonals) {
        if (pad.querySelector(`[data-move="${direction}"]`)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.move = direction;
        button.textContent = label;
        pad.appendChild(button);
      }
    }

    phase8Response = $('#phase8-response');
    phase8Title = $('#phase8-title');
    phase8Stage = $('#phase8-stage');
    phase8Copy = $('#phase8-copy');
    phase8Memory = $('#phase8-memory');
  }

  function injectMapLayer() {
    const svg = map && map.querySelector('svg');
    if (!svg || $('#phase6-map-layer')) return;
    svg.insertAdjacentHTML('beforeend', `
      <g id="phase6-map-layer" aria-hidden="true">
        <g class="phase6-trace phase6-valley-trace">
          <circle cx="269" cy="139" r="10" />
          <path d="M260 140c4-6 9-6 13 0s9 6 13 0" />
        </g>
        <g class="phase6-trace phase6-road-trace">
          <circle cx="205" cy="31" r="10" />
          <path d="M196 34c6-2 12-2 18 0m-15-6 12 0" />
        </g>
        <g id="phase6-session-mark" class="phase6-session-mark">
          <circle cx="0" cy="0" r="4" />
          <path d="M-7 0h14M0-7v14" />
        </g>
        <text id="phase6-map-valley-note" class="map-note phase6-map-note" x="239" y="165"></text>
        <text id="phase6-map-road-note" class="map-note phase6-map-note" x="174" y="55"></text>
      </g>`);
  }

  function mapPoint(position) {
    const x = 299 + (0.6267 * position.x) - (0.22 * position.y);
    const y = 34 + (0.02 * position.x) - (0.89 * position.y);
    return {
      x: Math.max(8, Math.min(312, x)),
      y: Math.max(8, Math.min(172, y))
    };
  }

  function senseByCue(senses, cue) {
    return senses.find((sense) => sense.cue === cue);
  }

  function renderMap(senses) {
    if (!map) return;
    map.dataset.phase6 = 'searching';
    const valley = senseByCue(senses, 'valley');
    const road = senseByCue(senses, 'road');
    map.dataset.valleyStrength = valley ? valley.strength : 'far';
    map.dataset.roadStrength = road ? road.strength : 'far';
    map.dataset.phase8Sector = fieldModel.sectorForPosition(session) || 'origin';

    const point = mapPoint(session);
    const mark = $('#phase6-session-mark');
    if (mark) mark.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);

    const valleyNote = $('#phase6-map-valley-note');
    const roadNote = $('#phase6-map-road-note');
    if (valleyNote && valley) valleyNote.textContent = `${valley.direction}・${valley.strengthLabel}`;
    if (roadNote && road) roadNote.textContent = `${road.direction}・${road.strengthLabel}`;
  }

  function renderClueList(element, clues) {
    if (!element) return;
    if (!clues.length) {
      element.innerHTML = '<li data-empty="true">まだ拾っていない</li>';
      return;
    }
    element.innerHTML = clues.map((clue) => `<li>${escapeHtml(clue)}</li>`).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'\"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
    })[char]);
  }

  function renderThreadMemory(entries) {
    if (!phase8Memory) return;
    if (!entries.length) {
      phase8Memory.innerHTML = '<li data-empty="true">まだない</li>';
      return;
    }
    phase8Memory.innerHTML = entries.map((entry) => (
      `<li><b>${escapeHtml(entry.direction)}</b> ${escapeHtml(entry.title)} <small>${escapeHtml(entry.stageLabel)}</small></li>`
    )).join('');
  }

  function renderPhase8Observation(observation) {
    if (!phase8Response || !observation) return;
    renderThreadMemory(observation.entries || []);
    const response = observation.response;
    if (!response) {
      phase8Response.dataset.stage = 'unseen';
      phase8Title.textContent = 'まだ書かれていない方角';
      phase8Stage.textContent = '未接触';
      phase8Copy.textContent = '安全に歩ける方向へ踏み出すと、その方向にあった世界の筋が見えてくる。';
      return;
    }

    phase8Response.dataset.stage = response.stage;
    phase8Response.dataset.sector = response.sector;
    phase8Title.textContent = `${response.direction} / ${response.title}`;
    phase8Stage.textContent = response.stageLabel;
    phase8Copy.textContent = response.text;

    if (response.stage === 'encounter') {
      status.textContent = `PHASE 8: ${response.direction}で「${response.title}」に出会った。別方向にも別の世界が残っている。`;
      status.dataset.tone = 'found';
    } else {
      status.textContent = `PHASE 8: ${response.direction}へ歩いたことで「${response.title}」の${response.stageLabel}が立ち上がった。`;
      status.dataset.tone = 'trace';
    }
  }

  function renderSession() {
    const world = loadWorld();
    const observation = fieldModel.observe(previousSession, session, clueMemory);
    clueMemory = observation.memory;
    const threadObservation = fieldModel.observeFieldThreads(session, threadMemory, world);
    threadMemory = threadObservation.memory;
    const senses = observation.senses;
    const valley = senseByCue(senses, 'valley');
    const road = senseByCue(senses, 'road');

    if (valley) {
      valleyStrength.textContent = `${valley.direction}・${valley.strengthLabel}`;
      valleyStrength.dataset.strength = valley.strength;
      valleyCopy.textContent = valley.text;
      if (valleyTrend) {
        valleyTrend.textContent = valley.trendLabel;
        valleyTrend.dataset.trend = valley.trend;
      }
      renderClueList(valleyClues, clueMemory[valley.placeId] || []);
    }
    if (road) {
      roadStrength.textContent = `${road.direction}・${road.strengthLabel}`;
      roadStrength.dataset.strength = road.strength;
      roadCopy.textContent = road.text;
      if (roadTrend) {
        roadTrend.textContent = road.trendLabel;
        roadTrend.dataset.trend = road.trend;
      }
      renderClueList(roadClues, clueMemory[road.placeId] || []);
    }

    renderPhase8Observation(threadObservation);
    if (fieldNote) fieldNote.textContent = threadObservation.note;

    modeLabel.textContent = session.mode === 'live'
      ? 'LIVE LOCATION / 現在地は確認ボタンを押した瞬間だけ読む'
      : 'SIMULATED LOCATION / 8方向すべてに別の世界の筋がある';
    renderMap(senses);
    previousSession = session;

    const placeId = locationModel.discoveredPlace(session);
    if (placeId) resolveByMovement(placeId);
  }

  function resolveByMovement(placeId) {
    const button = phase4Actions && phase4Actions.querySelector(`button[data-place="${placeId}"]`);
    if (!button) {
      status.textContent = '既存の地点発見transitionへ接続できなかった。';
      status.dataset.tone = 'warning';
      return;
    }

    button.click();
    navigation.hidden = true;
    document.body.dataset.phase6Navigation = 'resolved';
    document.body.dataset.phase8 = 'resolved';
    if (map) map.dataset.phase6 = 'resolved';

    queueMicrotask(() => {
      const world = loadWorld();
      const chosen = world.choices[p4.FORK_FIRST_VISIT];
      if (!chosen) return;
      status.textContent = 'PHASE 8: 歩いた方向の世界を読み、そのまま既存の不可逆な地点訪問へ踏み込んだ。';
      status.dataset.tone = 'found';
      persistenceNote.textContent = '世界の変化だけを保存した。位置・移動履歴・途中で触れた方向の手掛かりは端末に残していない。';
    });
  }

  function renderReady() {
    document.body.dataset.phase6Navigation = 'enabled';
    document.body.dataset.phase8 = 'enabled';
    navigation.hidden = false;
    phase4Actions.hidden = true;
    if (forkSummary) forkSummary.hidden = true;
    status.textContent = 'PHASE 8: 安全に歩ける方向なら、どちらへ進んでも何かが起きる。';
    status.dataset.tone = 'trace';
    persistenceNote.textContent = '探索中の位置・方向・拾った手掛かりはセッション内だけ。localStorageには世界状態しか残さない。';
    renderSession();
  }

  function renderInactive() {
    navigation.hidden = true;
    document.body.dataset.phase6Navigation = 'inactive';
    document.body.dataset.phase8 = 'inactive';
    if (map) map.dataset.phase6 = 'inactive';
  }

  function refresh() {
    const world = loadWorld();
    if (!readyForDirectionalDiscovery(world)) return renderInactive();
    renderReady();
  }

  function readCurrentLocation(onSuccess) {
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
      status.textContent = 'この環境では現在地を取得できない。模擬位置で同じ判定を試せる。';
      status.dataset.tone = 'warning';
      return;
    }

    status.textContent = '安全に立ち止まった現在地を、一度だけ確認している…';
    status.dataset.tone = 'trace';
    navigator.geolocation.getCurrentPosition((position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    }, () => {
      status.textContent = '現在地を確認できなかった。模擬位置でも同じ発見ルールを試せる。';
      status.dataset.tone = 'warning';
    }, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 30000
    });
  }

  navigation.addEventListener('click', (event) => {
    const moveButton = event.target.closest('button[data-move]');
    if (!moveButton) return;
    liveOrigin = null;
    liveCheck.hidden = true;
    try {
      if (session.mode !== 'simulated') {
        session = locationModel.createSession('simulated');
        previousSession = null;
        clueMemory = fieldModel.createClueMemory();
        threadMemory = fieldModel.createThreadMemory();
      }
      session = locationModel.moveSession(session, moveButton.dataset.move);
      renderSession();
    } catch (error) {
      status.textContent = error.message;
      status.dataset.tone = 'warning';
    }
  });

  liveStart.addEventListener('click', () => {
    readCurrentLocation((sample) => {
      liveOrigin = sample;
      session = locationModel.createSession('live');
      previousSession = null;
      clueMemory = fieldModel.createClueMemory();
      threadMemory = fieldModel.createThreadMemory();
      liveCheck.hidden = false;
      renderSession();
      status.textContent = '現在地を一時的な原点にした。安全に歩ける好きな方向へ移動し、立ち止まって再確認する。';
      status.dataset.tone = 'trace';
    });
  });

  liveCheck.addEventListener('click', () => {
    if (!liveOrigin) return;
    readCurrentLocation((sample) => {
      try {
        session = locationModel.sessionAt(locationModel.relativeMeters(liveOrigin, sample), 'live');
        renderSession();
      } catch (error) {
        status.textContent = error.message;
        status.dataset.tone = 'warning';
      }
    });
  });

  if (hillChoices) hillChoices.addEventListener('click', () => queueMicrotask(refresh));
  if (phase4Actions) phase4Actions.addEventListener('click', () => queueMicrotask(refresh));
})();
