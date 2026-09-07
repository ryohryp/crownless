(function (root, factory) {
  const api = factory(root && root.CrownlessRebootPhase3State);
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./reboot-phase3-state.js'));
  }
  if (root) root.CrownlessRebootPhase4State = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (p3) {
  'use strict';
  if (!p3) throw new Error('Crownless Reboot Phase 3 state is required');

  const FORK_FIRST_VISIT = 'fork_first_visit';
  const SALT_CHAPEL = p3.SALT_CHAPEL;
  const RUINED_GATE = p3.RUINED_GATE;

  function isForkPlace(placeId) {
    return placeId === SALT_CHAPEL || placeId === RUINED_GATE;
  }

  function otherPlace(placeId) {
    if (placeId === SALT_CHAPEL) return RUINED_GATE;
    if (placeId === RUINED_GATE) return SALT_CHAPEL;
    throw new Error('invalid fork place');
  }

  function offscreenState(placeId, wasWarned) {
    if (placeId === SALT_CHAPEL) return wasWarned ? 'sealed_without_you' : 'crowded_without_you';
    if (placeId === RUINED_GATE) return wasWarned ? 'barricaded_without_you' : 'passed_without_you';
    throw new Error('invalid fork place');
  }

  function normalizeState(input) {
    const previous = p3.normalizeState(input);
    const state = {
      ...previous,
      discoveredPlaces: [...previous.discoveredPlaces],
      placeStates: { ...previous.placeStates },
      choices: { ...previous.choices, [FORK_FIRST_VISIT]: null },
      consequences: { ...previous.consequences }
    };

    const firstVisit = input && input.choices && input.choices[FORK_FIRST_VISIT];
    if (!isForkPlace(firstVisit) || !state.choices[p3.BLACK_RAVEN_HILL]) return state;

    const other = otherPlace(firstVisit);
    const visitedWasWarned = state.placeStates[firstVisit] === 'hinted_warned';
    const otherWasWarned = state.placeStates[other] === 'hinted_warned';

    state.choices[FORK_FIRST_VISIT] = firstVisit;
    state.discoveredPlaces = [...new Set([...state.discoveredPlaces, firstVisit])];
    state.placeStates[firstVisit] = visitedWasWarned ? 'discovered_warned' : 'discovered_exposed';
    state.placeStates[other] = offscreenState(other, otherWasWarned);
    state.consequences[firstVisit] = visitedWasWarned ? 'arrived_after_warning' : 'arrived_without_warning';
    state.consequences[other] = otherWasWarned ? 'changed_after_warning_without_you' : 'changed_unwarned_without_you';
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

  function discoverForkPlace(inputState, placeId) {
    if (!isForkPlace(placeId)) throw new Error('invalid fork place');
    const state = normalizeState(inputState);
    if (!state.choices[p3.BLACK_RAVEN_HILL]) throw new Error('black_raven_hill signal is required');

    const existing = state.choices[FORK_FIRST_VISIT];
    if (existing && existing !== placeId) throw new Error('first fork visit is irreversible');
    if (existing === placeId) return state;

    if (!/^hinted_(warned|exposed)$/.test(state.placeStates[placeId])) {
      throw new Error('fork place must be hinted before discovery');
    }

    const next = {
      ...state,
      choices: { ...state.choices, [FORK_FIRST_VISIT]: placeId }
    };
    return normalizeState(next);
  }

  function historyActor(state) {
    const outcome = p3.getHillOutcomePresentation(state);
    const actors = {
      king_detour_black_flag: '黒旗の一団と王兵',
      king_wagon_missing: '王の荷を巡る者たち',
      refugees_chased_uphill: '旅人と追手',
      keeper_secret_path: '先回りした密偵'
    };
    return actors[outcome && outcome.historyKey] || '丘から来る者たち';
  }

  function placeTitle(placeId) {
    return placeId === SALT_CHAPEL ? '塩の礼拝堂' : '朽ちた関門';
  }

  function stateMark(placeId, placeState) {
    const marks = {
      discovered_warned: '訪問・警戒済み',
      discovered_exposed: '訪問・無警戒',
      sealed_without_you: '独力で封鎖',
      crowded_without_you: '未訪問・混雑',
      barricaded_without_you: '独力で防衛',
      passed_without_you: '未訪問・通過痕'
    };
    return marks[placeState] || (placeId === SALT_CHAPEL ? '礼拝堂' : '関門');
  }

  function arrivalText(placeId, placeState, actor) {
    if (placeId === SALT_CHAPEL && placeState === 'discovered_warned') {
      return `丘の警告は間に合っていた。礼拝堂は扉を閉じ、灯りを落とし、${actor}が来ても動けるよう静かに備えている。`;
    }
    if (placeId === SALT_CHAPEL && placeState === 'discovered_exposed') {
      return `礼拝堂は何も知らなかった。避難する人が次々と押し寄せる中、${actor}の噂が初めてここへ届き、祈りの間は混乱し始めている。`;
    }
    if (placeId === RUINED_GATE && placeState === 'discovered_warned') {
      return `丘の警告を受けた関門では瓦礫が積まれ、街道を塞ぐ準備が進んでいる。${actor}が来る前に、通す道と止める道が選別されていた。`;
    }
    if (placeId === RUINED_GATE && placeState === 'discovered_exposed') {
      return `関門は無警戒のままだった。街道は開き、崩れた石の間には${actor}より先に誰かが通過した新しい痕跡が残っている。`;
    }
    return '';
  }

  function offscreenText(placeId, placeState) {
    if (placeId === SALT_CHAPEL && placeState === 'sealed_without_you') {
      return 'あなたが関門へ向かう間に、警告を受けていた礼拝堂は自分たちで扉を封じた。';
    }
    if (placeId === SALT_CHAPEL && placeState === 'crowded_without_you') {
      return 'あなたが関門へ向かう間に、警告のなかった礼拝堂へ人が流れ込み、静かな避難所ではなくなった。';
    }
    if (placeId === RUINED_GATE && placeState === 'barricaded_without_you') {
      return 'あなたが礼拝堂へ向かう間に、警告を受けていた関門は自力で街道を封鎖した。';
    }
    if (placeId === RUINED_GATE && placeState === 'passed_without_you') {
      return 'あなたが礼拝堂へ向かう間に、無警戒だった関門を何者かが通過した。地図には新しい通過痕だけが残った。';
    }
    return '';
  }

  function getFirstVisitPresentation(inputState) {
    const state = normalizeState(inputState);
    const firstVisit = state.choices[FORK_FIRST_VISIT];
    if (!isForkPlace(firstVisit)) return null;
    const other = otherPlace(firstVisit);
    const actor = historyActor(state);
    return {
      firstVisit,
      actor,
      visited: {
        id: firstVisit,
        title: placeTitle(firstVisit),
        state: state.placeStates[firstVisit],
        mark: stateMark(firstVisit, state.placeStates[firstVisit]),
        text: arrivalText(firstVisit, state.placeStates[firstVisit], actor)
      },
      unvisited: {
        id: other,
        title: placeTitle(other),
        state: state.placeStates[other],
        mark: stateMark(other, state.placeStates[other]),
        text: offscreenText(other, state.placeStates[other])
      }
    };
  }

  return Object.freeze({
    STORAGE_KEY: p3.STORAGE_KEY,
    FORK_FIRST_VISIT,
    SALT_CHAPEL,
    RUINED_GATE,
    normalizeState,
    parseState,
    serializeState,
    discoverForkPlace,
    getFirstVisitPresentation
  });
});
