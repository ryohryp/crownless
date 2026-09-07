(function (root, factory) {
  const api = factory(root && root.CrownlessRebootPhase4State);
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./reboot-phase4-state.js'));
  }
  if (root) root.CrownlessRebootPhase6Location = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (p4) {
  'use strict';
  if (!p4) throw new Error('Crownless Reboot Phase 4 state is required');

  const STEP_METERS = 40;
  const DIAGONAL_STEP_METERS = STEP_METERS / Math.sqrt(2);
  const DISCOVERY_RADIUS_METERS = 42;
  const EARTH_RADIUS_METERS = 6371000;

  const TRACE_TARGETS = Object.freeze({
    [p4.SALT_CHAPEL]: Object.freeze({ x: -90, y: -120, cue: 'valley' }),
    [p4.RUINED_GATE]: Object.freeze({ x: -150, y: 0, cue: 'road' })
  });

  const DIRECTION_DELTAS = Object.freeze({
    north: Object.freeze({ x: 0, y: STEP_METERS }),
    north_east: Object.freeze({ x: DIAGONAL_STEP_METERS, y: DIAGONAL_STEP_METERS }),
    east: Object.freeze({ x: STEP_METERS, y: 0 }),
    south_east: Object.freeze({ x: DIAGONAL_STEP_METERS, y: -DIAGONAL_STEP_METERS }),
    south: Object.freeze({ x: 0, y: -STEP_METERS }),
    south_west: Object.freeze({ x: -DIAGONAL_STEP_METERS, y: -DIAGONAL_STEP_METERS }),
    west: Object.freeze({ x: -STEP_METERS, y: 0 }),
    north_west: Object.freeze({ x: -DIAGONAL_STEP_METERS, y: DIAGONAL_STEP_METERS })
  });

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function point(input) {
    return {
      x: finite(input && input.x) ? Number(input.x) : 0,
      y: finite(input && input.y) ? Number(input.y) : 0
    };
  }

  function createSession(mode) {
    return Object.freeze({ mode: mode === 'live' ? 'live' : 'simulated', x: 0, y: 0 });
  }

  function sessionAt(input, mode) {
    const next = point(input);
    return Object.freeze({ mode: mode === 'live' ? 'live' : 'simulated', x: next.x, y: next.y });
  }

  function moveSession(inputSession, direction) {
    const delta = DIRECTION_DELTAS[direction];
    if (!delta) throw new Error('invalid movement direction');
    const current = point(inputSession);
    return sessionAt({ x: current.x + delta.x, y: current.y + delta.y }, 'simulated');
  }

  function distanceMeters(a, b) {
    const from = point(a);
    const to = point(b);
    return Math.hypot(to.x - from.x, to.y - from.y);
  }

  function strengthForDistance(distance) {
    if (distance <= DISCOVERY_RADIUS_METERS) return 'discovered';
    if (distance <= 78) return 'near';
    if (distance <= 122) return 'noticed';
    return 'far';
  }

  function directionLabel(fromInput, toInput) {
    const from = point(fromInput);
    const to = point(toInput);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 1) return 'ここ';

    const degrees = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const labels = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    return labels[Math.round(degrees / 45) % 8];
  }

  function traceCopy(placeId, strength) {
    const copy = {
      [p4.SALT_CHAPEL]: {
        far: '谷側に、風とは違うかすかな響きがある。',
        noticed: '谷側から、金属が一度だけ鳴った。',
        near: '人の気配がする。吊られた何かが、風の中で軋んでいる。',
        discovered: '谷側の気配の正体に辿り着いた。'
      },
      [p4.RUINED_GATE]: {
        far: '街道側に、薄い土煙が見える。',
        noticed: '街道側から、石を打つ乾いた音がする。',
        near: '荷車の軋みと、崩れた石を動かす音がはっきり聞こえる。',
        discovered: '街道側の気配の正体に辿り着いた。'
      }
    };
    return copy[placeId] && copy[placeId][strength] || '';
  }

  function strengthLabel(strength) {
    return ({ far: '遠い', noticed: '気づいた', near: 'すぐ近く', discovered: '発見' })[strength] || '不明';
  }

  function cueTitle(placeId) {
    return placeId === p4.SALT_CHAPEL ? '谷側の気配' : '街道側の気配';
  }

  function senseTrace(session, placeId) {
    const target = TRACE_TARGETS[placeId];
    if (!target) throw new Error('invalid trace place');
    const distance = distanceMeters(session, target);
    const strength = strengthForDistance(distance);
    return Object.freeze({
      placeId,
      cue: target.cue,
      title: cueTitle(placeId),
      direction: directionLabel(session, target),
      strength,
      strengthLabel: strengthLabel(strength),
      text: traceCopy(placeId, strength),
      distance
    });
  }

  function senseAll(session) {
    return Object.freeze([
      senseTrace(session, p4.SALT_CHAPEL),
      senseTrace(session, p4.RUINED_GATE)
    ]);
  }

  function discoveredPlace(session) {
    const discovered = senseAll(session)
      .filter((trace) => trace.strength === 'discovered')
      .sort((a, b) => a.distance - b.distance);
    return discovered.length ? discovered[0].placeId : null;
  }

  function relativeMeters(origin, sample) {
    const lat1 = Number(origin && origin.latitude);
    const lon1 = Number(origin && origin.longitude);
    const lat2 = Number(sample && sample.latitude);
    const lon2 = Number(sample && sample.longitude);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) throw new Error('invalid location sample');

    const toRadians = (degrees) => degrees * Math.PI / 180;
    const meanLat = toRadians((lat1 + lat2) / 2);
    const north = toRadians(lat2 - lat1) * EARTH_RADIUS_METERS;
    const east = toRadians(lon2 - lon1) * EARTH_RADIUS_METERS * Math.cos(meanLat);
    return Object.freeze({ x: east, y: north });
  }

  return Object.freeze({
    STEP_METERS,
    DIAGONAL_STEP_METERS,
    DISCOVERY_RADIUS_METERS,
    TRACE_TARGETS,
    createSession,
    sessionAt,
    moveSession,
    distanceMeters,
    directionLabel,
    senseTrace,
    senseAll,
    discoveredPlace,
    relativeMeters
  });
});
