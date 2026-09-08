(function () {
  'use strict';
  const p3 = window.CrownlessRebootPhase3State;
  const p4 = window.CrownlessRebootPhase4State;
  if (!p3 || !p4) throw new Error('Reboot Phase 4 state is required');

  const $ = (selector) => document.querySelector(selector);
  const map = $('#reboot-map');
  const storyKicker = $('#story-kicker');
  const storyTitle = $('#story-title');
  const storyCopy = $('#story-copy');
  const dialogue = $('#story-dialogue');
  const status = $('#location-status');
  const persistenceNote = $('#persistence-note');
  const forkSummary = $('#fork-summary');
  const forkQuestion = $('.fork-question');
  const chapelState = $('#chapel-state');
  const gateState = $('#gate-state');
  const chapelHook = $('#chapel-hook');
  const gateHook = $('#gate-hook');
  const phase4Actions = $('#phase4-actions');
  const hillChoices = $('#hill-choices');

  let state = load();

  injectMapLayer();
  refresh();

  function load() {
    try { return p4.parseState(window.CrownlessRebootStorage.getItem(p4.STORAGE_KEY)); }
    catch (_error) { return p4.normalizeState({}); }
  }

  function persist() {
    try {
      window.CrownlessRebootStorage.setItem(p4.STORAGE_KEY, p4.serializeState(state));
      persistenceNote.textContent = '訪れた場所と、訪れなかった場所の変化だけを残す。位置座標や移動経路は保存しない。';
    } catch (_error) {
      persistenceNote.textContent = 'このブラウザでは永続保存が使えない。今回の変化はタブを閉じると失われる。';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  function injectMapLayer() {
    const svg = map && map.querySelector('svg');
    if (!svg || $('#phase4-map-layer')) return;
    svg.insertAdjacentHTML('beforeend', `
      <g id="phase4-map-layer" aria-hidden="true">
        <path class="phase4-visit-route visit-chapel" d="M299 34C294 62 285 93 270 128" />
        <path class="phase4-visit-route visit-gate" d="M296 31C270 18 240 16 205 27" />

        <g class="phase4-mark chapel-visited">
          <circle cx="269" cy="139" r="17" />
          <path d="M257 158l24-38" />
        </g>
        <g class="phase4-mark chapel-sealed">
          <path d="M258 135l22 16m0-16-22 16" />
        </g>
        <g class="phase4-mark chapel-crowded">
          <circle cx="254" cy="153" r="2" /><circle cx="260" cy="156" r="2" /><circle cx="266" cy="154" r="2" />
        </g>

        <g class="phase4-mark gate-visited">
          <circle cx="205" cy="31" r="18" />
          <path d="M188 49l34-35" />
        </g>
        <g class="phase4-mark gate-barricaded">
          <path d="M186 24l37 15m-36 1 35-17" />
        </g>
        <g class="phase4-mark gate-passed">
          <ellipse cx="223" cy="45" rx="1.7" ry="3" /><ellipse cx="229" cy="48" rx="1.7" ry="3" /><ellipse cx="235" cy="51" rx="1.7" ry="3" />
        </g>
      </g>`);
  }

  function updateMap() {
    if (!map) return;
    map.dataset.chapelState = state.placeStates[p4.SALT_CHAPEL] || 'unknown';
    map.dataset.gateState = state.placeStates[p4.RUINED_GATE] || 'unknown';
    map.dataset.firstVisit = state.choices[p4.FORK_FIRST_VISIT] || 'none';

    const presentation = p4.getFirstVisitPresentation(state);
    if (!presentation) return;
    const chapel = presentation.visited.id === p4.SALT_CHAPEL ? presentation.visited : presentation.unvisited;
    const gate = presentation.visited.id === p4.RUINED_GATE ? presentation.visited : presentation.unvisited;
    const mapChapelHook = $('#map-chapel-hook');
    const mapGateHook = $('#map-gate-hook');
    if (mapChapelHook) mapChapelHook.textContent = chapel.mark;
    if (mapGateHook) mapGateHook.textContent = gate.mark;
  }

  function renderReady() {
    updateMap();
    phase4Actions.hidden = false;
    if (forkSummary) forkSummary.hidden = false;
    const hillOutcome = p3.getHillOutcomePresentation(state);
    if (hillOutcome) {
      const chapelButton = phase4Actions.querySelector('[data-place="salt_chapel"] small');
      const gateButton = phase4Actions.querySelector('[data-place="ruined_gate"] small');
      if (chapelButton) chapelButton.textContent = `${hillOutcome.chapel.mark} — ${hillOutcome.chapel.hook}`;
      if (gateButton) gateButton.textContent = `${hillOutcome.gate.mark} — ${hillOutcome.gate.hook}`;
    }
    if (forkQuestion) forkQuestion.textContent = '次の判断はボタンの中ではなく、どちらへ向かうかそのもの。開発中は移動時間だけDEVで省略する。';
    status.textContent = 'PHASE 4: どちらへ先に行くかを選ぶ。向かわなかった場所も、その間に変化する。';
    status.dataset.tone = 'trace';
  }

  function renderResult() {
    updateMap();
    phase4Actions.hidden = true;
    dialogue.hidden = true;
    if (forkSummary) forkSummary.hidden = false;
    const presentation = p4.getFirstVisitPresentation(state);
    if (!presentation) return;

    storyKicker.textContent = 'YOU CHOSE BY GOING / 行き先が決断になった';
    storyTitle.textContent = presentation.visited.title;
    storyCopy.innerHTML = '<strong>' + escapeHtml(presentation.visited.text) + '</strong><br><span class="next-hook">'
      + escapeHtml(presentation.unvisited.text) + '</span>';

    const chapel = presentation.visited.id === p4.SALT_CHAPEL ? presentation.visited : presentation.unvisited;
    const gate = presentation.visited.id === p4.RUINED_GATE ? presentation.visited : presentation.unvisited;
    chapelState.textContent = chapel.mark;
    gateState.textContent = gate.mark;
    chapelHook.textContent = chapel.text;
    gateHook.textContent = gate.text;
    if (forkQuestion) forkQuestion.textContent = 'あなたが見た場所だけでなく、見に行かなかった場所にも時間が流れた。';

    status.textContent = `DEV PATH: ${presentation.visited.title}へ向かった。その選択と同時に${presentation.unvisited.title}も別の状態へ進んだ。`;
    status.dataset.tone = 'found';
  }

  function refresh() {
    state = load();
    updateMap();
    if (!state.choices[p3.BLACK_RAVEN_HILL]) {
      phase4Actions.hidden = true;
      return;
    }
    if (state.choices[p4.FORK_FIRST_VISIT]) return renderResult();
    renderReady();
  }

  phase4Actions.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-place]');
    if (!button) return;
    try {
      state = p4.discoverForkPlace(state, button.dataset.place);
      persist();
      renderResult();
    } catch (error) {
      status.textContent = error.message;
      status.dataset.tone = 'warning';
    }
  });

  if (hillChoices) hillChoices.addEventListener('click', () => queueMicrotask(refresh));
})();
