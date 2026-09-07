(function (root, factory) {
  const api = factory(
    root && root.CrownlessRebootPhase4State,
    root && root.CrownlessRebootPhase6Location
  );
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./reboot-phase4-state.js'),
      require('./reboot-phase6-location.js')
    );
  }
  if (root) root.CrownlessRebootPhase7Exploration = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (p4, locationModel) {
  'use strict';
  if (!p4 || !locationModel) throw new Error('Crownless Reboot Phase 6 location model is required');

  const TREND_THRESHOLD_METERS = 8;

  const CLUE_DEFINITIONS = Object.freeze({
    [p4.SALT_CHAPEL]: Object.freeze({
      noticed: Object.freeze(['鈍い鐘の音']),
      near: Object.freeze(['湿った石と蝋の匂い', '人が息を潜める気配'])
    }),
    [p4.RUINED_GATE]: Object.freeze({
      noticed: Object.freeze(['車輪と石を打つ音']),
      near: Object.freeze(['崩れた石壁', '誰かが道を塞ぐ気配'])
    })
  });

  const STAGE_RANK = Object.freeze({ far: 0, noticed: 1, near: 2, discovered: 3 });

  function createClueMemory() {
    return Object.freeze({
      [p4.SALT_CHAPEL]: Object.freeze([]),
      [p4.RUINED_GATE]: Object.freeze([])
    });
  }

  function normalizeMemory(input) {
    const next = {};
    for (const placeId of [p4.SALT_CHAPEL, p4.RUINED_GATE]) {
      const values = input && Array.isArray(input[placeId]) ? input[placeId] : [];
      next[placeId] = Object.freeze([...new Set(values.filter((value) => typeof value === 'string'))]);
    }
    return Object.freeze(next);
  }

  function trendForDistance(previousDistance, currentDistance) {
    if (!Number.isFinite(Number(previousDistance))) return 'unknown';
    const delta = Number(previousDistance) - Number(currentDistance);
    if (delta > TREND_THRESHOLD_METERS) return 'closer';
    if (delta < -TREND_THRESHOLD_METERS) return 'farther';
    return 'steady';
  }

  function trendLabel(trend) {
    return ({
      closer: '近づいた',
      farther: '遠のいた',
      steady: 'ほぼ変わらない',
      unknown: 'まだ比べられない'
    })[trend] || 'まだ比べられない';
  }

  function cluesUnlocked(placeId, strength) {
    const definition = CLUE_DEFINITIONS[placeId] || {};
    const rank = STAGE_RANK[strength] || 0;
    const clues = [];
    if (rank >= STAGE_RANK.noticed) clues.push(...(definition.noticed || []));
    if (rank >= STAGE_RANK.near) clues.push(...(definition.near || []));
    return clues;
  }

  function remember(memoryInput, senses) {
    const memory = normalizeMemory(memoryInput);
    const next = {};
    for (const placeId of [p4.SALT_CHAPEL, p4.RUINED_GATE]) {
      const sense = senses.find((item) => item.placeId === placeId);
      next[placeId] = Object.freeze([
        ...new Set([
          ...(memory[placeId] || []),
          ...cluesUnlocked(placeId, sense ? sense.strength : 'far')
        ])
      ]);
    }
    return Object.freeze(next);
  }

  function movementNote(senses) {
    const valley = senses.find((item) => item.placeId === p4.SALT_CHAPEL);
    const road = senses.find((item) => item.placeId === p4.RUINED_GATE);
    if (!valley || !road || valley.trend === 'unknown' || road.trend === 'unknown') {
      return '少し動いて、二つの気配がどう変わるか確かめる。';
    }

    if (valley.trend === 'closer' && road.trend === 'closer') {
      return '二つの気配がともに濃くなった。分岐の間へ入り込んでいる。';
    }
    if (valley.trend === 'farther' && road.trend === 'farther') {
      return 'どちらの気配も遠のいた。いまの移動では手掛かりから離れている。';
    }
    if (valley.trend === 'closer' && road.trend === 'farther') {
      return '谷側の気配だけが濃くなった。街道側は遠のいた。';
    }
    if (road.trend === 'closer' && valley.trend === 'farther') {
      return '街道側の気配だけが濃くなった。谷側は遠のいた。';
    }
    if (valley.trend === 'closer') return '谷側の気配が濃くなった。もう一方は大きく変わらない。';
    if (road.trend === 'closer') return '街道側の気配が濃くなった。もう一方は大きく変わらない。';
    if (valley.trend === 'farther') return '谷側の気配が遠のいた。街道側は大きく変わらない。';
    if (road.trend === 'farther') return '街道側の気配が遠のいた。谷側は大きく変わらない。';
    return '二つの気配はほとんど変わらない。別の方向を試す余地がある。';
  }

  function observe(previousSession, currentSession, memoryInput) {
    const currentSenses = locationModel.senseAll(currentSession);
    const previousSenses = previousSession ? locationModel.senseAll(previousSession) : [];
    const senses = currentSenses.map((sense) => {
      const previous = previousSenses.find((item) => item.placeId === sense.placeId);
      const trend = trendForDistance(previous && previous.distance, sense.distance);
      return Object.freeze({
        ...sense,
        trend,
        trendLabel: trendLabel(trend)
      });
    });
    const memory = remember(memoryInput, senses);
    return Object.freeze({
      senses: Object.freeze(senses),
      memory,
      note: movementNote(senses)
    });
  }

  return Object.freeze({
    TREND_THRESHOLD_METERS,
    CLUE_DEFINITIONS,
    createClueMemory,
    normalizeMemory,
    trendForDistance,
    trendLabel,
    cluesUnlocked,
    remember,
    movementNote,
    observe
  });
});
