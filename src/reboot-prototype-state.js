(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessRebootState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'crownless.reboot.v1';
  const BELL_TOWER = 'bell_tower';
  const OLD_CROSSING = 'old_crossing';
  const DISCOVERY_RADIUS_METERS = 55;

  const CHOICES = Object.freeze({
    RING_BELL: 'ring_bell',
    BREAK_BELL: 'break_bell'
  });

  const TOWER_STATES = new Set(['undiscovered', 'discovered', 'king_beacon', 'free_haven']);
  const CROSSING_STATES = new Set(['unknown', 'hinted']);
  const CONSEQUENCES = new Set(['soldiers_found_something', 'refugees_missing']);

  function createInitialState() {
    return {
      version: VERSION,
      discoveredPlaces: [],
      placeStates: {
        [BELL_TOWER]: 'undiscovered',
        [OLD_CROSSING]: 'unknown'
      },
      choices: {
        [BELL_TOWER]: null
      },
      consequences: {
        [OLD_CROSSING]: null
      }
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeState(input) {
    const safe = createInitialState();
    if (!input || typeof input !== 'object') return safe;

    const discovered = Array.isArray(input.discoveredPlaces) ? input.discoveredPlaces : [];
    safe.discoveredPlaces = [...new Set(discovered.filter((id) => id === BELL_TOWER || id === OLD_CROSSING))];

    const inputTower = input.placeStates && input.placeStates[BELL_TOWER];
    const inputCrossing = input.placeStates && input.placeStates[OLD_CROSSING];
    if (TOWER_STATES.has(inputTower)) safe.placeStates[BELL_TOWER] = inputTower;
    if (CROSSING_STATES.has(inputCrossing)) safe.placeStates[OLD_CROSSING] = inputCrossing;

    const choice = input.choices && input.choices[BELL_TOWER];
    if (choice === CHOICES.RING_BELL || choice === CHOICES.BREAK_BELL) {
      safe.choices[BELL_TOWER] = choice;
      safe.discoveredPlaces = [...new Set([...safe.discoveredPlaces, BELL_TOWER])];
      safe.placeStates[BELL_TOWER] = choice === CHOICES.RING_BELL ? 'king_beacon' : 'free_haven';
      safe.placeStates[OLD_CROSSING] = 'hinted';
      safe.consequences[OLD_CROSSING] = choice === CHOICES.RING_BELL
        ? 'soldiers_found_something'
        : 'refugees_missing';
      return safe;
    }

    const consequence = input.consequences && input.consequences[OLD_CROSSING];
    if (CONSEQUENCES.has(consequence)) safe.consequences[OLD_CROSSING] = consequence;

    if (safe.placeStates[BELL_TOWER] !== 'undiscovered') {
      safe.discoveredPlaces = [...new Set([...safe.discoveredPlaces, BELL_TOWER])];
    }

    return safe;
  }

  function discoverBellTower(inputState) {
    const state = normalizeState(inputState);
    if (state.placeStates[BELL_TOWER] === 'undiscovered') {
      state.placeStates[BELL_TOWER] = 'discovered';
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, BELL_TOWER])];
    }
    return state;
  }

  function applyBellChoice(inputState, choice) {
    const state = normalizeState(inputState);
    if (state.placeStates[BELL_TOWER] === 'undiscovered') {
      throw new Error('bell_tower must be discovered before choosing its fate');
    }
    if (choice !== CHOICES.RING_BELL && choice !== CHOICES.BREAK_BELL) {
      throw new Error('invalid bell choice');
    }

    const existing = state.choices[BELL_TOWER];
    if (existing && existing !== choice) {
      throw new Error('bell_tower choice is irreversible');
    }
    if (existing === choice) return state;

    state.choices[BELL_TOWER] = choice;
    state.placeStates[BELL_TOWER] = choice === CHOICES.RING_BELL ? 'king_beacon' : 'free_haven';
    state.placeStates[OLD_CROSSING] = 'hinted';
    state.consequences[OLD_CROSSING] = choice === CHOICES.RING_BELL
      ? 'soldiers_found_something'
      : 'refugees_missing';
    return state;
  }

  function serializeState(inputState) {
    return JSON.stringify(normalizeState(inputState));
  }

  function parseState(raw) {
    if (!raw) return createInitialState();
    try {
      return normalizeState(JSON.parse(raw));
    } catch (_error) {
      return createInitialState();
    }
  }

  function createLocationSession() {
    return {
      anchor: null,
      lastReading: null
    };
  }

  function normalizeCoordinates(coords) {
    if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      throw new Error('valid coordinates are required');
    }
    return { latitude: coords.latitude, longitude: coords.longitude };
  }

  function haversineMeters(a, b) {
    const p1 = normalizeCoordinates(a);
    const p2 = normalizeCoordinates(b);
    const radius = 6371000;
    const toRad = (value) => value * Math.PI / 180;
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLon = toRad(p2.longitude - p1.longitude);
    const lat1 = toRad(p1.latitude);
    const lat2 = toRad(p2.latitude);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function observeDiscoveryLocation(session, inputState, coords) {
    if (!session || typeof session !== 'object') throw new Error('location session is required');
    const reading = normalizeCoordinates(coords);
    const state = normalizeState(inputState);

    if (!session.anchor) {
      session.anchor = reading;
      session.lastReading = reading;
      return { state, status: 'anchored', proximity: 'origin' };
    }

    session.lastReading = reading;
    if (state.placeStates[BELL_TOWER] !== 'undiscovered') {
      return { state, status: 'already_discovered', proximity: 'discovered' };
    }

    const distance = haversineMeters(session.anchor, reading);
    if (distance >= DISCOVERY_RADIUS_METERS) {
      return { state: discoverBellTower(state), status: 'discovered', proximity: 'discovered' };
    }
    if (distance >= 35) return { state, status: 'searching', proximity: 'near' };
    if (distance >= 15) return { state, status: 'searching', proximity: 'edge' };
    return { state, status: 'searching', proximity: 'origin' };
  }

  function getOutcomePresentation(inputState) {
    const state = normalizeState(inputState);
    const choice = state.choices[BELL_TOWER];
    if (choice === CHOICES.RING_BELL) {
      return {
        towerTitle: '王の烽火',
        towerSummary: 'あなたが鐘を鳴らした。王の兵がここを守っている。',
        consequenceLead: '王の兵が渡り場へ向かった。',
        consequenceHook: '渡り場から狼煙が上がった。王の兵が何かを発見した。',
        outcome: 'king'
      };
    }
    if (choice === CHOICES.BREAK_BELL) {
      return {
        towerTitle: '自由民の隠れ家',
        towerSummary: 'あなたが鐘を壊した。旅人たちは旗を残さず東へ逃れた。',
        consequenceLead: '旅人たちは東へ逃れた。',
        consequenceHook: '旅人たちの足跡が、古い渡り場で途絶えている。',
        outcome: 'free'
      };
    }
    return null;
  }

  return Object.freeze({
    VERSION,
    STORAGE_KEY,
    BELL_TOWER,
    OLD_CROSSING,
    DISCOVERY_RADIUS_METERS,
    CHOICES,
    createInitialState,
    normalizeState,
    discoverBellTower,
    applyBellChoice,
    serializeState,
    parseState,
    createLocationSession,
    haversineMeters,
    observeDiscoveryLocation,
    getOutcomePresentation,
    clone
  });
});
