(function () {
  'use strict';
  const p3 = window.CrownlessRebootPhase3State;
  const p4 = window.CrownlessRebootPhase4State;
  const locationModel = window.CrownlessRebootPhase6Location;
  const fieldModel = window.CrownlessRebootPhase7Exploration;
  if (!p3 || !p4 || !locationModel || !fieldModel) throw new Error('Reboot Phase 7 exploration model is required');

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
  let liveOrigin = null;

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

  function renderSession() {
    const observation = fieldModel.observe(previousSession, session, clueMemory);
    clueMemory = observation.memory;
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
    if (fieldNote) fieldNote.textContent = observation.note;

    modeLabel.textContent = session.mode === 'live'
      ? 'LIVE LOCATION / 現在地は確認ボタンを押した瞬間だけ読む'
      : 'SIMULATED LOCATION / 方角だけを動かして気配を読む';
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
    if (map) map.dataset.phase6 = 'resolved';

    queueMicrotask(() => {
      const world = loadWorld();
      const chosen = world.choices[p4.FORK_FIRST_VISIT];
      if (!chosen) return;
      status.textContent = 'PHASE 7: 寄り道で手掛かりを集め、最後に踏み込んだ方向が最初の訪問先を決めた。';
      status.dataset.tone = 'found';
      persistenceNote.textContent = '世界の変化だけを保存した。位置・移動履歴・途中で拾った手掛かりは端末に残していない。';
    });
  }

  function renderReady() {
    document.body.dataset.phase6Navigation = 'enabled';
    navigation.hidden = false;
    phase4Actions.hidden = true;
    if (forkSummary) forkSummary.hidden = true;
    status.textContent = 'PHASE 7: 少し寄って気配を読み、必要なら引き返して別方向も確かめる。';
    status.dataset.tone = 'trace';
    persistenceNote.textContent = '探索中の位置・前回位置・拾った手掛かりはセッション内だけ。localStorageには世界状態しか残さない。';
    renderSession();
  }

  function renderInactive() {
    navigation.hidden = true;
    document.body.dataset.phase6Navigation = 'inactive';
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
      liveCheck.hidden = false;
      renderSession();
      status.textContent = '現在地を一時的な原点にした。移動後、安全な場所でだけ現在地を再確認する。';
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
