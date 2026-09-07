(function (root, factory) {
  const api = factory(root && root.CrownlessRebootState);
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./reboot-prototype-state.js'));
  if (root) root.CrownlessRebootPhase2State = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (base) {
  'use strict';
  if (!base) throw new Error('CrownlessRebootState is required');

  const OLD_CROSSING = base.OLD_CROSSING;
  const BLACK_RAVEN_HILL = 'black_raven_hill';
  const CHOICES = Object.freeze({ CUT_CROSSING: 'cut_crossing', KEEP_CROSSING: 'keep_crossing' });

  function isCrossingChoice(value) {
    return value === CHOICES.CUT_CROSSING || value === CHOICES.KEEP_CROSSING;
  }

  function normalizeState(input) {
    const phase1 = base.normalizeState(input);
    const state = {
      ...phase1,
      discoveredPlaces: [...phase1.discoveredPlaces],
      placeStates: { ...phase1.placeStates, [BLACK_RAVEN_HILL]: 'unknown' },
      choices: { ...phase1.choices, [OLD_CROSSING]: null },
      consequences: { ...phase1.consequences, [BLACK_RAVEN_HILL]: null }
    };
    const bellChoice = state.choices[base.BELL_TOWER];
    if (!bellChoice) return state;

    const crossingChoice = input && input.choices && input.choices[OLD_CROSSING];
    if (isCrossingChoice(crossingChoice)) {
      state.choices[OLD_CROSSING] = crossingChoice;
      state.placeStates[OLD_CROSSING] = crossingChoice === CHOICES.CUT_CROSSING ? 'ash_crossing' : 'lantern_crossing';
      state.placeStates[BLACK_RAVEN_HILL] = 'hinted';
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, OLD_CROSSING])];
      state.consequences[BLACK_RAVEN_HILL] = hillConsequence(bellChoice, crossingChoice);
      return state;
    }

    if (input && input.placeStates && input.placeStates[OLD_CROSSING] === 'discovered') {
      state.placeStates[OLD_CROSSING] = 'discovered';
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, OLD_CROSSING])];
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

  function discoverOldCrossing(inputState) {
    const state = normalizeState(inputState);
    if (!state.choices[base.BELL_TOWER]) throw new Error('bell_tower fate is required');
    if (state.placeStates[OLD_CROSSING] === 'hinted') {
      state.placeStates[OLD_CROSSING] = 'discovered';
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, OLD_CROSSING])];
    }
    return state;
  }

  function simulateOldCrossingDiscovery(state) {
    return discoverOldCrossing(state);
  }

  function applyCrossingChoice(inputState, choice) {
    const state = normalizeState(inputState);
    if (state.placeStates[OLD_CROSSING] !== 'discovered' && !state.choices[OLD_CROSSING]) {
      throw new Error('old_crossing must be discovered before choosing its fate');
    }
    if (!isCrossingChoice(choice)) throw new Error('invalid crossing choice');
    const existing = state.choices[OLD_CROSSING];
    if (existing && existing !== choice) throw new Error('old_crossing choice is irreversible');
    if (existing === choice) return state;

    state.choices[OLD_CROSSING] = choice;
    state.placeStates[OLD_CROSSING] = choice === CHOICES.CUT_CROSSING ? 'ash_crossing' : 'lantern_crossing';
    state.placeStates[BLACK_RAVEN_HILL] = 'hinted';
    state.consequences[BLACK_RAVEN_HILL] = hillConsequence(state.choices[base.BELL_TOWER], choice);
    return state;
  }

  function hillConsequence(bellChoice, crossingChoice) {
    if (bellChoice === base.CHOICES.RING_BELL && crossingChoice === CHOICES.CUT_CROSSING) return 'king_detour_black_flag';
    if (bellChoice === base.CHOICES.RING_BELL && crossingChoice === CHOICES.KEEP_CROSSING) return 'king_wagon_missing';
    if (bellChoice === base.CHOICES.BREAK_BELL && crossingChoice === CHOICES.CUT_CROSSING) return 'refugees_chased_uphill';
    if (bellChoice === base.CHOICES.BREAK_BELL && crossingChoice === CHOICES.KEEP_CROSSING) return 'keeper_secret_path';
    return null;
  }

  function createLocationSession() {
    return { anchor: null, lastReading: null };
  }

  function observeOldCrossingLocation(session, inputState, coords) {
    if (!session || typeof session !== 'object') throw new Error('location session is required');
    const state = normalizeState(inputState);
    if (state.placeStates[OLD_CROSSING] !== 'hinted') return { state, status: 'settled', proximity: 'settled' };
    const reading = { latitude: Number(coords && coords.latitude), longitude: Number(coords && coords.longitude) };
    if (!Number.isFinite(reading.latitude) || !Number.isFinite(reading.longitude)) throw new Error('valid coordinates are required');
    session.lastReading = reading;
    if (!session.anchor) {
      session.anchor = reading;
      return { state, status: 'anchored', proximity: 'origin' };
    }
    const distance = base.haversineMeters(session.anchor, reading);
    if (distance >= base.DISCOVERY_RADIUS_METERS) {
      return { state: discoverOldCrossing(state), status: 'discovered', proximity: 'discovered' };
    }
    return { state, status: 'searching', proximity: distance >= 35 ? 'near' : distance >= 15 ? 'edge' : 'origin' };
  }

  function getCrossingArrivalPresentation(inputState) {
    const state = normalizeState(inputState);
    if (state.placeStates[OLD_CROSSING] !== 'discovered') return null;
    if (state.choices[base.BELL_TOWER] === base.CHOICES.RING_BELL) {
      return {
        title: '古い渡り場',
        summary: '王兵は渡し守の小屋で、地図にない密輸路を見つけていた。対岸へ逃げた者を追うため、橋を焼こうとしている。',
        dialogue: [['王兵', '渡りを断てば、奴らは戻れない。'], ['渡し守', '橋を焼けば、村の者も冬を越せなくなる。']]
      };
    }
    return {
      title: '古い渡り場',
      summary: '逃げた旅人たちは、ここに負傷者を残していた。追手を避けるには渡りを落としたい。だが、それは負傷者の退路も消す。',
      dialogue: [['旅人', '橋を落とせば、追手は止まる。'], ['負傷者', '……俺たちも、ここから出られなくなる。']]
    };
  }

  function getCrossingOutcomePresentation(inputState) {
    const state = normalizeState(inputState);
    const crossingChoice = state.choices[OLD_CROSSING];
    if (!isCrossingChoice(crossingChoice)) return null;
    const cut = crossingChoice === CHOICES.CUT_CROSSING;
    const key = state.consequences[BLACK_RAVEN_HILL];
    const hooks = {
      king_detour_black_flag: ['王兵は川を渡れず、黒鴉の丘へ迂回した。', '丘の上に、見覚えのない黒い旗が立った。', '黒い旗'],
      king_wagon_missing: ['王の荷車が渡りを越え、黒鴉の丘へ向かった。', '日が暮れても、一台も戻ってこない。', '戻らない荷車'],
      refugees_chased_uphill: ['旅人たちは渡りを失い、黒鴉の丘へ逃れた。', 'その後ろを、追手の松明が列になって登っている。', '追手の松明'],
      keeper_secret_path: ['渡し守は旅人に、黒鴉の丘を抜ける古道を教えた。', 'だが丘には、誰かが先回りした足跡がある。', '先回りした影']
    };
    const hook = hooks[key];
    return {
      crossingTitle: cut ? '灰の渡り' : '灯火の渡り',
      crossingSummary: cut ? 'あなたは渡りを断った。焦げた梁と流された板だけが川に残る。' : 'あなたは渡りを残した。夜になると、誰かのための灯りが橋のたもとに置かれる。',
      hillLead: hook[0], hillHook: hook[1], hillTrace: hook[2], consequence: key,
      crossingOutcome: cut ? 'ash' : 'lantern'
    };
  }

  return Object.freeze({
    STORAGE_KEY: base.STORAGE_KEY,
    OLD_CROSSING,
    BLACK_RAVEN_HILL,
    CHOICES,
    normalizeState,
    parseState,
    serializeState,
    discoverOldCrossing,
    simulateOldCrossingDiscovery,
    applyCrossingChoice,
    createLocationSession,
    observeOldCrossingLocation,
    getCrossingArrivalPresentation,
    getCrossingOutcomePresentation
  });
});
