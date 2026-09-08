(function (root, factory) {
  const api = factory(root && root.CrownlessRebootPhase4State, root && root.CrownlessRebootState);
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./reboot-phase4-state.js'), require('./reboot-prototype-state.js'));
  }
  if (root) root.CrownlessRebootPhase5State = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (p4, base) {
  'use strict';
  if (!p4) throw new Error('Crownless Reboot Phase 4 state is required');

  const COLLISION_PLACE = 'splitroad_market';
  const OUTCOMES = Object.freeze({
    BLACK_CARGO: 'black_cargo_market',
    DEAD_END: 'dead_end_market',
    CANVAS: 'canvas_market',
    SALT_LANTERN: 'salt_lantern_market'
  });

  const OUTCOME_KEYS = Object.freeze({
    BLACK_CARGO: 'chapel_warned_gate_passed',
    DEAD_END: 'chapel_exposed_gate_barricaded',
    CANVAS: 'gate_warned_chapel_crowded',
    SALT_LANTERN: 'gate_exposed_chapel_sealed'
  });

  const OUTCOME_STATE_BY_KEY = Object.freeze({
    [OUTCOME_KEYS.BLACK_CARGO]: OUTCOMES.BLACK_CARGO,
    [OUTCOME_KEYS.DEAD_END]: OUTCOMES.DEAD_END,
    [OUTCOME_KEYS.CANVAS]: OUTCOMES.CANVAS,
    [OUTCOME_KEYS.SALT_LANTERN]: OUTCOMES.SALT_LANTERN
  });

  function isOutcomeState(value) {
    return Object.values(OUTCOMES).includes(value);
  }

  function deriveCollisionKey(inputState) {
    const state = p4.normalizeState(inputState);
    const chapel = state.placeStates[p4.SALT_CHAPEL];
    const gate = state.placeStates[p4.RUINED_GATE];

    if (chapel === 'discovered_warned' && gate === 'passed_without_you') return OUTCOME_KEYS.BLACK_CARGO;
    if (chapel === 'discovered_exposed' && gate === 'barricaded_without_you') return OUTCOME_KEYS.DEAD_END;
    if (gate === 'discovered_warned' && chapel === 'crowded_without_you') return OUTCOME_KEYS.CANVAS;
    if (gate === 'discovered_exposed' && chapel === 'sealed_without_you') return OUTCOME_KEYS.SALT_LANTERN;
    return null;
  }

  function normalizeState(input) {
    const previous = p4.normalizeState(input);
    const discoveredInInput = Boolean(
      input && Array.isArray(input.discoveredPlaces) && input.discoveredPlaces.includes(COLLISION_PLACE)
    );
    const state = {
      ...previous,
      discoveredPlaces: [...previous.discoveredPlaces],
      placeStates: { ...previous.placeStates, [COLLISION_PLACE]: 'unknown' },
      choices: { ...previous.choices },
      consequences: { ...previous.consequences, [COLLISION_PLACE]: null }
    };

    if (!state.choices[p4.FORK_FIRST_VISIT]) return state;
    const collisionKey = deriveCollisionKey(state);
    if (!collisionKey) return state;

    state.consequences[COLLISION_PLACE] = collisionKey;
    if (discoveredInInput) {
      state.discoveredPlaces = [...new Set([...state.discoveredPlaces, COLLISION_PLACE])];
      state.placeStates[COLLISION_PLACE] = OUTCOME_STATE_BY_KEY[collisionKey];
    } else {
      state.placeStates[COLLISION_PLACE] = 'hinted';
    }
    return state;
  }

  function parseState(raw) {
    if (!raw) return normalizeState({});
    try { return normalizeState(JSON.parse(raw)); }
    catch (_error) { return normalizeState({}); }
  }

  function serializeState(state) {
    return JSON.stringify(normalizeState(state));
  }

  function discoverCollisionPlace(inputState) {
    const state = normalizeState(inputState);
    if (!state.choices[p4.FORK_FIRST_VISIT]) throw new Error('fork first visit is required');
    if (state.placeStates[COLLISION_PLACE] === 'unknown') throw new Error('collision place is not available');
    if (isOutcomeState(state.placeStates[COLLISION_PLACE])) return state;
    if (state.placeStates[COLLISION_PLACE] !== 'hinted') throw new Error('collision place must be hinted before discovery');

    return normalizeState({
      ...state,
      discoveredPlaces: [...new Set([...state.discoveredPlaces, COLLISION_PLACE])]
    });
  }

  function sourcePresentation(inputState) {
    return p4.getFirstVisitPresentation(inputState);
  }

  function observeCollisionLocation(session, inputState, coords) {
    const state = normalizeState(inputState);
    if (!state.choices[p4.FORK_FIRST_VISIT]) throw new Error('fork first visit is required');
    base.haversineMeters(coords, coords);
    if (isOutcomeState(state.placeStates[COLLISION_PLACE])) return { state, status: 'already_discovered' };
    if (!session.anchor) {
      session.anchor = { latitude: coords.latitude, longitude: coords.longitude };
      return { state, status: 'anchored' };
    }
    if (base.haversineMeters(session.anchor, coords) < base.DISCOVERY_RADIUS_METERS) return { state, status: 'searching' };
    return { state: discoverCollisionPlace(state), status: 'discovered' };
  }

  function getCollisionHintPresentation(inputState) {
    const state = normalizeState(inputState);
    if (state.placeStates[COLLISION_PLACE] !== 'hinted') return null;
    const source = sourcePresentation(state);
    if (!source) return null;
    return {
      title: '二つの痕跡が、同じ方角へ伸びている。',
      summary: `${source.visited.title}であなたが見た変化と、${source.unvisited.title}で見ていない間に起きた変化。その両方から人と荷の痕跡が同じ裂け道へ向かっている。`,
      visited: source.visited,
      unvisited: source.unvisited,
      actor: source.actor,
      collisionKey: state.consequences[COLLISION_PLACE]
    };
  }

  function outcomeDefinition(key) {
    const definitions = {
      [OUTCOME_KEYS.BLACK_CARGO]: {
        title: '黒荷の市',
        mark: '黒い荷札',
        summary: '警告を受けた礼拝堂へあなたが着いた一方、無警戒だった関門は何者かに抜けられた。行き場を失った荷と人が裂け道へ流れ込み、正体の知れない荷が夜ごと交換されている。',
        visual: 'black-cargo'
      },
      [OUTCOME_KEYS.DEAD_END]: {
        title: '行き止まりの市',
        mark: '止まった荷車',
        summary: '無警戒だった礼拝堂が混乱する一方、警告を受けた関門はあなたが行かない間に街道を封じた。押し戻された荷車と避難民が裂け道で行き場を失い、その場に市が生まれた。',
        visual: 'dead-end'
      },
      [OUTCOME_KEYS.CANVAS]: {
        title: '布屋根の市',
        mark: '継ぎ接ぎの天幕',
        summary: '警告を受けた関門へあなたが着いた頃、無警戒だった礼拝堂には人があふれていた。礼拝堂から押し出された人々と街道で止められた旅人が裂け道に布屋根を張り始めた。',
        visual: 'canvas'
      },
      [OUTCOME_KEYS.SALT_LANTERN]: {
        title: '塩灯の市',
        mark: '塩袋と灯火',
        summary: '無警戒だった関門へあなたが着く間に、警告を受けた礼拝堂は自力で扉を封じた。戻された塩と灯油が、開いた街道を通った者たちと裂け道で交換され、小さな灯りの列ができている。',
        visual: 'salt-lantern'
      }
    };
    return definitions[key] || null;
  }

  function getCollisionPresentation(inputState) {
    const state = normalizeState(inputState);
    if (!isOutcomeState(state.placeStates[COLLISION_PLACE])) return null;
    const key = state.consequences[COLLISION_PLACE];
    const definition = outcomeDefinition(key);
    const source = sourcePresentation(state);
    if (!definition || !source) return null;

    return {
      id: COLLISION_PLACE,
      state: state.placeStates[COLLISION_PLACE],
      collisionKey: key,
      title: definition.title,
      mark: definition.mark,
      visual: definition.visual,
      summary: definition.summary,
      actor: source.actor,
      history: `${source.actor}を巡って始まった一連の動きが、ここまで人の流れを押し曲げている。`,
      sources: {
        chapel: {
          id: p4.SALT_CHAPEL,
          state: state.placeStates[p4.SALT_CHAPEL]
        },
        gate: {
          id: p4.RUINED_GATE,
          state: state.placeStates[p4.RUINED_GATE]
        }
      }
    };
  }

  return Object.freeze({
    STORAGE_KEY: p4.STORAGE_KEY,
    COLLISION_PLACE,
    OUTCOMES,
    OUTCOME_KEYS,
    normalizeState,
    parseState,
    serializeState,
    deriveCollisionKey,
    discoverCollisionPlace,
    createLocationSession: base.createLocationSession,
    observeCollisionLocation,
    getCollisionHintPresentation,
    getCollisionPresentation
  });
});
