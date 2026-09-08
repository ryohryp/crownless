(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const p2 = window.CrownlessRebootPhase2State;
  const p3 = window.CrownlessRebootPhase3State;
  if (!base || !p2 || !p3) throw new Error('Reboot Phase 3 state is required');

  const $ = (selector) => document.querySelector(selector);
  const map = $('#reboot-map');
  const storyKicker = $('#story-kicker');
  const storyTitle = $('#story-title');
  const storyCopy = $('#story-copy');
  const dialogue = $('#story-dialogue');
  const status = $('#location-status');
  const persistenceNote = $('#persistence-note');
  const phase2Actions = $('#phase2-actions');
  const crossingContinue = $('#crossing-continue');
  const crossingChoices = $('#crossing-choices');
  const phase3Actions = $('#phase3-actions');
  const phase3Live = $('#phase3-live');
  const phase3Dev = $('#dev-walk-hill');
  const hillContinue = $('#hill-continue');
  const hillChoices = $('#hill-choices');
  const forkSummary = $('#fork-summary');
  const chapelHook = $('#chapel-hook');
  const gateHook = $('#gate-hook');
  const chapelState = $('#chapel-state');
  const gateState = $('#gate-state');

  let state = load();
  let session = p3.createLocationSession();
  let liveStarted = false;
  let contextRevealed = false;

  injectMapLayer();
  refresh();

  function load() {
    try { return p3.parseState(window.CrownlessRebootStorage.getItem(p3.STORAGE_KEY)); }
    catch (_error) { return p3.normalizeState(base.createInitialState()); }
  }

  function persist() {
    try {
      window.CrownlessRebootStorage.setItem(p3.STORAGE_KEY, p3.serializeState(state));
      persistenceNote.textContent = '三つの選択と世界の変化だけを、この端末に残す。位置座標や移動経路は保存しない。';
    } catch (_error) {
      persistenceNote.textContent = 'このブラウザでは永続保存が使えない。今回の変化はタブを閉じると失われる。';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  function injectMapLayer() {
    const svg = map.querySelector('svg');
    if (!svg || $('#phase3-map-layer')) return;
    svg.insertAdjacentHTML('beforeend', `
      <g id="phase3-map-layer" aria-hidden="true">
        <g class="hill-phase hill-discovered">
          <path class="hill-ground" d="M282 45c7-12 17-17 27-9 4 3 6 7 8 12" />
          <path class="signal-mast" d="M300 37V20m-5 9h10m-8-5 6 5-6 5" />
          <path class="raven-pair" d="M286 29l3-2 3 2m14-7 3-2 3 2" />
        </g>
        <g class="hill-phase hill-valley-watch">
          <path class="hill-ground" d="M282 45c7-12 17-17 27-9 4 3 6 7 8 12" />
          <path class="signal-mast" d="M300 37V20m-5 9h10" />
          <path class="signal-flame" d="M294 22c-5-5 3-8 0-13 7 4 3 8 7 12" />
          <path class="signal-arrow valley" d="M296 25C277 46 270 78 270 116" />
        </g>
        <g class="hill-phase hill-road-watch">
          <path class="hill-ground" d="M282 45c7-12 17-17 27-9 4 3 6 7 8 12" />
          <path class="signal-mast" d="M300 37V20m-5 9h10" />
          <path class="signal-flame" d="M294 22c-5-5 3-8 0-13 7 4 3 8 7 12" />
          <path class="signal-arrow road" d="M294 26C270 14 240 14 207 22" />
        </g>

        <path class="fork-line fork-chapel" d="M299 34C294 62 285 93 270 128" />
        <path class="fork-line fork-gate" d="M296 31C270 18 240 16 205 27" />

        <g class="next-place chapel-mark">
          <path class="chapel-roof" d="M256 137l13-10 13 10" />
          <path class="chapel-body" d="M259 136v15h20v-15" />
          <path class="chapel-cross" d="M269 121v8m-4-4h8" />
          <path class="warning-shutter chapel-warning" d="M262 140h5m4 0h5m-14 4h5m4 0h5" />
          <path class="open-door chapel-exposed" d="M267 151v-9h5v9" />
        </g>
        <text class="map-label chapel-label" x="239" y="163">塩の礼拝堂</text>
        <text id="map-chapel-hook" class="map-note chapel-note" x="239" y="174"></text>

        <g class="next-place gate-mark">
          <path class="gate-wall" d="M190 39v-16h30v16m-25 0v-9c0-7 10-7 10 0v9" />
          <path class="gate-block gate-warning" d="M187 36l36-8m-34 3 31 8" />
          <path class="gate-open gate-exposed" d="M195 39v-9c0-7 10-7 10 0v9" />
        </g>
        <text class="map-label gate-label" x="174" y="51">朽ちた関門</text>
        <text id="map-gate-hook" class="map-note gate-note" x="174" y="61"></text>
      </g>`);
  }

  function updateMap() {
    const hillState = state.placeStates[p3.BLACK_RAVEN_HILL];
    map.dataset.hillState = hillState;
    map.dataset.chapelState = state.placeStates[p3.SALT_CHAPEL];
    map.dataset.gateState = state.placeStates[p3.RUINED_GATE];
    const hillLabel = map.querySelector('.hill-label');
    if (hillLabel) {
      hillLabel.textContent = hillState === 'valley_watch' ? '谷見の丘' : hillState === 'road_watch' ? '道見の丘' : '黒鴉の丘';
    }
    const outcome = p3.getHillOutcomePresentation(state);
    if (outcome) {
      const mapChapelHook = $('#map-chapel-hook');
      const mapGateHook = $('#map-gate-hook');
      if (mapChapelHook) mapChapelHook.textContent = outcome.chapel.mark;
      if (mapGateHook) mapGateHook.textContent = outcome.gate.mark;
    }
  }

  function takeOver() {
    phase2Actions.hidden = true;
    crossingContinue.hidden = true;
    crossingChoices.hidden = true;
  }

  function hidePhase3Decision() {
    hillContinue.hidden = true;
    hillChoices.hidden = true;
  }

  function refresh() {
    state = load();
    updateMap();
    if (!state.choices[p2.OLD_CROSSING]) {
      phase3Actions.hidden = true;
      hidePhase3Decision();
      forkSummary.hidden = true;
      return;
    }
    takeOver();
    if (state.choices[p3.BLACK_RAVEN_HILL]) return renderOutcome();
    if (state.placeStates[p3.BLACK_RAVEN_HILL] === 'discovered') return renderArrival();
    if (state.placeStates[p3.BLACK_RAVEN_HILL] === 'hinted') {
      phase3Actions.hidden = false;
      hidePhase3Decision();
      forkSummary.hidden = true;
    }
  }

  function renderArrival() {
    takeOver();
    updateMap();
    phase3Actions.hidden = true;
    forkSummary.hidden = true;
    const arrival = p3.getHillArrivalPresentation(state);
    if (!arrival) return;
    storyKicker.textContent = 'TWO OLD CHOICES ARRIVE HERE';
    storyTitle.textContent = arrival.title;
    storyCopy.innerHTML = escapeHtml(arrival.summary) + '<br><span class="next-hook">' + escapeHtml(arrival.pressure) + '</span>';
    hillContinue.hidden = contextRevealed;
    hillChoices.hidden = !contextRevealed;
    dialogue.hidden = !contextRevealed;
    if (contextRevealed) {
      dialogue.innerHTML = '<p><span>丘の信号台</span>「残った薪で送れる合図は、一方向だけだ。」</p>'
        + '<p><span>遠景</span>「谷には塩の礼拝堂。街道には朽ちた関門が見える。」</p>';
    }
    status.textContent = 'ここで見えている状況は、鐘なき塔と古い渡り場の両方の選択から来ている。';
    status.dataset.tone = 'found';
  }

  function renderOutcome() {
    takeOver();
    updateMap();
    phase3Actions.hidden = true;
    hidePhase3Decision();
    dialogue.hidden = true;
    const outcome = p3.getHillOutcomePresentation(state);
    if (!outcome) return;
    storyKicker.textContent = 'THE WORLD FORKS / 世界が二つへ伸びる';
    storyTitle.textContent = outcome.hillTitle;
    storyCopy.innerHTML = '<strong>' + escapeHtml(outcome.hillSummary) + '</strong><br>'
      + '一つの合図で、二つの場所が別々の状態になった。どちらもまだ未発見だ。';
    chapelState.textContent = outcome.chapel.mark;
    gateState.textContent = outcome.gate.mark;
    chapelHook.textContent = outcome.chapel.hook;
    gateHook.textContent = outcome.gate.hook;
    forkSummary.hidden = false;
    status.textContent = '次の地点は一つに決められていない。警戒した場所を見るか、無警戒の場所を先に確かめるかはあなたが選べる。';
    status.dataset.tone = 'trace';
  }

  function discoverByDev() {
    state = p3.simulateBlackRavenHillDiscovery(state);
    contextRevealed = false;
    persist();
    renderArrival();
    status.textContent = 'DEV PATH: 移動時間だけを省略した。黒鴉の丘の発見stateはGPS側と共通。';
    status.dataset.tone = 'found';
  }

  function requestLocation() {
    window.CrownlessRebootLocation.request((position) => {
      const result = p3.observeBlackRavenHillLocation(session, state, position.coords);
      state = result.state;
      if (result.status === 'discovered') {
        persist();
        contextRevealed = false;
        return renderArrival();
      }
      status.textContent = result.status === 'anchored'
        ? 'ここを起点にした。安全に歩いてから、もう一度だけ現在地を確かめる。'
        : 'まだ丘には届いていない。安全な道を選び、立ち止まってまた確かめよう。';
      status.dataset.tone = 'quiet';
    }, (error) => {
      status.textContent = window.CrownlessRebootSession.locationErrorMessage(error);
      status.dataset.tone = 'warning';
    }, (busy) => {
      phase3Live.disabled = busy;
      phase3Live.setAttribute('aria-busy', String(busy));
      phase3Live.textContent = busy ? '現在地を確認しています…' : '安全な場所で現在地をもう一度確かめる';
      if (busy) status.textContent = '安全に立ち止まった現在地を確認している…';
    });
  }

  phase3Live.addEventListener('click', () => {
    if (!liveStarted) {
      liveStarted = true;
      session = p3.createLocationSession();
    }
    requestLocation();
  });
  phase3Dev.addEventListener('click', discoverByDev);
  hillContinue.addEventListener('click', () => {
    contextRevealed = true;
    renderArrival();
  });
  hillChoices.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-choice]');
    if (!button) return;
    try {
      state = p3.applyHillChoice(state, button.dataset.choice);
      persist();
      renderOutcome();
    } catch (error) {
      status.textContent = error.message;
      status.dataset.tone = 'warning';
    }
  });

  crossingChoices.addEventListener('click', () => queueMicrotask(refresh));
})();
