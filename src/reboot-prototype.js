(function () {
  'use strict';

  const api = window.CrownlessRebootState;
  if (!api) throw new Error('CrownlessRebootState is required');

  const $ = (selector) => document.querySelector(selector);
  const map = $('#reboot-map');
  const status = $('#location-status');
  const storyKicker = $('#story-kicker');
  const storyTitle = $('#story-title');
  const storyCopy = $('#story-copy');
  const dialogue = $('#story-dialogue');
  const choices = $('#fate-choices');
  const startLive = $('#start-live');
  const startSim = $('#start-sim');
  const checkLocation = $('#check-location');
  const sceneContinue = $('#scene-continue');
  const mapTowerLabel = $('#map-tower-label');
  const mapCrossingHook = $('#map-crossing-hook');
  const persistenceNote = $('#persistence-note');

  let state = loadState();
  let session = api.createLocationSession();
  let mode = null;
  let simStep = 0;
  let contextRevealed = false;

  function loadState() {
    try {
      return api.parseState(window.localStorage.getItem(api.STORAGE_KEY));
    } catch (_error) {
      return api.createInitialState();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(api.STORAGE_KEY, api.serializeState(state));
      persistenceNote.textContent = 'この世界の変化は、この端末に残る。位置座標や移動経路は保存しない。';
    } catch (_error) {
      persistenceNote.textContent = 'このブラウザでは永続保存が使えない。今回の変化はタブを閉じると失われる。';
    }
  }

  function setLocationStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone || 'quiet';
  }

  function render() {
    const towerState = state.placeStates[api.BELL_TOWER];
    const choice = state.choices[api.BELL_TOWER];
    map.dataset.towerState = towerState;
    map.dataset.outcome = choice === api.CHOICES.RING_BELL ? 'king'
      : choice === api.CHOICES.BREAK_BELL ? 'free'
        : 'none';

    if (choice) {
      renderOutcome();
      return;
    }
    if (towerState === 'discovered') {
      renderDiscovered();
      return;
    }
    renderUnknown();
  }

  function renderUnknown() {
    storyKicker.textContent = 'UNWRITTEN LAND';
    storyTitle.textContent = 'この土地には、まだ何の物語もない。';
    storyCopy.textContent = '安全に歩ける道を自分で選び、立ち止まれる場所でだけ現在地を確かめる。地図は行き先を命令しない。';
    dialogue.hidden = true;
    choices.hidden = true;
    sceneContinue.hidden = true;
    startLive.textContent = '現在地から始める';
    startSim.textContent = '模擬探索で試す';
    startLive.hidden = mode !== null;
    startSim.hidden = mode !== null;
    checkLocation.hidden = mode === null;
    mapTowerLabel.textContent = '名のない気配';
    mapCrossingHook.textContent = '';
    document.body.dataset.phase = 'unknown';
  }

  function renderDiscovered() {
    document.body.dataset.phase = 'discovered';
    startLive.hidden = true;
    startSim.hidden = true;
    checkLocation.hidden = true;
    sceneContinue.hidden = contextRevealed;
    storyKicker.textContent = 'A PLACE REMEMBERED';
    storyTitle.textContent = '鐘なき塔';
    storyCopy.textContent = '崩れた塔。切れた鐘縄。小さな焚き火。追われてきた旅人たちが、古い鐘の下で息を潜めている。';
    mapTowerLabel.textContent = '鐘なき塔';
    dialogue.hidden = !contextRevealed;
    choices.hidden = !contextRevealed;
    if (!contextRevealed) sceneContinue.textContent = '旅人たちの話を聞く';
  }

  function revealContext() {
    contextRevealed = true;
    dialogue.hidden = false;
    choices.hidden = false;
    sceneContinue.hidden = true;
    storyCopy.textContent = '鐘を鳴らせば助けが来る。だが、その音はこの場所の未来まで呼び寄せる。';
  }

  function renderOutcome() {
    const outcome = api.getOutcomePresentation(state);
    if (!outcome) return;
    document.body.dataset.phase = 'consequence';
    contextRevealed = true;
    const needsLocationRestart = mode === null;
    startLive.hidden = !needsLocationRestart;
    startSim.hidden = !needsLocationRestart;
    startLive.textContent = '現在地から続きを歩く';
    startSim.textContent = '模擬位置で続きを見る';
    checkLocation.hidden = needsLocationRestart;
    checkLocation.textContent = mode === 'simulated' ? '模擬位置を確かめる' : '安全な場所で現在地を確かめる';
    sceneContinue.hidden = true;
    dialogue.hidden = true;
    choices.hidden = true;
    storyKicker.textContent = 'OATHMARK / 誓痕';
    storyTitle.textContent = outcome.towerTitle;
    storyCopy.innerHTML = '<strong>' + escapeHtml(outcome.towerSummary) + '</strong><br>'
      + escapeHtml(outcome.consequenceLead) + '<br><span class="next-hook">' + escapeHtml(outcome.consequenceHook) + '</span>';
    mapTowerLabel.textContent = outcome.towerTitle;
    mapCrossingHook.textContent = outcome.outcome === 'king' ? '狼煙' : '途絶えた足跡';
    setLocationStatus('霧の向こうに「古い渡り場」の輪郭だけが浮かんだ。行くかどうかは、あなたが決める。', 'trace');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function handlePosition(coords) {
    const result = api.observeDiscoveryLocation(session, state, coords);
    state = result.state;
    map.dataset.proximity = result.proximity;

    if (result.status === 'anchored') {
      setLocationStatus(state.choices[api.BELL_TOWER]
        ? 'ここから先の歩みだけを一時的に見る。安全な道を選び、立ち止まってまた確かめよう。'
        : 'ここを起点として刻んだ。画面を閉じ、安全に歩ける道へ進もう。', 'quiet');
      checkLocation.hidden = false;
      return;
    }
    if (result.status === 'discovered') {
      persist();
      contextRevealed = false;
      setLocationStatus('墨の霧がほどけた。ひとつの場所が名を持った。', 'found');
      render();
      return;
    }
    if (result.status === 'already_discovered') {
      setLocationStatus(state.choices[api.BELL_TOWER]
        ? '歩いた分だけ霧の縁が開く。渡り場はまだ、出来事の気配としてだけ見える。'
        : '鐘なき塔は、もう地図から消えない。', 'trace');
      return;
    }
    const message = result.proximity === 'near'
      ? '風の中に、金属がかすかに鳴る。'
      : result.proximity === 'edge'
        ? '白い地図に、黒い線が増え始めた。'
        : 'まだ何も名を持たない。もう少し歩いてから、また確かめよう。';
    setLocationStatus(message, 'quiet');
  }

  function requestLiveLocation() {
    if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
      setLocationStatus('この端末では現在地を取得できない。模擬探索を使って体験を確認できる。', 'warning');
      return;
    }
    setLocationStatus('現在地を一度だけ確かめている…', 'quiet');
    navigator.geolocation.getCurrentPosition(
      (position) => handlePosition(position.coords),
      (error) => setLocationStatus(locationErrorMessage(error), 'warning'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 15000 }
    );
  }

  function locationErrorMessage(error) {
    if (error && error.code === 1) return '位置情報が許可されていない。許可を変えなくても、模擬探索で試せる。';
    if (error && error.code === 3) return '現在地を確認できなかった。安全な場所で、もう一度試せる。';
    return '現在地を確認できなかった。移動を続ける必要はない。';
  }

  function startLiveMode() {
    mode = 'live';
    session = api.createLocationSession();
    startLive.hidden = true;
    startSim.hidden = true;
    checkLocation.textContent = '安全な場所で現在地を確かめる';
    requestLiveLocation();
  }

  function simulatedCoordinates() {
    const origin = { latitude: 35.0, longitude: 139.0 };
    if (simStep === 0) return origin;
    if (simStep === 1) return { latitude: 35.00022, longitude: 139.0 };
    return { latitude: 35.00062, longitude: 139.0 };
  }

  function startSimulatedMode() {
    mode = 'simulated';
    simStep = 0;
    session = api.createLocationSession();
    startLive.hidden = true;
    startSim.hidden = true;
    checkLocation.textContent = '模擬位置を確かめる';
    handlePosition(simulatedCoordinates());
    simStep += 1;
  }

  function checkCurrentLocation() {
    if (mode === 'simulated') {
      handlePosition(simulatedCoordinates());
      simStep += 1;
      return;
    }
    if (mode === 'live') {
      requestLiveLocation();
      return;
    }
    setLocationStatus('位置セッションを再開してから、安全な場所で確かめる。', 'quiet');
  }

  startLive.addEventListener('click', startLiveMode);
  startSim.addEventListener('click', startSimulatedMode);
  checkLocation.addEventListener('click', checkCurrentLocation);
  sceneContinue.addEventListener('click', revealContext);
  choices.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-choice]');
    if (!button) return;
    try {
      state = api.applyBellChoice(state, button.dataset.choice);
      persist();
      render();
    } catch (error) {
      setLocationStatus(error.message, 'warning');
    }
  });

  render();
})();
