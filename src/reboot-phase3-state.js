(function (root, factory) {
  const api = factory(root && root.CrownlessRebootState, root && root.CrownlessRebootPhase2State);
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./reboot-prototype-state.js'), require('./reboot-phase2-state.js'));
  }
  if (root) root.CrownlessRebootPhase3State = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (base, p2) {
  'use strict';
  if (!base || !p2) throw new Error('Crownless Reboot Phase 1 and Phase 2 state are required');

  const BLACK_RAVEN_HILL = p2.BLACK_RAVEN_HILL;
  const SALT_CHAPEL = 'salt_chapel';
  const RUINED_GATE = 'ruined_gate';
  const CHOICES = Object.freeze({
    SIGNAL_CHAPEL: 'signal_chapel',
    SIGNAL_GATE: 'signal_gate'
  });

  function isHillChoice(value) {
    return value === CHOICES.SIGNAL_CHAPEL || value === CHOICES.SIGNAL_GATE;
  }

  function normalizeState(input) {
    const previous = p2.normalizeState(input);
    const state = {
      ...previous,
      discoveredPlaces: [...previous.discoveredPlaces],
      placeStates: {
        ...previous.placeStates,
        [SALT_CHAPEL]: 'unknown',
        [RUINED_GATE]: 'unknown'
      },
      choices: {
        ...previous.choices,
        [BLACK_RAVEN_HILL]: null
      },
      consequences: {
        ...previous.consequences,
        [SALT_CHAPEL]: null,
        [RUINED_GATE]: null
      }
    };

    if (!state.choices[p2.OLD_CROSSING]) return state;

    const hillChoice = input && input.choices && input.choices[BLACK_RAVEN_HILL];
    if (isHillChoice(hillChoice)) {
      state.choices[BLACK_RAVEN_HILL] = hillChoice;
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, BLACK_RAVEN_HILL])];
      state.placeStates[BLACK_RAVEN_HILL] = hillChoice === CHOICES.SIGNAL_CHAPEL ? 'valley_watch' : 'road_watch';
      state.placeStates[SALT_CHAPEL] = hillChoice === CHOICES.SIGNAL_CHAPEL ? 'hinted_warned' : 'hinted_exposed';
      state.placeStates[RUINED_GATE] = hillChoice === CHOICES.SIGNAL_GATE ? 'hinted_warned' : 'hinted_exposed';
      state.consequences[SALT_CHAPEL] = hillChoice === CHOICES.SIGNAL_CHAPEL ? 'warned_from_hill' : 'left_unwarned';
      state.consequences[RUINED_GATE] = hillChoice === CHOICES.SIGNAL_GATE ? 'warned_from_hill' : 'left_unwarned';
      return state;
    }

    if (input && input.placeStates && input.placeStates[BLACK_RAVEN_HILL] === 'discovered') {
      state.placeStates[BLACK_RAVEN_HILL] = 'discovered';
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, BLACK_RAVEN_HILL])];
    }
    return state;
  }

  function parseState(raw) {
    if (!raw) return normalizeState(base.createInitialState());
    try { return normalizeState(JSON.parse(raw)); }
    catch (_error) { return normalizeState(base.createInitialState()); }
  }

  function serializeState(state) {
    return JSON.stringify(normalizeState(state));
  }

  function discoverBlackRavenHill(inputState) {
    const state = normalizeState(inputState);
    if (!state.choices[p2.OLD_CROSSING]) throw new Error('old_crossing fate is required');
    if (state.placeStates[BLACK_RAVEN_HILL] === 'hinted') {
      state.placeStates[BLACK_RAVEN_HILL] = 'discovered';
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, BLACK_RAVEN_HILL])];
    }
    return state;
  }

  function simulateBlackRavenHillDiscovery(state) {
    return discoverBlackRavenHill(state);
  }

  function applyHillChoice(inputState, choice) {
    const state = normalizeState(inputState);
    if (state.placeStates[BLACK_RAVEN_HILL] !== 'discovered' && !state.choices[BLACK_RAVEN_HILL]) {
      throw new Error('black_raven_hill must be discovered before choosing its signal');
    }
    if (!isHillChoice(choice)) throw new Error('invalid hill choice');
    const existing = state.choices[BLACK_RAVEN_HILL];
    if (existing && existing !== choice) throw new Error('black_raven_hill choice is irreversible');
    if (existing === choice) return state;

    state.choices[BLACK_RAVEN_HILL] = choice;
    state.placeStates[BLACK_RAVEN_HILL] = choice === CHOICES.SIGNAL_CHAPEL ? 'valley_watch' : 'road_watch';
    state.placeStates[SALT_CHAPEL] = choice === CHOICES.SIGNAL_CHAPEL ? 'hinted_warned' : 'hinted_exposed';
    state.placeStates[RUINED_GATE] = choice === CHOICES.SIGNAL_GATE ? 'hinted_warned' : 'hinted_exposed';
    state.consequences[SALT_CHAPEL] = choice === CHOICES.SIGNAL_CHAPEL ? 'warned_from_hill' : 'left_unwarned';
    state.consequences[RUINED_GATE] = choice === CHOICES.SIGNAL_GATE ? 'warned_from_hill' : 'left_unwarned';
    return state;
  }

  function createLocationSession() {
    return { anchor: null, lastReading: null };
  }

  function observeBlackRavenHillLocation(session, inputState, coords) {
    if (!session || typeof session !== 'object') throw new Error('location session is required');
    const state = normalizeState(inputState);
    if (state.placeStates[BLACK_RAVEN_HILL] !== 'hinted') return { state, status: 'settled', proximity: 'settled' };
    const reading = { latitude: Number(coords && coords.latitude), longitude: Number(coords && coords.longitude) };
    if (!Number.isFinite(reading.latitude) || !Number.isFinite(reading.longitude)) throw new Error('valid coordinates are required');
    session.lastReading = reading;
    if (!session.anchor) {
      session.anchor = reading;
      return { state, status: 'anchored', proximity: 'origin' };
    }
    const distance = base.haversineMeters(session.anchor, reading);
    if (distance >= base.DISCOVERY_RADIUS_METERS) {
      return { state: discoverBlackRavenHill(state), status: 'discovered', proximity: 'discovered' };
    }
    return { state, status: 'searching', proximity: distance >= 35 ? 'near' : distance >= 15 ? 'edge' : 'origin' };
  }

  function getHistoryKey(inputState) {
    const state = normalizeState(inputState);
    return state.consequences[BLACK_RAVEN_HILL];
  }

  function getHillArrivalPresentation(inputState) {
    const state = normalizeState(inputState);
    if (state.placeStates[BLACK_RAVEN_HILL] !== 'discovered') return null;
    const key = getHistoryKey(state);
    const contexts = {
      king_detour_black_flag: {
        summary: '川を迂回した王兵が丘へ着いた。頂では黒旗を掲げた脱走兵が信号台を占め、互いに武器を下ろさない。',
        pressure: '王兵と黒旗の一団、どちらに先の土地を知らせるかで均衡が崩れる。'
      },
      king_wagon_missing: {
        summary: '戻らなかった王の荷車は丘で止められていた。積荷を巡り、渡し守の仲間と王兵が壊れた信号台の下で言い争っている。',
        pressure: '荷の行き先を知らせれば、人も兵もその合図を追う。'
      },
      refugees_chased_uphill: {
        summary: '旅人たちは黒鴉の丘まで逃げ切ったが、斜面の下には追手の松明が並ぶ。信号台には一度だけ火を送れる薪が残っている。',
        pressure: 'どちらへ警告を送るかで、逃げ場と街道のどちらかが先に備える。'
      },
      keeper_secret_path: {
        summary: '古道を先回りした密偵が信号台を使おうとしている。旅人の行き先を探る印が、塩の礼拝堂と朽ちた関門の方角へ刻まれている。',
        pressure: '密偵より先に一方向へだけ合図を送り、もう一方は無警戒のまま残すことになる。'
      }
    };
    const context = contexts[key];
    if (!context) return null;
    return {
      title: '黒鴉の丘',
      summary: context.summary,
      pressure: context.pressure,
      historyKey: key
    };
  }

  function getHillOutcomePresentation(inputState) {
    const state = normalizeState(inputState);
    const choice = state.choices[BLACK_RAVEN_HILL];
    if (!isHillChoice(choice)) return null;
    const historyKey = getHistoryKey(state);
    const actors = {
      king_detour_black_flag: '黒旗の一団と王兵',
      king_wagon_missing: '王の荷を巡る者たち',
      refugees_chased_uphill: '旅人と追手',
      keeper_secret_path: '先回りした密偵'
    };
    const actor = actors[historyKey] || '丘に集まった者たち';
    const chapelWarned = choice === CHOICES.SIGNAL_CHAPEL;
    return {
      hillTitle: chapelWarned ? '谷見の丘' : '道見の丘',
      hillSummary: chapelWarned
        ? 'あなたは谷へ合図した。丘の火は塩の礼拝堂へ向き、街道側には何も送られなかった。'
        : 'あなたは街道へ合図した。丘の火は朽ちた関門へ向き、谷側には何も送られなかった。',
      chapel: {
        state: state.placeStates[SALT_CHAPEL],
        title: '塩の礼拝堂',
        hook: chapelWarned
          ? `礼拝堂は${actor}の気配を知り、扉を閉じて灯りを落とした。`
          : `礼拝堂は${actor}の気配を知らず、まだ人を受け入れている。`,
        mark: chapelWarned ? '警戒' : '無警戒'
      },
      gate: {
        state: state.placeStates[RUINED_GATE],
        title: '朽ちた関門',
        hook: chapelWarned
          ? `関門は${actor}の気配を知らず、崩れた街道を開けたままにしている。`
          : `関門は${actor}の気配を知り、瓦礫を積んで道を塞ぎ始めた。`,
        mark: chapelWarned ? '無警戒' : '警戒'
      },
      historyKey,
      hillOutcome: chapelWarned ? 'valley' : 'road'
    };
  }

  return Object.freeze({
    STORAGE_KEY: base.STORAGE_KEY,
    BLACK_RAVEN_HILL,
    SALT_CHAPEL,
    RUINED_GATE,
    CHOICES,
    normalizeState,
    parseState,
    serializeState,
    discoverBlackRavenHill,
    simulateBlackRavenHillDiscovery,
    applyHillChoice,
    createLocationSession,
    observeBlackRavenHillLocation,
    getHillArrivalPresentation,
    getHillOutcomePresentation
  });
});
