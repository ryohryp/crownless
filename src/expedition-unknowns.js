(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionUnknowns = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionUnknowns() {
  "use strict";

  const DAILY_RADIUS_CELLS = 4;
  const NEARBY_RADIUS_CELLS = 28;
  const PROFILES = Object.freeze({
    daily: Object.freeze({ tier: "daily", label: "生活圏", unknownChance: 0 }),
    nearby: Object.freeze({ tier: "nearby", label: "近郊遠征", unknownChance: 0.45 }),
    long: Object.freeze({ tier: "long", label: "長距離遠征", unknownChance: 1 })
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function parseCellId(value) {
    const match = /^cell:(\d{1,2}):(\d+):(\d+)$/.exec(String(value && value.id ? value.id : value || "").trim());
    if (!match) return null;
    const zoom = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) return null;
    const size = 2 ** zoom;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return null;
    return { id: `cell:${zoom}:${x}:${y}`, zoom, x, y };
  }

  function cellDistance(left, right) {
    const a = parseCellId(left);
    const b = parseCellId(right);
    if (!a || !b || a.zoom !== b.zoom) return null;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function nearestKnownDistance(currentCell, knownCellIds) {
    const current = parseCellId(currentCell);
    if (!current) return null;
    let nearest = Infinity;
    Array.from(knownCellIds || []).forEach((value) => {
      const known = parseCellId(value);
      if (!known || known.zoom !== current.zoom || known.id === current.id) return;
      const distance = cellDistance(current, known);
      if (distance !== null && distance < nearest) nearest = distance;
    });
    return nearest;
  }

  function expeditionScore(distance) {
    if (!Number.isFinite(distance) || distance <= 0) return 0;
    if (distance <= DAILY_RADIUS_CELLS) return Math.min(24, Math.round((distance / DAILY_RADIUS_CELLS) * 24));
    if (distance <= NEARBY_RADIUS_CELLS) {
      const progress = (distance - DAILY_RADIUS_CELLS) / (NEARBY_RADIUS_CELLS - DAILY_RADIUS_CELLS);
      return 25 + Math.round(progress * 44);
    }
    return Math.min(100, 70 + Math.round(Math.log2(1 + distance - NEARBY_RADIUS_CELLS) * 7));
  }

  function expeditionProfile(currentCell, knownCellIds) {
    const current = parseCellId(currentCell);
    const distance = nearestKnownDistance(current, knownCellIds);
    let base = PROFILES.daily;
    if (Number.isFinite(distance) && distance > NEARBY_RADIUS_CELLS) base = PROFILES.long;
    else if (Number.isFinite(distance) && distance > DAILY_RADIUS_CELLS) base = PROFILES.nearby;

    return {
      ...base,
      score: expeditionScore(distance),
      nearestKnownCells: Number.isFinite(distance) ? distance : null,
      currentCellId: current ? current.id : "",
      hasBaseline: Number.isFinite(distance)
    };
  }

  function deterministicRoll(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  }

  function shouldVeilDiscovery(profile, key) {
    if (!profile || profile.unknownChance <= 0) return false;
    if (profile.unknownChance >= 1) return true;
    return deterministicRoll(`${profile.currentCellId}:${key || "unknown"}`) < profile.unknownChance;
  }

  function veilDiscovery(discovery, profile) {
    if (!discovery || typeof discovery !== "object") return discovery;
    if (discovery.mysteryIdentity) return clone(discovery);
    const resolved = clone(discovery);
    return {
      ...clone(discovery),
      title: "？",
      baseTitle: "未知地点",
      realPlaceName: "",
      signal: "羊皮紙には墨染みだけが残る。踏み込んで調べるまで、何が待つかは分からない。",
      contentKind: "mystery",
      revealState: "unknown",
      mysteryIdentity: resolved,
      expeditionTier: profile && profile.tier ? profile.tier : "daily",
      expeditionLabel: profile && profile.label ? profile.label : "生活圏"
    };
  }

  function resolveDiscovery(discovery) {
    if (!discovery || typeof discovery !== "object") return discovery;
    return discovery.mysteryIdentity && typeof discovery.mysteryIdentity === "object"
      ? clone(discovery.mysteryIdentity)
      : clone(discovery);
  }

  function applyUnknownness(discoveries, profile, isKnown) {
    const source = Array.isArray(discoveries) ? discoveries.map((item) => clone(item)) : [];
    if (!source.length || !shouldVeilDiscovery(profile, source.map((item) => item && item.sourceRef || "").join("|"))) return source;
    const index = source.findIndex((item) => item && !item.qaInjected && !(typeof isKnown === "function" && isKnown(item)));
    if (index < 0) return source;
    source[index] = veilDiscovery(source[index], profile);
    return source;
  }

  return {
    DAILY_RADIUS_CELLS,
    NEARBY_RADIUS_CELLS,
    PROFILES,
    parseCellId,
    cellDistance,
    nearestKnownDistance,
    expeditionScore,
    expeditionProfile,
    deterministicRoll,
    shouldVeilDiscovery,
    veilDiscovery,
    resolveDiscovery,
    applyUnknownness
  };
});
