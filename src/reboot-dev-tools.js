(function (root, factory) {
  const api = factory(
    root && root.CrownlessRebootState,
    root && root.CrownlessRebootPhase2State,
    root && root.CrownlessRebootPhase3State,
    root && root.CrownlessRebootPhase4State,
    root && root.CrownlessRebootPhase5State
  );
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./reboot-prototype-state.js'),
      require('./reboot-phase2-state.js'),
      require('./reboot-phase3-state.js'),
      require('./reboot-phase4-state.js'),
      require('./reboot-phase5-state.js')
    );
  }
  if (root) {
    root.CrownlessRebootCompletion = api;
    if (root.document) api.mount(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (base, p2, p3, p4, p5) {
  'use strict';
  if (!base || !p2 || !p3 || !p4 || !p5) throw new Error('Reboot completion requires Phase 1-5 state models');

  const MAX_ACCEPTABLE_ACCURACY_METERS = 120;
  const ENDINGS = Object.freeze({
    [p5.OUTCOME_KEYS.BLACK_CARGO]: Object.freeze({
      title: '終幕・黒荷の夜',
      lead: '守られた祈りの場所と、抜けられた街道。その隙間に、名を隠した荷と人が根を張った。'
    }),
    [p5.OUTCOME_KEYS.DEAD_END]: Object.freeze({
      title: '終幕・行き止まりの朝',
      lead: '混乱した避難所と、閉じられた街道。行き場を失った者たちは、裂け道を新しい生活の場所に変えた。'
    }),
    [p5.OUTCOME_KEYS.CANVAS]: Object.freeze({
      title: '終幕・布屋根の街',
      lead: '備えられた関門の外で、あふれた人々が自分たちの屋根を張った。あなたの合図は町の形になった。'
    }),
    [p5.OUTCOME_KEYS.SALT_LANTERN]: Object.freeze({
      title: '終幕・塩灯の道',
      lead: '閉じた礼拝堂と開いた街道の間で、戻された物資と通り抜けた者たちが小さな灯りをつないだ。'
    })
  });

  function createResilientStorage(nativeStorage, onStatus) {
    const memory = new Map();
    let persistent = true;
    const report = (ok, reason) => {
      persistent = Boolean(ok);
      if (typeof onStatus === 'function') onStatus({ persistent, reason: reason || null });
    };
    const nativeCall = (name, args, fallback) => {
      if (!nativeStorage || typeof nativeStorage[name] !== 'function') {
        report(false, 'unavailable');
        return fallback;
      }
      try { return nativeStorage[name](...args); }
      catch (_error) { report(false, 'write_denied'); return fallback; }
    };
    return Object.freeze({
      get length() { return memory.size; },
      key(index) { return [...memory.keys()][Number(index)] || null; },
      getItem(key) {
        const id = String(key);
        if (memory.has(id)) return memory.get(id);
        const value = nativeCall('getItem', [id], null);
        if (value !== null && value !== undefined) memory.set(id, String(value));
        return value === null || value === undefined ? null : String(value);
      },
      setItem(key, value) {
        const id = String(key);
        const text = String(value);
        memory.set(id, text);
        nativeCall('setItem', [id, text], undefined);
      },
      removeItem(key) {
        const id = String(key);
        if (!nativeStorage || typeof nativeStorage.removeItem !== 'function') {
          report(false, 'unavailable');
          return false;
        }
        try {
          nativeStorage.removeItem(id);
          memory.delete(id);
          return true;
        } catch (_error) {
          report(false, 'write_denied');
          return false;
        }
      },
      clear() {
        memory.clear();
        nativeCall('clear', [], undefined);
      },
      isPersistent() { return persistent; }
    });
  }

  function createLocationRequestGate() {
    let generation = 0;
    let pending = false;
    return Object.freeze({
      begin() {
        if (pending) return null;
        pending = true;
        generation += 1;
        return generation;
      },
      settle(token) {
        if (token !== generation) return false;
        pending = false;
        return true;
      },
      invalidate() {
        generation += 1;
        pending = false;
      },
      isCurrent(token) { return token === generation; },
      isPending() { return pending; }
    });
  }

  function accuracyStatus(position) {
    const accuracy = Number(position && position.coords && position.coords.accuracy);
    if (!Number.isFinite(accuracy)) return 'unknown';
    return accuracy > MAX_ACCEPTABLE_ACCURACY_METERS ? 'insufficient' : 'acceptable';
  }

  function locationErrorMessage(error) {
    const accuracy = Number(error && error.accuracy);
    if (Number.isFinite(accuracy)) {
      return `位置情報の精度が不足している（約${Math.round(accuracy)}m）。安全な場所で再試行するか、模擬探索へ切り替えられる。`;
    }
    if (error && error.code === 1) {
      return '位置情報が許可されていない。端末またはブラウザの設定を確認して再試行するか、模擬探索へ切り替えられる。';
    }
    if (error && error.code === 2) {
      return '現在地を取得できない。安全な場所で少し待って再試行するか、模擬探索へ切り替えられる。';
    }
    if (error && error.code === 3) {
      return '現在地の確認が時間切れになった。安全な場所で再試行するか、模擬探索へ切り替えられる。';
    }
    return '現在地を確認できなかった。安全な場所で再試行するか、模擬探索へ切り替えられる。';
  }

  function normalizeCollisionSession(session) {
    return session && typeof session === 'object' ? session : { anchor: null, lastReading: null };
  }

  function observeCollisionLocation(inputSession, inputState, coords) {
    const session = normalizeCollisionSession(inputSession);
    const state = p5.normalizeState(inputState);
    if (state.placeStates[p5.COLLISION_PLACE] !== 'hinted') return { state, status: 'settled', proximity: 'settled' };
    const reading = { latitude: Number(coords && coords.latitude), longitude: Number(coords && coords.longitude) };
    if (!Number.isFinite(reading.latitude) || !Number.isFinite(reading.longitude)) throw new Error('valid coordinates are required');
    session.lastReading = reading;
    if (!session.anchor) {
      session.anchor = reading;
      return { state, status: 'anchored', proximity: 'origin' };
    }
    const distance = base.haversineMeters(session.anchor, reading);
    if (distance >= base.DISCOVERY_RADIUS_METERS) {
      return { state: p5.discoverCollisionPlace(state), status: 'discovered', proximity: 'discovered' };
    }
    return { state, status: 'searching', proximity: distance >= 35 ? 'near' : distance >= 15 ? 'edge' : 'origin' };
  }

  function placeMemory(state, id, title, text, statusLabel) {
    return Object.freeze({ id, title, text, state: state.placeStates[id] || 'unknown', statusLabel: statusLabel || '' });
  }

  function buildCompletion(inputState) {
    const state = p5.normalizeState(inputState);
    const collision = p5.getCollisionPresentation(state);
    if (!collision) return null;
    const ending = ENDINGS[collision.collisionKey];
    if (!ending) return null;
    const bell = state.choices[base.BELL_TOWER];
    const crossing = state.choices[p2.OLD_CROSSING];
    const hill = state.choices[p3.BLACK_RAVEN_HILL];
    const visit = state.choices[p4.FORK_FIRST_VISIT];
    const branchKey = [bell, crossing, hill, visit].join('|');
    const branchSummary = [
      bell === base.CHOICES.RING_BELL ? '鐘を鳴らした' : '鐘を壊した',
      crossing === p2.CHOICES.CUT_CROSSING ? '渡りを断った' : '渡りを残した',
      hill === p3.CHOICES.SIGNAL_CHAPEL ? '谷へ合図した' : '街道へ合図した',
      visit === p4.SALT_CHAPEL ? '塩の礼拝堂へ先に向かった' : '朽ちた関門へ先に向かった'
    ].join(' → ');
    const memories = [
      placeMemory(state, base.BELL_TOWER, '鐘なき塔', bell === base.CHOICES.RING_BELL
        ? 'あなたが鳴らした鐘は王兵を呼び、この塔を王の烽火に変えた。'
        : 'あなたが鐘を壊し、追われた者たちが旗を残さず逃げられる場所にした。',
      bell === base.CHOICES.RING_BELL ? '選択: 鐘を鳴らした' : '選択: 鐘を壊した'),
      placeMemory(state, p2.OLD_CROSSING, crossing === p2.CHOICES.CUT_CROSSING ? '灰の渡り' : '灯火の渡り', crossing === p2.CHOICES.CUT_CROSSING
        ? 'あなたは渡りを断った。追う者も逃げる者も、同じ川に進路を変えられた。'
        : 'あなたは渡りを残した。助けと危険が同じ橋を通り、その先の丘へ流れた。',
      crossing === p2.CHOICES.CUT_CROSSING ? '選択: 渡りを断った' : '選択: 渡りを残した'),
      placeMemory(state, p3.BLACK_RAVEN_HILL, hill === p3.CHOICES.SIGNAL_CHAPEL ? '谷見の丘' : '道見の丘', hill === p3.CHOICES.SIGNAL_CHAPEL
        ? '一度だけ送れる合図を谷へ向け、礼拝堂を先に備えさせた。'
        : '一度だけ送れる合図を街道へ向け、関門を先に備えさせた。',
      hill === p3.CHOICES.SIGNAL_CHAPEL ? '選択: 谷へ合図した' : '選択: 街道へ合図した'),
      placeMemory(state, p4.SALT_CHAPEL, '塩の礼拝堂', state.placeStates[p4.SALT_CHAPEL].startsWith('discovered')
        ? 'あなたはここへ自分で辿り着いた。丘の合図が届いたかどうかで、迎えた景色は変わった。'
        : 'あなたが別の道を選んだ間にも、礼拝堂は警告の有無に応じて自分たちの時間を進めた。',
      visit === p4.SALT_CHAPEL ? '訪問した' : '未訪問: 世界は進んだ'),
      placeMemory(state, p4.RUINED_GATE, '朽ちた関門', state.placeStates[p4.RUINED_GATE].startsWith('discovered')
        ? 'あなたはここへ自分で辿り着いた。開いていた道か、備えられた道かを目で確かめた。'
        : 'あなたが別の道を選んだ間にも、関門は警告の有無に応じて誰かを通し、あるいは止めた。',
      visit === p4.RUINED_GATE ? '訪問した' : '未訪問: 世界は進んだ'),
      placeMemory(state, p5.COLLISION_PLACE, collision.title, `${collision.summary} ${collision.history}`, '発見した')
    ];
    return Object.freeze({
      endingKey: collision.collisionKey,
      title: ending.title,
      lead: ending.lead,
      branchKey,
      branchLabel: 'あなたが残した四つの決断',
      branchSummary,
      memories: Object.freeze(memories),
      closing: '王冠を持たなくても、土地はあなたの選択を覚えている。ここから先は、別の土地がその記憶を受け取る。'
    });
  }

  function installStyles(doc) {
    if (doc.querySelector('#reboot-completion-styles')) return;
    const style = doc.createElement('style');
    style.id = 'reboot-completion-styles';
    style.textContent = `
      .reboot-ending{margin-top:1.25rem;padding:1.1rem;border:1px solid rgba(60,48,32,.32);background:rgba(247,239,214,.7);box-shadow:0 10px 30px rgba(41,31,18,.08)}
      .reboot-ending[hidden]{display:none}.reboot-ending h3{margin:.15rem 0 .45rem;font-size:clamp(1.35rem,4vw,2rem)}
      .reboot-ending .ending-branch{font-size:.82rem;line-height:1.55;opacity:.78}.land-memory-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin-top:1rem}
      .land-memory-card{padding:.75rem;border:1px solid rgba(60,48,32,.22);background:rgba(255,252,241,.62)}.land-memory-card strong{display:block;margin-bottom:.15rem}.land-memory-state{display:block;margin-bottom:.35rem;font-size:.72rem;font-weight:700;letter-spacing:.04em;opacity:.68}.land-memory-card p{margin:0;font-size:.88rem;line-height:1.55}
      .reboot-ending .ending-close{margin:.9rem 0 0;font-weight:700}.collision-gps-action{margin-top:.55rem}
      @media(max-width:560px){.land-memory-grid{grid-template-columns:1fr}.reboot-ending{margin-inline:-.15rem;padding:.85rem}.land-memory-card{padding:.68rem}}
    `;
    doc.head.appendChild(style);
  }

  function mount(win) {
    const doc = win.document;
    const status = doc.querySelector('#location-status');
    const persistenceNote = doc.querySelector('#persistence-note');
    const setStatus = (message, tone) => {
      if (!status) return;
      status.textContent = message;
      status.dataset.tone = tone || 'quiet';
    };

    let nativeStorage = null;
    try { nativeStorage = win.localStorage; } catch (_error) { nativeStorage = null; }
    const storage = createResilientStorage(nativeStorage, ({ persistent }) => {
      if (persistent) return;
      queueMicrotask(() => {
        if (persistenceNote) persistenceNote.textContent = '保存不可: このタブでは最後まで続けられるが、閉じると世界の変化は失われる。位置座標や移動経路は保存しない。';
        if (doc.body) doc.body.dataset.persistence = 'memory-only';
      });
    });
    try {
      Object.defineProperty(win, 'localStorage', { configurable: true, value: storage });
    } catch (_error) {
      try {
        if (nativeStorage) {
          nativeStorage.getItem = storage.getItem;
          nativeStorage.setItem = storage.setItem;
          nativeStorage.removeItem = storage.removeItem;
          nativeStorage.clear = storage.clear;
        }
      } catch (_ignored) {}
    }

    const gate = createLocationRequestGate();
    const geo = win.navigator && win.navigator.geolocation;
    let activeLocationRequest = null;
    const clearTimer = (timer) => {
      if (timer === null || timer === undefined) return;
      const cancel = typeof win.clearTimeout === 'function' ? win.clearTimeout.bind(win) : clearTimeout;
      cancel(timer);
    };
    const releaseLocationRequest = (token) => {
      if (!activeLocationRequest || activeLocationRequest.token !== token) return;
      const request = activeLocationRequest;
      activeLocationRequest = null;
      clearTimer(request.timer);
      if (request.button) {
        request.button.disabled = request.wasDisabled;
        request.button.setAttribute('aria-busy', 'false');
      }
    };
    const cancelLocationRequest = () => {
      const token = activeLocationRequest && activeLocationRequest.token;
      gate.invalidate();
      if (token !== null && token !== undefined) releaseLocationRequest(token);
    };
    if (geo && typeof geo.getCurrentPosition === 'function') {
      const nativeGetCurrentPosition = geo.getCurrentPosition.bind(geo);
      try {
        geo.getCurrentPosition = function (success, error, options) {
          const token = gate.begin();
          if (token === null) {
            setStatus('現在地はすでに確認中。結果を待つか、模擬探索へ切り替えられる。', 'trace');
            return null;
          }
          const activeElement = doc.activeElement;
          const button = activeElement && activeElement.matches && activeElement.matches('button') ? activeElement : null;
          activeLocationRequest = { token, button, wasDisabled: Boolean(button && button.disabled), timer: null };
          if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
          }
          const finish = (callback, value) => {
            if (!gate.settle(token)) {
              releaseLocationRequest(token);
              return false;
            }
            releaseLocationRequest(token);
            if (typeof callback === 'function') callback(value);
            return true;
          };
          const timeout = Number(options && options.timeout);
          const watchdogDelay = Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout + 1500, 30000) : 11500;
          const schedule = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
          activeLocationRequest.timer = schedule(() => {
            if (!gate.settle(token)) {
              releaseLocationRequest(token);
              return;
            }
            releaseLocationRequest(token);
            const reason = { code: 3, message: 'location callback timeout' };
            if (typeof error === 'function') error(reason);
            queueMicrotask(() => setStatus(locationErrorMessage(reason), 'warning'));
          }, watchdogDelay);
          try {
            nativeGetCurrentPosition((position) => {
              if (accuracyStatus(position) === 'insufficient') {
                const reason = { code: 2, message: 'insufficient accuracy', accuracy: position.coords.accuracy };
                if (!finish(error, reason)) return;
                queueMicrotask(() => setStatus(locationErrorMessage(reason), 'warning'));
                return;
              }
              finish(success, position);
            }, (reason) => {
              if (!finish(error, reason)) return;
              queueMicrotask(() => {
                setStatus(locationErrorMessage(reason), 'warning');
                const sim = doc.querySelector('#start-sim');
                const check = doc.querySelector('#check-location');
                if (sim) sim.hidden = false;
                if (check) check.hidden = false;
              });
            }, options);
          } catch (reason) {
            if (finish(error, reason)) queueMicrotask(() => setStatus(locationErrorMessage(reason), 'warning'));
          }
          return token;
        };
      } catch (_error) {}
    }

    doc.addEventListener('click', (event) => {
      const target = event.target && event.target.closest && event.target.closest('#start-sim,[data-move],[id^="dev-walk-"]');
      if (target) cancelLocationRequest();
      if (target && target.id === 'start-sim') setStatus('模擬探索へ切り替えた。切替前に届いた位置情報は進行に使わない。', 'trace');
    }, true);

    const startLive = doc.querySelector('#start-live');
    if (startLive) startLive.addEventListener('click', () => queueMicrotask(() => {
      if (geo && typeof geo.getCurrentPosition === 'function') return;
      const sim = doc.querySelector('#start-sim');
      if (sim) sim.hidden = false;
      setStatus('この環境では現在地を取得できない。再試行の代わりに模擬探索で同じ発見ルールを進められる。', 'warning');
    }));

    installStyles(doc);
    const collision = doc.querySelector('#collision-summary');
    const collisionDev = doc.querySelector('#dev-walk-collision');
    let collisionSession = { anchor: null, lastReading: null };
    let collisionBusy = false;
    const setCollisionBusy = (button, busy) => {
      collisionBusy = busy;
      if (!button) return;
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
      button.textContent = busy ? '現在地を確認しています…' : 'GPSで合流地点を探す';
    };
    if (collision && collisionDev && !doc.querySelector('#collision-live')) {
      const live = doc.createElement('button');
      live.id = 'collision-live';
      live.type = 'button';
      live.className = 'ink-button secondary-action collision-gps-action';
      live.textContent = 'GPSで合流地点を探す';
      collisionDev.insertAdjacentElement('beforebegin', live);
      live.addEventListener('click', () => {
        if (collisionBusy) return;
        if (!win.navigator.geolocation || typeof win.navigator.geolocation.getCurrentPosition !== 'function') {
          setStatus('合流地点の位置確認は使えない。模擬操作でも同じ発見状態まで進められる。', 'warning');
          return;
        }
        setCollisionBusy(live, true);
        win.navigator.geolocation.getCurrentPosition((position) => {
          setCollisionBusy(live, false);
          try {
            const world = p5.parseState(win.localStorage.getItem(p5.STORAGE_KEY));
            const result = observeCollisionLocation(collisionSession, world, position.coords);
            if (result.status === 'anchored') {
              setStatus('ここを合流地点探索の起点にした。安全に歩いてから、もう一度確認する。', 'trace');
              return;
            }
            if (result.status === 'discovered') {
              collisionDev.click();
              setStatus('二つの痕跡が交わる土地を発見した。', 'found');
              return;
            }
            setStatus(result.proximity === 'near' ? '二つの痕跡が近い。安全にもう少し進んで再確認できる。' : 'まだ合流地点には届いていない。安全な方向だけを選んで進む。', 'trace');
          } catch (_error) {
            setStatus('取得した現在地を判定できなかった。安全な場所で、もう一度確認できる。', 'warning');
          }
        }, (reason) => {
          setCollisionBusy(live, false);
          setStatus(locationErrorMessage(reason), 'warning');
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15000 });
      });
    }

    let endingSurface = null;
    function ensureEndingSurface() {
      if (endingSurface) return endingSurface;
      endingSurface = doc.createElement('section');
      endingSurface.id = 'reboot-ending';
      endingSurface.className = 'reboot-ending';
      endingSurface.hidden = true;
      endingSurface.setAttribute('aria-live', 'polite');
      (collision || doc.querySelector('#story-panel')).insertAdjacentElement('afterend', endingSurface);
      return endingSurface;
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    }
    function renderEnding() {
      let world;
      try { world = p5.parseState(win.localStorage.getItem(p5.STORAGE_KEY)); }
      catch (_error) { return; }
      const completion = buildCompletion(world);
      if (!completion) return;
      const surface = ensureEndingSurface();
      surface.hidden = false;
      surface.dataset.ending = completion.endingKey;
      surface.innerHTML = `
        <p class="eyebrow">CROWNLESS / THE LAND REMEMBERS</p>
        <h3>${escapeHtml(completion.title)}</h3>
        <p>${escapeHtml(completion.lead)}</p>
        <p class="ending-branch"><strong>${escapeHtml(completion.branchLabel)}</strong><br>${escapeHtml(completion.branchSummary)}</p>
        <div class="land-memory-grid">${completion.memories.map((entry) => `<article class="land-memory-card" data-place="${escapeHtml(entry.id)}"><strong>${escapeHtml(entry.title)}</strong><small class="land-memory-state">${escapeHtml(entry.statusLabel)}</small><p>${escapeHtml(entry.text)}</p></article>`).join('')}</div>
        <p class="ending-close">${escapeHtml(completion.closing)}</p>`;
      doc.body.dataset.rebootEnding = completion.endingKey;
      setStatus('終幕。六つの土地が、あなたの四つの決断をそれぞれの形で覚えている。', 'found');
    }

    if (collisionDev) collisionDev.addEventListener('click', () => queueMicrotask(renderEnding));
    renderEnding();

    const resetButton = doc.querySelector('#reboot-dev-reset');
    if (resetButton) resetButton.addEventListener('click', () => {
      const confirmed = win.confirm('Reboot Prototypeの世界状態だけを消して、最初からやり直しますか？');
      if (!confirmed) return;
      try {
        const removed = win.localStorage.removeItem(base.STORAGE_KEY);
        if (removed === false) throw new Error('storage removal failed');
        win.location.reload();
      } catch (_error) {
        setStatus('保存領域から世界状態を削除できなかったため、再読み込みはしない。このタブの進行はそのまま続けられる。', 'warning');
      }
    });
  }

  return Object.freeze({
    MAX_ACCEPTABLE_ACCURACY_METERS,
    ENDINGS,
    createResilientStorage,
    createLocationRequestGate,
    accuracyStatus,
    locationErrorMessage,
    observeCollisionLocation,
    buildCompletion,
    mount
  });
});