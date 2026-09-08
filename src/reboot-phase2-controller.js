(function () {
  'use strict';
  const base = window.CrownlessRebootState;
  const p2 = window.CrownlessRebootPhase2State;
  if (!base || !p2) throw new Error('Reboot Phase 2 state is required');

  const $ = (selector) => document.querySelector(selector);
  const map = $('#reboot-map');
  const storyKicker = $('#story-kicker');
  const storyTitle = $('#story-title');
  const storyCopy = $('#story-copy');
  const dialogue = $('#story-dialogue');
  const phase1Choices = $('#fate-choices');
  const phase1Continue = $('#scene-continue');
  const phase1Actions = $('.location-actions');
  const crossingContinue = $('#crossing-continue');
  const crossingChoices = $('#crossing-choices');
  const phase2Actions = $('#phase2-actions');
  const phase2Live = $('#phase2-live');
  const phase2Dev = $('#dev-walk-next');
  const status = $('#location-status');
  const persistenceNote = $('#persistence-note');
  const crossingLabel = map.querySelector('.crossing-label');
  const crossingHook = $('#map-crossing-hook');

  let state = load();
  let session = p2.createLocationSession();
  let liveStarted = false;
  let contextRevealed = false;
  let locationRequestInFlight = false;

  injectMapLayer();
  refresh();

  function load() {
    try { return p2.parseState(window.CrownlessRebootStorage.getItem(p2.STORAGE_KEY)); }
    catch (_error) { return p2.normalizeState(base.createInitialState()); }
  }

  function persist() {
    try {
      window.CrownlessRebootStorage.setItem(p2.STORAGE_KEY, p2.serializeState(state));
      persistenceNote.textContent = 'この世界の変化は、この端末に残る。位置座標や移動経路は保存しない。';
    } catch (_error) {
      persistenceNote.textContent = 'このブラウザでは永続保存が使えない。今回の変化はタブを閉じると失われる。';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[char]);
  }

  function injectMapLayer() {
    const svg = map.querySelector('svg');
    if (!svg || $('#phase2-map-layer') || map.querySelector('.crossing-phase')) return;
    svg.insertAdjacentHTML('beforeend', `
      <g id="phase2-map-layer" aria-hidden="true">
        <path class="second-consequence-line" d="M267 65 C276 55 284 46 298 37" />
        <g class="crossing-phase crossing-found">
          <path class="river" d="M237 39c9 10 4 18 14 29s5 19 17 30" />
          <path class="bridge" d="M244 68c11-11 22-11 31 0M244 68v8m31-8v8" />
          <path class="crossing-hut" d="M273 69l7-6 7 6v9h-14z" />
        </g>
        <g class="crossing-phase crossing-ash">
          <path class="river" d="M237 39c9 10 4 18 14 29s5 19 17 30" />
          <path class="broken-bridge" d="M244 68l8-5 5 7m6-1 5-7 7 6M244 68v8m31-8v8" />
          <path class="ash-smoke" d="M255 57c-7-7 5-9 0-15m8 16c-5-5 5-8 1-13" />
        </g>
        <g class="crossing-phase crossing-lantern">
          <path class="river" d="M237 39c9 10 4 18 14 29s5 19 17 30" />
          <path class="bridge" d="M244 68c11-11 22-11 31 0M244 68v8m31-8v8" />
          <circle class="lantern" cx="248" cy="65" r="2.4" /><circle class="lantern" cx="271" cy="65" r="2.4" />
        </g>
        <g class="hill-hint">
          <path class="hill-line" d="M282 45c7-12 17-17 27-9 4 3 6 7 8 12" />
          <path class="hill-flag" d="M300 35V23m1 1 10 3-10 5" />
          <path class="raven-mark" d="M288 31l3-2 3 2m6-5 3-2 3 2" />
        </g>
        <text class="map-label hill-label" x="271" y="16">黒鴉の丘</text>
        <text id="map-hill-hook" class="map-note hill-hook" x="271" y="28"></text>
      </g>`);
  }

  function updateMap() {
    const crossingState = state.placeStates[p2.OLD_CROSSING];
    const crossingChoice = state.choices[p2.OLD_CROSSING];
    map.dataset.crossingState = crossingState;
    map.dataset.crossingFate = crossingChoice === p2.CHOICES.CUT_CROSSING ? 'ash' : crossingChoice === p2.CHOICES.KEEP_CROSSING ? 'lantern' : 'none';
    map.dataset.hillState = state.placeStates[p2.BLACK_RAVEN_HILL];
    if (crossingLabel) crossingLabel.textContent = crossingState === 'ash_crossing' ? '灰の渡り' : crossingState === 'lantern_crossing' ? '灯火の渡り' : '古い渡り場';
    if (crossingChoice) {
      const outcome = p2.getCrossingOutcomePresentation(state);
      crossingHook.textContent = '';
      const hillHook = $('#map-hill-hook');
      if (hillHook) hillHook.textContent = outcome ? outcome.hillTrace : '';
    }
  }

  function takeOver() {
    phase1Actions.hidden = true;
    phase1Choices.hidden = true;
    phase1Continue.hidden = true;
  }

  function refresh() {
    state = load();
    updateMap();
    if (state.choices[p2.OLD_CROSSING]) return renderOutcome();
    if (state.placeStates[p2.OLD_CROSSING] === 'discovered') return renderArrival();
    if (state.choices[base.BELL_TOWER]) {
      takeOver();
      phase2Actions.hidden = false;
      crossingContinue.hidden = true;
      crossingChoices.hidden = true;
      return;
    }
    phase2Actions.hidden = true;
  }

  function renderArrival() {
    takeOver();
    updateMap();
    phase2Actions.hidden = true;
    const arrival = p2.getCrossingArrivalPresentation(state);
    if (!arrival) return;
    storyKicker.textContent = 'THE CONSEQUENCE REACHED HERE';
    storyTitle.textContent = arrival.title;
    storyCopy.textContent = arrival.summary;
    crossingContinue.hidden = contextRevealed;
    crossingChoices.hidden = !contextRevealed;
    dialogue.hidden = !contextRevealed;
    if (contextRevealed) setDialogue(arrival.dialogue);
    status.textContent = 'ここは新しいクエストではない。鐘なき塔で残した痕が、ここまで届いた。';
    status.dataset.tone = 'found';
  }

  function renderOutcome() {
    takeOver();
    updateMap();
    phase2Actions.hidden = true;
    crossingContinue.hidden = true;
    crossingChoices.hidden = true;
    dialogue.hidden = true;
    const outcome = p2.getCrossingOutcomePresentation(state);
    if (!outcome) return;
    storyKicker.textContent = 'SECOND OATHMARK / 二つ目の誓痕';
    storyTitle.textContent = outcome.crossingTitle;
    storyCopy.innerHTML = '<strong>' + escapeHtml(outcome.crossingSummary) + '</strong><br>' + escapeHtml(outcome.hillLead) + '<br><span class="next-hook">' + escapeHtml(outcome.hillHook) + '</span>';
    status.textContent = '「黒鴉の丘」が、二つの選択の組み合わせによって別の意味を持った。';
    status.dataset.tone = 'trace';
  }

  function setDialogue(lines) {
    dialogue.innerHTML = lines.map(([speaker, line]) => '<p><span>' + escapeHtml(speaker) + '</span>「' + escapeHtml(line) + '」</p>').join('');
  }

  function discoverByDev() {
    state = p2.simulateOldCrossingDiscovery(state);
    contextRevealed = false;
    persist();
    renderArrival();
    status.textContent = 'DEV PATH: 移動時間だけを省略した。発見stateはGPS側と共通。';
    status.dataset.tone = 'found';
  }

  function setLocationRequestBusy(busy) {
    locationRequestInFlight = busy;
    phase2Live.disabled = busy;
    phase2Live.setAttribute('aria-busy', busy ? 'true' : 'false');
    phase2Live.textContent = busy
      ? '現在地を確認しています…'
      : (liveStarted ? '安全な場所で現在地をもう一度確かめる' : 'GPSで古い渡り場へ進む');
  }

  function requestLocation() {
    if (locationRequestInFlight) return;
    window.CrownlessRebootLocation.request((position) => {
      const result = p2.observeOldCrossingLocation(session, state, position.coords);
      state = result.state;
      if (result.status === 'discovered') {
        persist();
        contextRevealed = false;
        renderArrival();
        status.textContent = '古い渡り場を発見した。鐘なき塔から続いた痕跡が、ここへ届いている。';
        status.dataset.tone = 'found';
        return;
      }
      status.textContent = result.status === 'anchored'
        ? 'ここを起点にした。安全に歩いてから、もう一度だけ現在地を確かめる。'
        : 'まだ古い渡り場には届いていない。安全に歩ける道で、立ち止まってまた確かめよう。';
      status.dataset.tone = 'quiet';
    }, (error) => {
      status.textContent = window.CrownlessRebootSession.locationErrorMessage(error);
      status.dataset.tone = 'warning';
    }, (busy) => {
      setLocationRequestBusy(busy);
      if (busy) {
        status.textContent = '現在地を確認している。安全な場所でそのまま少し待つ。';
        status.dataset.tone = 'quiet';
      }
    });
  }

  phase2Live.addEventListener('click', () => {
    if (locationRequestInFlight) return;
    if (!liveStarted) {
      liveStarted = true;
      session = p2.createLocationSession();
    }
    requestLocation();
  });
  phase2Dev.addEventListener('click', discoverByDev);
  crossingContinue.addEventListener('click', () => {
    contextRevealed = true;
    renderArrival();
  });
  crossingChoices.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-choice]');
    if (!button) return;
    try {
      state = p2.applyCrossingChoice(state, button.dataset.choice);
      persist();
      renderOutcome();
    } catch (error) {
      status.textContent = error.message;
      status.dataset.tone = 'warning';
    }
  });

  phase1Choices.addEventListener('click', () => queueMicrotask(refresh));
})();
