/* Pure deterministic rules for Option C disposable prototype (Location x Async Traces).
 * Browser (window.CrownlessTraceProto) and node:test share this exact module.
 * Privacy invariant: never persist raw GPS coordinates or movement trails.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CrownlessTraceProto = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  const TICK_MS = 8 * 60 * 60 * 1000;
  const EXPIRES_MS = 5 * 24 * 60 * 60 * 1000;
  const NIGHT_EFFORT = 4;
  const COST_GENTLE = 3;
  const COST_PRY = 1;
  const COST_PRESERVE = 1;
  const GREATBOX_COST = 12;
  const PLACE_COST_NORMAL = 2;
  const PLACE_COST_GREATBOX = 4;
  const HYSTERESIS_FACTOR = 1.5;

  const STORAGE_KEYS = Object.freeze({
    walk: 'crownless-trace-proto-v1',
    sim: 'crownless-trace-proto-sim-v1',
  });

  // Transition weights per 8h tick (Muse Round 6 locked table)
  const TRANSITIONS = Object.freeze({
    intact: Object.freeze({ stay: 0.55, bloom: 0.25, disturb: 0.15, ruin: 0.05 }),
    disturbed: Object.freeze({ stay: 0.40, bloom: 0.10, disturb: 0.30, ruin: 0.20 }),
    bloomed: Object.freeze({ stay: 0.60, bloom: 0.15, disturb: 0.20, ruin: 0.05 }),
  });

  const DEFAULT_AREAS = Object.freeze([
    { id: 'home', kind: 'home', name: '自宅', color: '#7eb89a', radius: 100, gridId: 'sim_home', coarseLat: null, coarseLng: null, provisional: false, visits: 1 },
    { id: 'station', kind: 'station', name: '最寄り駅', color: '#d4a65a', radius: 150, gridId: 'sim_station', coarseLat: null, coarseLng: null, provisional: false, visits: 1 },
    { id: 'park', kind: 'park', name: '近くの公園', color: '#7ba6c7', radius: 150, gridId: 'sim_park', coarseLat: null, coarseLng: null, provisional: false, visits: 1 },
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hash01(seed, step, salt = 0) {
    let h = (Math.imul((seed | 0) ^ Math.imul((step + 1) | 0, 0x9e3779b1), 0x85ebca6b) ^ Math.imul((salt + 1) | 0, 0xc2b2ae35)) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  }

  function itemTotal(items) {
    if (!items || typeof items !== 'object') return 0;
    return Math.max(0, (Number(items.iron) || 0) + (Number(items.fang) || 0));
  }

  function cloneItems(items) {
    return {
      iron: Math.max(0, Math.floor(Number(items?.iron) || 0)),
      fang: Math.max(0, Math.floor(Number(items?.fang) || 0)),
    };
  }

  function subtractMaterials(items, count) {
    const out = cloneItems(items);
    let left = Math.max(0, Math.floor(count));
    while (left > 0 && itemTotal(out) > 0) {
      if (out.iron >= out.fang && out.iron > 0) out.iron--;
      else if (out.fang > 0) out.fang--;
      else out.iron--;
      left--;
    }
    return out;
  }

  function toCoarseGrid(rawLat, rawLng) {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const latIdx = Math.round(lat * 1000);
    const lngIdx = Math.round(lng * 1000);
    return {
      gridId: `grid_${latIdx}_${lngIdx}`,
      coarseLat: latIdx / 1000,
      coarseLng: lngIdx / 1000,
    };
  }

  function haversineMeters(lat1, lng1, lat2, lng2) {
    const toRad = d => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function makeTrace({ id, area, owner = 'ecosystem', container = 'normal', staked = false, items, state = 'intact', seed = 1001, placedAt = 0, real = false }) {
    const normalized = cloneItems(items);
    return {
      id,
      area,
      type: 'cache',
      owner,
      container: container === 'greatbox' ? 'greatbox' : 'normal',
      staked: Boolean(staked),
      items: normalized,
      initialTotal: itemTotal(normalized),
      state,
      seed: (Number(seed) || 1) >>> 0,
      placedAt,
      lastTickAt: placedAt,
      ticksApplied: 0,
      expiresAt: placedAt + EXPIRES_MS,
      real: Boolean(real),
    };
  }

  function initialState(mode = 'sim', nowMs = 1763723400000) {
    const areas = clone(DEFAULT_AREAS);
    const traces = [
      makeTrace({
        id: 't_init_station',
        area: areas[1].gridId,
        owner: 'ecosystem',
        items: { iron: 2, fang: 1 },
        seed: 48291,
        placedAt: nowMs,
      }),
      makeTrace({
        id: 't_init_park',
        area: areas[2].gridId,
        owner: 'ecosystem',
        items: { iron: 3, fang: 1 },
        seed: 71933,
        placedAt: nowMs,
      }),
    ];
    return {
      version: VERSION,
      mode: mode === 'walk' ? 'walk' : 'sim',
      nowMs,
      dayCount: 1,
      effort: NIGHT_EFFORT,
      inventory: { iron: 4, fang: 2 },
      greatboxUnlocked: false,
      areas,
      currentAreaId: mode === 'walk' ? null : 'park',
      lastGridId: null,
      lastPromotedAreaId: null,
      traces,
      carried: [],
      aftermath: [],
      pendingIncident: null,
      senseFeedback: null,
      nextSeq: 1,
    };
  }

  function parseSave(raw, expectedMode) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.areas) || !Array.isArray(parsed.traces)) return null;
      if (expectedMode && parsed.mode !== expectedMode) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function serializeSave(state) {
    return JSON.stringify(state);
  }

  function findArea(state, areaId) {
    return state?.areas?.find(a => a.id === areaId) || null;
  }

  function areaKey(area) {
    return area ? (area.gridId || area.id) : null;
  }

  function findAreaByTraceArea(state, traceArea) {
    return state?.areas?.find(a => areaKey(a) === traceArea || a.id === traceArea) || null;
  }

  function activeTraceInArea(state, area) {
    const key = areaKey(area);
    if (!key) return null;
    return state.traces.find(t => t.area === key && t.state !== 'taken') || null;
  }

  function rollTransitionOutcome(stateName, seed, tickIndex) {
    const table = TRANSITIONS[stateName];
    if (!table) return 'stay';
    const r = hash01(seed, tickIndex, 1);
    if (r < table.stay) return 'stay';
    if (r < table.stay + table.bloom) return 'bloom';
    if (r < table.stay + table.bloom + table.disturb) return 'disturb';
    return 'ruin';
  }

  function applySingleTick(trace, tickIndex) {
    if (!trace || trace.state === 'ruined' || trace.state === 'taken') return trace;
    const prevTotal = itemTotal(trace.items);
    if (prevTotal <= 0) {
      return { ...trace, state: 'ruined', items: { iron: 0, fang: 0 }, ticksApplied: trace.ticksApplied + 1 };
    }

    const next = clone(trace);
    const outcome = rollTransitionOutcome(next.state, next.seed, tickIndex);
    next.ticksApplied += 1;

    if (outcome === 'stay') {
      return next;
    }

    if (outcome === 'bloom') {
      const mult = (next.staked || next.container === 'greatbox') ? 1.6 : 1.4;
      const targetTotal = Math.max(prevTotal + 1, Math.ceil(prevTotal * mult));
      const gain = targetTotal - prevTotal;
      const fangChance = hash01(next.seed, tickIndex, 2);
      const fangAdd = gain >= 2 && fangChance < 0.45 ? 1 : (gain === 1 && fangChance < 0.3 ? 1 : 0);
      next.items.fang += fangAdd;
      next.items.iron += Math.max(0, gain - fangAdd);
      next.state = 'bloomed';
      return next;
    }

    if (outcome === 'disturb') {
      const loss = Math.max(1, Math.round(prevTotal * 0.3));
      next.items = subtractMaterials(next.items, loss);
      next.state = itemTotal(next.items) <= 0 ? 'ruined' : 'disturbed';
      return next;
    }

    // outcome === 'ruin'
    next.state = 'ruined';
    next.items = { iron: 0, fang: 0 };
    return next;
  }

  function upsertAftermath(state, entry) {
    const list = Array.isArray(state.aftermath) ? [...state.aftermath] : [];
    const idx = list.findIndex(e => e.traceId === entry.traceId);
    if (idx >= 0) list.splice(idx, 1);
    list.unshift(entry);
    state.aftermath = list.slice(0, 24);
  }

  function syncPlayerAftermath(state, trace) {
    if (!trace || trace.owner !== 'player') return;
    const total = itemTotal(trace.items);
    const delta = total - trace.initialTotal;
    const areaObj = findAreaByTraceArea(state, trace.area);
    const dayAge = Math.max(0, Math.floor((state.nowMs - trace.placedAt) / (24 * 60 * 60 * 1000)));
    upsertAftermath(state, {
      traceId: trace.id,
      areaId: areaObj?.id || trace.area,
      areaColor: areaObj?.color || '#9c8a6b',
      state: trace.state,
      delta,
      dayAge,
      updatedAt: state.nowMs,
    });
  }

  function respawnEcosystemTraces(state, ticksElapsed) {
    if (ticksElapsed <= 0) return;
    for (const area of state.areas) {
      if (area.kind === 'home' || area.provisional) continue;
      if (area.coarseLat === null && state.mode === 'walk') continue;
      const existing = activeTraceInArea(state, area);
      if (existing) continue;
      const spawnRoll = hash01(state.nextSeq * 977 + Math.floor(state.nowMs / TICK_MS), ticksElapsed, area.id.length);
      if (spawnRoll < 0.72) {
        const id = `t_eco_${state.nextSeq++}`;
        const seed = Math.floor(hash01(state.nextSeq, Math.floor(state.nowMs / 1000), 11) * 90000) + 10000;
        const iron = 1 + Math.floor(hash01(seed, 1, 12) * 3);
        const fang = hash01(seed, 1, 13) < 0.55 ? 1 : 0;
        state.traces.push(makeTrace({
          id,
          area: areaKey(area),
          owner: 'ecosystem',
          items: { iron, fang },
          seed,
          placedAt: state.nowMs,
        }));
      }
    }
  }

  function advanceTime(state, targetNowMs) {
    const next = clone(state);
    if (!Number.isFinite(targetNowMs) || targetNowMs <= next.nowMs) return next;
    let totalTicksApplied = 0;

    for (let i = 0; i < next.traces.length; i++) {
      let t = next.traces[i];
      if (t.state === 'taken' || t.state === 'ruined') continue;
      const elapsed = targetNowMs - t.lastTickAt;
      const ticks = Math.floor(elapsed / TICK_MS);
      if (ticks <= 0) continue;
      for (let step = 0; step < ticks; step++) {
        t = applySingleTick(t, t.ticksApplied);
        t.lastTickAt += TICK_MS;
        totalTicksApplied++;
        if (t.state === 'ruined') {
          t.lastTickAt = targetNowMs;
          break;
        }
      }
      if (t.state !== 'ruined' && targetNowMs >= t.expiresAt) {
        t.state = 'ruined';
        t.items = { iron: 0, fang: 0 };
      }
      next.traces[i] = t;
      syncPlayerAftermath(next, t);
    }

    next.nowMs = targetNowMs;
    if (totalTicksApplied > 0 || Math.floor(targetNowMs / TICK_MS) > Math.floor(state.nowMs / TICK_MS)) {
      respawnEcosystemTraces(next, Math.max(1, totalTicksApplied));
    }
    return next;
  }

  // Calibration: immediately round raw GPS to coarse grid; never persist rawLat/rawLng.
  function calibrateArea(state, areaId, rawLat, rawLng) {
    const coarse = toCoarseGrid(rawLat, rawLng);
    if (!coarse) return state;
    const next = clone(state);
    const area = findArea(next, areaId);
    if (!area || area.provisional) return state;
    const oldKey = area.gridId;
    area.coarseLat = coarse.coarseLat;
    area.coarseLng = coarse.coarseLng;
    area.gridId = coarse.gridId;
    for (const t of next.traces) {
      if (t.area === oldKey) t.area = coarse.gridId;
    }
    for (const c of next.carried) {
      if (c.area === oldKey) c.area = coarse.gridId;
    }
    for (const a of next.aftermath) {
      if (a.areaId === area.id && oldKey) a.areaId = area.id;
    }
    if (area.kind !== 'home' && !activeTraceInArea(next, area)) {
      const seed = Math.floor(hash01(next.nextSeq + 17, Math.floor(next.nowMs / 1000), 5) * 90000) + 10000;
      next.traces.push(makeTrace({
        id: `t_eco_${next.nextSeq++}`,
        area: area.gridId,
        owner: 'ecosystem',
        items: { iron: 2, fang: 1 },
        seed,
        placedAt: next.nowMs,
      }));
    }
    next.currentAreaId = area.id;
    next.lastGridId = coarse.gridId;
    return next;
  }

  function detectLocation(state, rawLat, rawLng, nowMs = state.nowMs) {
    const coarse = toCoarseGrid(rawLat, rawLng);
    if (!coarse) return state;
    let next = advanceTime(state, nowMs);
    next.lastGridId = coarse.gridId;
    next.lastPromotedAreaId = null;
    next.senseFeedback = null;

    // 1. Hysteresis check: if currently inside a calibrated area, stay until > radius * 1.5
    const current = findArea(next, next.currentAreaId);
    if (current && current.coarseLat !== null && current.coarseLng !== null) {
      const dist = haversineMeters(rawLat, rawLng, current.coarseLat, current.coarseLng);
      if (dist <= current.radius * HYSTERESIS_FACTOR) {
        return next;
      }
    }

    // 2. Otherwise enter the nearest calibrated area within its base radius
    let best = null;
    let bestDist = Infinity;
    for (const area of next.areas) {
      if (area.coarseLat === null || area.coarseLng === null) continue;
      const dist = haversineMeters(rawLat, rawLng, area.coarseLat, area.coarseLng);
      if (dist <= area.radius && dist < bestDist) {
        best = area;
        bestDist = dist;
      }
    }

    if (best) {
      if (best.provisional && next.currentAreaId !== best.id) {
        best.provisional = false;
        best.visits = (best.visits || 1) + 1;
        best.name = `見つけた場 (${best.gridId.slice(5, 11)})`;
        next.lastPromotedAreaId = best.id;
      }
      next.currentAreaId = best.id;
    } else {
      next.currentAreaId = null;
    }
    return next;
  }

  function setSimulatedArea(state, areaId, nowMs = state.nowMs) {
    let next = advanceTime(state, nowMs);
    next.senseFeedback = null;
    next.lastPromotedAreaId = null;
    if (!areaId || areaId === 'outside') {
      next.currentAreaId = null;
      next.lastGridId = `sim_out_${next.dayCount}_${next.nextSeq}`;
      return next;
    }
    const target = findArea(next, areaId);
    if (!target) return next;
    if (target.provisional && next.currentAreaId !== target.id) {
      target.provisional = false;
      target.visits = (target.visits || 1) + 1;
      target.name = `見つけた場`;
      next.lastPromotedAreaId = target.id;
    }
    next.currentAreaId = target.id;
    next.lastGridId = areaKey(target);
    return next;
  }

  function weightFeeling(total, real) {
    let tier = 'light';
    let text = '軽い。乾いた音がした';
    if (total >= 6) {
      tier = 'heavy';
      text = 'ずっしり重い。中で何かが動いた気がする';
    } else if (total >= 3) {
      tier = 'medium';
      text = 'ほどよい重さ。布越しに角ばった感触';
    }
    if (real) text += '（見慣れない結び目）';
    return { tier, text };
  }

  function senseCache(state, traceId, nowMs = state.nowMs) {
    let next = advanceTime(state, nowMs);
    const trace = next.traces.find(t => t.id === traceId && t.state !== 'taken');
    if (!trace) return next;
    if (trace.state === 'ruined') {
      next.senseFeedback = { traceId, tier: 'empty', text: '中身はもう消えている。冷えた跡だけが残る' };
      return next;
    }
    const total = itemTotal(trace.items);
    const feeling = weightFeeling(total, trace.real);
    next.senseFeedback = { traceId, ...feeling };

    // Low-probability immediate outdoor incident (~18%, at most once per trace)
    if (!trace.incidentDone && !next.pendingIncident) {
      const roll = hash01(trace.seed, trace.ticksApplied + 1, 41);
      if (roll < 0.18) {
        trace.incidentDone = true;
        next.pendingIncident = {
          traceId: trace.id,
          seed: (trace.seed + 137) >>> 0,
          text: '包みの中から小獣が飛び出した！',
        };
      }
    }
    return next;
  }

  function resolveIncident(state, choice) {
    if (!state.pendingIncident) return state;
    const next = clone(state);
    const inc = next.pendingIncident;
    next.pendingIncident = null;

    if (choice === 'release') {
      next.senseFeedback = { traceId: inc.traceId, tier: 'light', text: '獣をやり過ごした。荷は無事だ' };
      return next;
    }

    if (choice === 'catch') {
      const success = hash01(inc.seed, next.dayCount, 53) < 0.65;
      if (success) {
        next.inventory.fang += 1;
        next.senseFeedback = { traceId: inc.traceId, tier: 'heavy', text: 'うまく押さえた！ 狼牙を1つ得た' };
      } else {
        if (itemTotal(next.inventory) > 0) {
          next.inventory = subtractMaterials(next.inventory, 1);
          next.senseFeedback = { traceId: inc.traceId, tier: 'medium', text: '引っかかれて逃げられた。素材を1つ落とした' };
        } else {
          next.senseFeedback = { traceId: inc.traceId, tier: 'light', text: '引っかかれて逃げられた。手持ちは空だった' };
        }
      }
    }
    return next;
  }

  function placeCache(state, options = {}, nowMs = state.nowMs) {
    let next = advanceTime(state, nowMs);
    const container = options.container === 'greatbox' && next.greatboxUnlocked ? 'greatbox' : 'normal';
    const cost = container === 'greatbox' ? PLACE_COST_GREATBOX : PLACE_COST_NORMAL;
    if (itemTotal(next.inventory) < cost) return state;

    let area = findArea(next, next.currentAreaId);
    if (!area) {
      // Outside the 3 registered areas: allow placing only, creating a provisional area
      const gridId = next.lastGridId || `grid_out_${next.nextSeq}`;
      const coarse = options.rawLat != null ? toCoarseGrid(options.rawLat, options.rawLng) : null;
      const existingProv = next.areas.find(a => a.gridId === (coarse?.gridId || gridId));
      if (existingProv) {
        area = existingProv;
      } else {
        area = {
          id: `prov_${next.nextSeq}`,
          kind: 'provisional',
          name: '仮の場',
          color: '#9c8a6b',
          radius: 150,
          gridId: coarse?.gridId || gridId,
          coarseLat: coarse?.coarseLat ?? null,
          coarseLng: coarse?.coarseLng ?? null,
          provisional: true,
          visits: 1,
        };
        next.areas.push(area);
      }
      next.currentAreaId = area.id;
    }

    if (activeTraceInArea(next, area)) return state;

    const beforeTotal = itemTotal(next.inventory);
    const afterInv = subtractMaterials(next.inventory, cost);
    const placedItems = {
      iron: next.inventory.iron - afterInv.iron,
      fang: next.inventory.fang - afterInv.fang,
    };
    next.inventory = afterInv;
    if (itemTotal(placedItems) !== cost || beforeTotal < cost) return state;

    const id = `t_${next.nextSeq++}`;
    const seed = ((next.nextSeq * 2654435761) ^ Math.floor(nowMs / 1000)) >>> 0 || 13579;
    const trace = makeTrace({
      id,
      area: areaKey(area),
      owner: 'player',
      container,
      staked: false,
      items: placedItems,
      seed,
      placedAt: nowMs,
      real: Boolean(options.real),
    });
    next.traces.push(trace);
    syncPlayerAftermath(next, trace);
    next.senseFeedback = { traceId: id, tier: 'medium', text: area.provisional ? '仮の場にそっと置いた。次に戻れば拾える' : '置き荷を場に伏せた' };
    return next;
  }

  function stakeCache(state, traceId, nowMs = state.nowMs) {
    let next = advanceTime(state, nowMs);
    const area = findArea(next, next.currentAreaId);
    if (!area || area.provisional) return state;
    const trace = next.traces.find(t => t.id === traceId && t.area === areaKey(area) && t.state !== 'taken' && t.state !== 'ruined');
    if (!trace || trace.staked || itemTotal(next.inventory) < 1) return state;

    const afterInv = subtractMaterials(next.inventory, 1);
    trace.items.iron += next.inventory.iron - afterInv.iron;
    trace.items.fang += next.inventory.fang - afterInv.fang;
    trace.initialTotal += 1;
    trace.staked = true;
    next.inventory = afterInv;
    syncPlayerAftermath(next, trace);
    next.senseFeedback = { traceId: trace.id, tier: 'heavy', text: '素材を1つ足して重みを増した' };
    return next;
  }

  function pickupCache(state, traceId, nowMs = state.nowMs) {
    let next = advanceTime(state, nowMs);
    const area = findArea(next, next.currentAreaId);
    if (!area || area.provisional) return state;
    const trace = next.traces.find(t => t.id === traceId && t.area === areaKey(area) && t.state !== 'taken');
    if (!trace) return state;

    if (trace.state === 'ruined') {
      trace.state = 'taken';
      syncPlayerAftermath(next, trace);
      next.senseFeedback = { traceId: trace.id, tier: 'empty', text: '跡を片付けた。中は空だった' };
      return next;
    }

    next.carried.push({
      carryId: `c_${next.nextSeq++}`,
      traceId: trace.id,
      area: trace.area,
      areaId: area.id,
      areaName: area.name,
      areaColor: area.color,
      owner: trace.owner,
      items: cloneItems(trace.items),
      initialTotal: trace.initialTotal,
      state: trace.state,
      seed: trace.seed,
      placedAt: trace.placedAt,
      pickedAt: nowMs,
      preserved: false,
      real: trace.real,
    });
    trace.state = 'taken';
    next.senseFeedback = { traceId: trace.id, tier: weightFeeling(itemTotal(trace.items), trace.real).tier, text: '背嚢に収めた。夜に自宅で開けよう' };
    return next;
  }

  function injectRealDemoTrace(state, nowMs = state.nowMs) {
    let next = advanceTime(state, nowMs);
    const area = findArea(next, next.currentAreaId) || findArea(next, 'station');
    if (!area) return state;
    // Remove non-player trace in that area if needed so demo trace is visible right away
    next.traces = next.traces.filter(t => !(t.area === areaKey(area) && t.owner !== 'player' && t.state !== 'taken'));
    if (activeTraceInArea(next, area)) return state;
    const id = `t_real_${next.nextSeq++}`;
    next.traces.push(makeTrace({
      id,
      area: areaKey(area),
      owner: 'other_real_demo',
      items: { iron: 2, fang: 2 },
      seed: 91307 + next.nextSeq,
      placedAt: nowMs,
      real: true,
    }));
    next.senseFeedback = { traceId: id, tier: 'medium', text: '検証用：見慣れない結び目の荷を置いた' };
    return next;
  }

  function openGentle(state, carryId) {
    const next = clone(state);
    if (next.effort < COST_GENTLE) return state;
    const idx = next.carried.findIndex(c => c.carryId === carryId);
    if (idx < 0) return state;
    const carry = next.carried.splice(idx, 1)[0];
    next.effort -= COST_GENTLE;
    next.inventory.iron += carry.items.iron;
    next.inventory.fang += carry.items.fang;
    const gained = itemTotal(carry.items);
    const delta = carry.owner === 'player' ? gained - carry.initialTotal : gained;
    const dayAge = Math.max(0, Math.floor((next.nowMs - carry.placedAt) / (24 * 60 * 60 * 1000)));
    upsertAftermath(next, {
      traceId: carry.traceId,
      areaId: carry.areaId,
      areaColor: carry.areaColor,
      state: carry.state === 'bloomed' ? 'bloomed' : 'intact',
      delta,
      dayAge,
      outcome: 'gentle',
      updatedAt: next.nowMs,
    });
    return {
      state: next,
      result: { outcome: 'gentle', items: carry.items, spilled: 0, message: `そっと開けた（鉄片+${carry.items.iron} / 牙+${carry.items.fang}）` },
    };
  }

  function openPry(state, carryId) {
    const next = clone(state);
    if (next.effort < COST_PRY) return state;
    const idx = next.carried.findIndex(c => c.carryId === carryId);
    if (idx < 0) return state;
    const carry = next.carried.splice(idx, 1)[0];
    next.effort -= COST_PRY;
    const total = itemTotal(carry.items);
    const r = hash01(carry.seed, next.dayCount + carry.carryId.length, 77);
    const dayAge = Math.max(0, Math.floor((next.nowMs - carry.placedAt) / (24 * 60 * 60 * 1000)));

    if (r < 0.50) {
      next.inventory.iron += carry.items.iron;
      next.inventory.fang += carry.items.fang;
      const delta = carry.owner === 'player' ? total - carry.initialTotal : total;
      upsertAftermath(next, {
        traceId: carry.traceId, areaId: carry.areaId, areaColor: carry.areaColor,
        state: carry.state === 'bloomed' ? 'bloomed' : 'intact', delta, dayAge, outcome: 'pry_clean', updatedAt: next.nowMs,
      });
      return {
        state: next,
        result: { outcome: 'pry_clean', items: carry.items, spilled: 0, message: `こじ開け成功！（鉄片+${carry.items.iron} / 牙+${carry.items.fang}）` },
      };
    }

    if (r < 0.85) {
      const loss = Math.max(1, Math.round(total * 0.3));
      const kept = subtractMaterials(carry.items, loss);
      next.inventory.iron += kept.iron;
      next.inventory.fang += kept.fang;
      const keptTotal = itemTotal(kept);
      const delta = carry.owner === 'player' ? keptTotal - carry.initialTotal : keptTotal;
      upsertAftermath(next, {
        traceId: carry.traceId, areaId: carry.areaId, areaColor: carry.areaColor,
        state: 'disturbed', delta, dayAge, outcome: 'pry_damaged', updatedAt: next.nowMs,
      });
      return {
        state: next,
        result: { outcome: 'pry_damaged', items: kept, lost: loss, spilled: 0, message: `一部破損（-${loss}）しつつ回収（鉄片+${kept.iron} / 牙+${kept.fang}）` },
      };
    }

    // 15% trap triggered: total loss + 1 material spilled from inventory
    const beforeInv = itemTotal(next.inventory);
    next.inventory = subtractMaterials(next.inventory, 1);
    const spilled = beforeInv - itemTotal(next.inventory);
    const delta = carry.owner === 'player' ? -carry.initialTotal - spilled : -spilled;
    upsertAftermath(next, {
      traceId: carry.traceId, areaId: carry.areaId, areaColor: carry.areaColor,
      state: 'ruined', delta, dayAge, outcome: 'pry_trap', updatedAt: next.nowMs,
    });
    return {
      state: next,
      result: { outcome: 'pry_trap', items: { iron: 0, fang: 0 }, spilled, message: `仕掛けが作動！ 中身全滅${spilled ? '＆手持ち素材 -1' : ''}` },
    };
  }

  function preserveCarry(state, carryId) {
    const next = clone(state);
    if (next.effort < COST_PRESERVE) return state;
    const carry = next.carried.find(c => c.carryId === carryId);
    if (!carry || carry.preserved) return state;
    next.effort -= COST_PRESERVE;
    carry.preserved = true;
    return next;
  }

  function endNight(state) {
    const next = clone(state);
    const surviving = [];
    const reports = [];

    for (const carry of next.carried) {
      if (carry.preserved) {
        carry.preserved = false;
        surviving.push(carry);
        continue;
      }
      const origTotal = itemTotal(carry.items);
      // 10% overnight decay
      const decay = Math.max(1, Math.round(origTotal * 0.1));
      let afterDecay = subtractMaterials(carry.items, decay);
      let nextState = 'disturbed';
      if (itemTotal(afterDecay) <= 0) {
        nextState = 'ruined';
      } else {
        // Also roll under the 'disturbed' transition row inside home
        const pseudoTrace = {
          ...carry,
          items: afterDecay,
          state: 'disturbed',
          ticksApplied: next.dayCount + carry.carryId.length,
        };
        const rolled = applySingleTick(pseudoTrace, pseudoTrace.ticksApplied);
        afterDecay = rolled.items;
        nextState = rolled.state;
      }

      const dayAge = Math.max(0, Math.floor((next.nowMs - carry.placedAt) / (24 * 60 * 60 * 1000)));
      if (nextState === 'ruined' || itemTotal(afterDecay) <= 0) {
        upsertAftermath(next, {
          traceId: carry.traceId, areaId: carry.areaId, areaColor: carry.areaColor,
          state: 'ruined', delta: carry.owner === 'player' ? -carry.initialTotal : -origTotal, dayAge, outcome: 'night_ruined', updatedAt: next.nowMs,
        });
        reports.push(`${carry.areaName}の荷が傷みきって消えた`);
      } else {
        carry.items = afterDecay;
        carry.state = nextState;
        surviving.push(carry);
        const diff = itemTotal(afterDecay) - origTotal;
        reports.push(`${carry.areaName}の荷が翌晩へ持ち越された（${diff >= 0 ? `+${diff}` : diff}）`);
      }
    }

    next.carried = surviving;
    next.effort = NIGHT_EFFORT;
    next.dayCount += 1;
    return { state: next, reports };
  }

  function craftGreatbox(state) {
    if (state.greatboxUnlocked || itemTotal(state.inventory) < GREATBOX_COST) return state;
    const next = clone(state);
    next.inventory = subtractMaterials(next.inventory, GREATBOX_COST);
    next.greatboxUnlocked = true;
    return next;
  }

  return {
    VERSION,
    TICK_MS,
    EXPIRES_MS,
    NIGHT_EFFORT,
    COST_GENTLE,
    COST_PRY,
    COST_PRESERVE,
    GREATBOX_COST,
    PLACE_COST_NORMAL,
    PLACE_COST_GREATBOX,
    HYSTERESIS_FACTOR,
    STORAGE_KEYS,
    TRANSITIONS,
    itemTotal,
    toCoarseGrid,
    haversineMeters,
    hash01,
    rollTransitionOutcome,
    applySingleTick,
    initialState,
    parseSave,
    serializeSave,
    findArea,
    areaKey,
    activeTraceInArea,
    advanceTime,
    calibrateArea,
    detectLocation,
    setSimulatedArea,
    senseCache,
    resolveIncident,
    placeCache,
    stakeCache,
    pickupCache,
    injectRealDemoTrace,
    openGentle,
    openPry,
    preserveCarry,
    endNight,
    craftGreatbox,
  };
});
