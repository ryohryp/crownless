(function () {
  'use strict';
  const p4 = window.CrownlessRebootPhase4State;
  const p5 = window.CrownlessRebootPhase5State;
  if (!p4 || !p5) throw new Error('Reboot Phase 5 state is required');

  const $ = (selector) => document.querySelector(selector);
  const map = $('#reboot-map');
  const storyKicker = $('#story-kicker');
  const storyTitle = $('#story-title');
  const storyCopy = $('#story-copy');
  const dialogue = $('#story-dialogue');
  const status = $('#location-status');
  const persistenceNote = $('#persistence-note');
  const phase4Actions = $('#phase4-actions');
  const collisionSummary = $('#collision-summary');
  const collisionTitle = $('#collision-title');
  const collisionCopy = $('#collision-copy');
  const collisionMark = $('#collision-mark');
  const collisionAction = $('#dev-walk-collision');
  const collisionLive = $('#collision-live');

  let state = load();
  const session = p5.createLocationSession();

  injectMapLayer();
  refresh();

  function load() {
    try { return p5.parseState(window.CrownlessRebootStorage.getItem(p5.STORAGE_KEY)); }
    catch (_error) { return p5.normalizeState({}); }
  }

  function persist() {
    try {
      window.CrownlessRebootStorage.setItem(p5.STORAGE_KEY, p5.serializeState(state));
      persistenceNote.textContent = '分岐した場所と、その結果が合流して生まれた場所だけを残す。位置座標や移動経路は保存しない。';
    } catch (_error) {
      persistenceNote.textContent = 'このブラウザでは永続保存が使えない。今回の変化はタブを閉じると失われる。';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' })[char]);
  }

  function injectMapLayer() {
    const svg = map && map.querySelector('svg');
    if (!svg || $('#phase5-map-layer')) return;
    svg.insertAdjacentHTML('beforeend', `
      <g id="phase5-map-layer" aria-hidden="true">
        <path class="collision-line collision-from-chapel" d="M269 139C248 148 220 153 188 150" />
        <path class="collision-line collision-from-gate" d="M205 31C191 66 185 111 188 150" />

        <g class="collision-mark collision-hint-mark">
          <circle cx="188" cy="150" r="7" />
          <path d="M180 150h16m-8-8v16" />
        </g>

        <g class="collision-mark collision-black-cargo">
          <path d="M175 154h11v-9h-11zm12 0h12v-7h-12z" />
          <path d="M178 145l5-5 5 5m1 2 5-6 5 6" />
          <path d="M176 157c8 3 17 3 25 0" />
        </g>

        <g class="collision-mark collision-dead-end">
          <path d="M174 153h20l5-6h7" />
          <circle cx="179" cy="156" r="3" /><circle cx="193" cy="156" r="3" />
          <path d="M171 143l35 12m-35 0 35-12" />
        </g>

        <g class="collision-mark collision-canvas">
          <path d="M171 155l10-13 10 13m-16 0 12-16 13 16" />
          <path d="M181 142v13m6-16v16" />
        </g>

        <g class="collision-mark collision-salt-lantern">
          <path d="M176 155h10v-9h-10zm13 0h10v-9h-10z" />
          <path d="M184 143v-8m-4 4h8" />
          <path d="M181 135c-3-4 2-6 1-10 5 3 2 6 5 9" />
          <path d="M194 143v-8m-4 4h8" />
        </g>

        <text id="map-collision-label" class="map-label collision-label" x="153" y="171">痕跡の合流</text>
      </g>`);
  }

  function updateMap() {
    if (!map) return;
    const collisionState = state.placeStates[p5.COLLISION_PLACE] || 'unknown';
    map.dataset.collisionState = collisionState;
    map.dataset.firstVisit = state.choices[p4.FORK_FIRST_VISIT] || 'none';
    const label = $('#map-collision-label');
    if (!label) return;
    const presentation = p5.getCollisionPresentation(state);
    label.textContent = presentation ? presentation.title : '痕跡の合流';
  }

  function renderHidden() {
    updateMap();
    if (collisionSummary) collisionSummary.hidden = true;
  }

  function renderHint() {
    updateMap();
    if (!collisionSummary) return;
    const hint = p5.getCollisionHintPresentation(state);
    if (!hint) return renderHidden();
    collisionSummary.hidden = false;
    collisionSummary.dataset.state = 'hinted';
    collisionTitle.textContent = hint.title;
    collisionCopy.textContent = hint.summary;
    collisionMark.textContent = '未発見';
    collisionAction.hidden = false;
    collisionLive.hidden = false;
    status.textContent = 'PHASE 5: 礼拝堂と関門の二つの変化から、同じ場所へ向かう痕跡が生まれた。';
    status.dataset.tone = 'trace';
  }

  function renderResult() {
    updateMap();
    const presentation = p5.getCollisionPresentation(state);
    if (!presentation) return;
    if (collisionSummary) {
      collisionSummary.hidden = false;
      collisionSummary.dataset.state = 'discovered';
    }
    collisionAction.hidden = true;
    collisionLive.hidden = true;
    collisionTitle.textContent = presentation.title;
    collisionCopy.innerHTML = escapeHtml(presentation.summary) + '<br><span class="collision-history">' + escapeHtml(presentation.history) + '</span>';
    collisionMark.textContent = presentation.mark;

    storyKicker.textContent = 'CONSEQUENCES COLLIDE / 二つの結果が一つの場所になる';
    storyTitle.textContent = presentation.title;
    storyCopy.innerHTML = '<strong>' + escapeHtml(presentation.summary) + '</strong><br><span class="next-hook">'
      + escapeHtml(presentation.history) + '</span>';
    if (dialogue) dialogue.hidden = true;

    status.textContent = `二つの因果が合流し、同じ裂け道が「${presentation.title}」になった。`;
    status.dataset.tone = 'found';
  }

  function refresh() {
    state = load();
    updateMap();
    if (!state.choices[p4.FORK_FIRST_VISIT]) return renderHidden();
    if (state.placeStates[p5.COLLISION_PLACE] === 'hinted') return renderHint();
    return renderResult();
  }

  collisionAction.addEventListener('click', () => {
    try {
      state = p5.discoverCollisionPlace(state);
      persist();
      renderResult();
    } catch (error) {
      status.textContent = error.message;
      status.dataset.tone = 'warning';
    }
  });

  if (phase4Actions) phase4Actions.addEventListener('click', () => queueMicrotask(refresh));
  collisionLive.addEventListener('click', () => {
    window.CrownlessRebootLocation.request((position) => {
      state = load();
      const result = p5.observeCollisionLocation(session, state, position.coords);
      state = result.state;
      if (result.status === 'discovered' || result.status === 'already_discovered') {
        persist();
        renderResult();
        document.dispatchEvent(new Event('reboot-chapter-arrived'));
        return;
      }
      status.textContent = result.status === 'anchored'
        ? 'ここから二つの痕跡をたどる。安全に歩ける方向へ進み、立ち止まってまた確かめよう。'
        : 'まだ合流地点には届いていない。安全に歩ける道で、もう一度確かめよう。';
      status.dataset.tone = 'trace';
    }, (error) => {
      status.textContent = window.CrownlessRebootSession.locationErrorMessage(error);
      status.dataset.tone = 'warning';
    }, (busy) => {
      collisionLive.disabled = busy;
      collisionLive.setAttribute('aria-busy', String(busy));
      collisionLive.textContent = busy ? '現在地を確認しています…' : '安全な場所で現在地を確かめる';
      if (busy) status.textContent = '二つの痕跡の先で、現在地を一度だけ確かめている…';
    });
  });
})();
