(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessDiscovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDiscoveryProvider() {
  "use strict";

  const FEATURE_ORDER = ["water", "crossing", "sacred", "woods", "road_hub", "height", "coast", "settlement"];
  const DISCOVERY_SIGNAL_PRIORITY = ["crossing", "sacred", "water", "settlement", "road_hub", "woods", "height", "coast"];
  const DEFAULT_OVERPASS_ENDPOINTS = ["https://overpass.openstreetmap.jp/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"];

  function clampRisk(value) {
    return Math.max(1, Math.min(5, Number(value) || 1));
  }

  function normalizePlace(lead, index) {
    const source = lead || {};
    return {
      id: String(source.id || `discovery-${index + 1}`),
      title: String(source.title || source.name || "名もない気配"),
      signal: String(source.signal || source.type || "unknown"),
      risk: clampRisk(source.risk),
      palette: source.palette || "road",
      source
    };
  }

  function createSimulatedDiscoveryProvider(options) {
    const limit = Math.max(1, Number((options || {}).limit) || 3);
    return {
      kind: "simulated",
      discover(context) {
        const leads = Array.isArray(context && context.leads) ? context.leads : [];
        return leads.slice(0, limit).map(normalizePlace);
      }
    };
  }

  function tagsOf(feature) {
    return feature && feature.tags && typeof feature.tags === "object" ? feature.tags : {};
  }

  function featureName(tags) {
    return String(tags["name:ja"] || tags.name || "").trim();
  }

  function normalizeGeographicFeature(feature) {
    const tags = tagsOf(feature);
    const types = [];
    const add = (type) => {
      if (!types.includes(type)) types.push(type);
    };
    if (tags.natural === "water" || tags.waterway || tags.water || tags.landuse === "reservoir") add("water");
    if (tags.bridge === "yes" || tags.bridge || tags.ford === "yes" || tags.highway === "ford") add("crossing");
    if (tags.amenity === "place_of_worship" || tags.historic === "wayside_shrine" || tags.cemetery || tags.landuse === "cemetery") add("sacred");
    if (tags.natural === "wood" || tags.landuse === "forest" || tags.leisure === "park") add("woods");
    if (tags.railway === "station" || tags.public_transport === "station" || tags.highway === "traffic_signals" || tags.junction) add("road_hub");
    const towerLike = tags.man_made === "tower"
      || tags.man_made === "communications_tower"
      || tags.tourism === "viewpoint"
      || tags.historic === "tower";
    if (tags.natural === "peak" || tags.natural === "ridge" || tags.natural === "hill" || tags.ele || towerLike) add("height");
    if (tags.natural === "coastline" || tags.place === "island") add("coast");
    if (["city", "town", "village", "hamlet", "suburb", "neighbourhood", "quarter"].includes(tags.place)) add("settlement");
    return {
      id: String((feature && feature.id) || "feature"),
      name: featureName(tags),
      types: FEATURE_ORDER.filter((type) => types.includes(type))
    };
  }

  function normalizeGeographicContext(features) {
    const seen = new Set();
    const types = [];
    const namesByType = {};
    (Array.isArray(features) ? features : []).forEach((feature) => {
      const item = normalizeGeographicFeature(feature);
      item.types.forEach((type) => {
        if (!seen.has(type)) {
          seen.add(type);
          types.push(type);
        }
        if (item.name && !namesByType[type]) namesByType[type] = item.name;
      });
    });
    return { types: FEATURE_ORDER.filter((type) => types.includes(type)), namesByType };
  }

  function normalizeGeographicFeatures(features) {
    return normalizeGeographicContext(features).types;
  }

  const DISCOVERY_RULES = [
    { requires: ["water", "sacred"], signal: "水辺に、祈りの跡らしい石影が沈んでいる。", title: "沈んだ祠", risk: 3, palette: "water", kind: "event" },
    { requires: ["water", "crossing"], signal: "渡り場の向こうで、烏が同じ場所を旋回している。", title: "血濡れの渡し場", risk: 3, palette: "water", kind: "encounter" },
    { requires: ["woods", "sacred"], signal: "木立の奥から、集落のない方角で鐘が鳴った。", title: "苔むした聖域", risk: 2, palette: "woods", kind: "event" },
    { requires: ["woods"], signal: "木々の向こうに細い煙が上がっている。", title: "森の野営地", risk: 2, palette: "woods", kind: "encounter" },
    { requires: ["crossing"], signal: "古い道の狭まる場所に、人影が動かず立っている。", title: "見張られた辻", risk: 2, palette: "road", kind: "encounter" },
    { requires: ["height"], signal: "高みの輪郭に、崩れた石組みが空を切っている。", title: "崩れた物見台", risk: 3, palette: "road", kind: "dungeon" },
    { requires: ["coast"], signal: "潮の届かぬはずの場所に、濡れた木片が散っている。", title: "難破者の跡", risk: 2, palette: "water", kind: "event" },
    { requires: ["road_hub", "settlement"], signal: "幾筋もの道が集まる先に、煤けた旗が見える。", title: "灰の街道宿", risk: 1, palette: "road", kind: "event" },
    { requires: ["water"], signal: "水際に沿って、何か重いものを引きずった跡が続く。", title: "葦辺の巣穴", risk: 2, palette: "water", kind: "encounter" },
    { requires: ["sacred"], signal: "風が止むたび、欠けた石から低い音が返ってくる。", title: "忘れられた石堂", risk: 2, palette: "road", kind: "event" },
    { requires: ["road_hub"], signal: "道が交わる先だけ、土が黒く踏み固められている。", title: "黒土の辻", risk: 2, palette: "road", kind: "encounter" },
    { requires: ["settlement"], signal: "人の気配はあるのに、煙の上がらない一角がある。", title: "閉ざされた路地", risk: 2, palette: "road", kind: "event" }
  ];

  function ruleMatches(rule, features) {
    return rule.requires.every((type) => features.includes(type));
  }

  function candidateSignalRank(candidate) {
    const required = candidate && candidate.rule && Array.isArray(candidate.rule.requires) ? candidate.rule.requires : [];
    return required.reduce((best, type) => {
      const rank = DISCOVERY_SIGNAL_PRIORITY.indexOf(type);
      return rank >= 0 ? Math.min(best, rank) : best;
    }, DISCOVERY_SIGNAL_PRIORITY.length);
  }

  function selectDiverseDiscoveryCandidates(candidates, limit) {
    const source = Array.isArray(candidates) ? candidates : [];
    const max = Math.max(1, Number(limit) || 3);
    const namedGroups = new Map();
    const primaries = [];

    source.forEach((candidate, index) => {
      const realPlaceName = String(candidate && candidate.realPlaceName || "").trim();
      if (!realPlaceName) {
        primaries.push({ candidate, order: index });
        return;
      }

      const existing = namedGroups.get(realPlaceName);
      if (!existing) {
        namedGroups.set(realPlaceName, { candidate, order: index, rank: candidateSignalRank(candidate) });
        return;
      }

      const rank = candidateSignalRank(candidate);
      if (rank < existing.rank) {
        existing.candidate = candidate;
        existing.rank = rank;
      }
    });

    namedGroups.forEach((entry) => primaries.push(entry));
    primaries.sort((left, right) => left.order - right.order);

    const selected = primaries.slice(0, max).map((entry) => entry.candidate);
    if (selected.length >= max) return selected;

    const selectedSet = new Set(selected);
    for (const candidate of source) {
      if (selected.length >= max) break;
      if (selectedSet.has(candidate)) continue;
      selected.push(candidate);
      selectedSet.add(candidate);
    }
    return selected;
  }

  function discoveriesFromFeatures(features, options) {
    const settings = options || {};
    const limit = Math.max(1, Number(settings.limit) || 3);
    const normalized = Array.isArray(features) ? FEATURE_ORDER.filter((type) => features.includes(type)) : [];
    const usedPrimary = new Set();
    const matches = [];

    DISCOVERY_RULES.forEach((rule) => {
      if (!ruleMatches(rule, normalized)) return;
      const primary = rule.requires[0];
      if (rule.requires.length === 1 && usedPrimary.has(primary)) return;
      rule.requires.forEach((type) => usedPrimary.add(type));
      const names = settings.namesByType || {};
      const realPlaceName = rule.requires.map((type) => names[type]).find(Boolean) || settings.areaName || "";
      matches.push({ rule, realPlaceName });
    });

    return selectDiverseDiscoveryCandidates(matches, limit).map((candidate, index) => {
      const rule = candidate.rule;
      const realPlaceName = candidate.realPlaceName;
      return {
        id: `geo-${rule.requires.join("-")}-${index + 1}`,
        title: realPlaceName ? `${realPlaceName}の${rule.title}` : rule.title,
        baseTitle: rule.title,
        realPlaceName,
        signal: rule.signal,
        risk: rule.risk,
        palette: rule.palette,
        contentKind: rule.kind,
        revealState: "signal",
        features: rule.requires.slice()
      };
    });
  }

  function investigateDiscovery(discovery) {
    if (!discovery) return null;
    return Object.assign({}, discovery, {
      revealState: "identified",
      description: `${discovery.title}。危険度 ${clampRisk(discovery.risk)}。踏み込むか、ここで引き返せる。`
    });
  }

  function buildOverpassQuery(latitude, longitude, radius) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const metres = Math.max(100, Math.min(1500, Number(radius) || 500));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Valid latitude and longitude are required");
    return `[out:json][timeout:12];(nwr(around:${metres},${lat},${lng})[natural];nwr(around:${metres},${lat},${lng})[waterway];nwr(around:${metres},${lat},${lng})[bridge];nwr(around:${metres},${lat},${lng})[amenity=place_of_worship];nwr(around:${metres},${lat},${lng})[landuse=cemetery];nwr(around:${metres},${lat},${lng})[landuse=forest];nwr(around:${metres},${lat},${lng})[leisure=park];nwr(around:${metres},${lat},${lng})[railway=station];nwr(around:${metres},${lat},${lng})[public_transport=station];nwr(around:${metres},${lat},${lng})[man_made=tower];nwr(around:${metres},${lat},${lng})[man_made=communications_tower];nwr(around:${metres},${lat},${lng})[tourism=viewpoint];nwr(around:${metres},${lat},${lng})[historic=tower];nwr(around:${metres},${lat},${lng})[place];);out tags center;`;
  }

  function createLocationDiscoveryProvider(options) {
    const settings = options || {};
    const limit = Math.max(1, Number(settings.limit) || 3);
    const radius = Math.max(100, Math.min(1500, Number(settings.radius) || 500));
    const timeoutMs = Math.max(1000, Number(settings.timeoutMs) || 8000);
    const endpoints = Array.isArray(settings.endpoints) && settings.endpoints.length ? settings.endpoints.slice() : settings.endpoint ? [settings.endpoint] : DEFAULT_OVERPASS_ENDPOINTS.slice();
    const fetchFn = settings.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const onStatus = typeof settings.onStatus === "function" ? settings.onStatus : null;
    let lastEndpoint = "";
    let lastError = "";
    let lastStatus = { state: "idle", endpoint: "", attempt: 0, total: endpoints.length };

    function emit(status) {
      lastStatus = Object.assign({}, lastStatus, status);
      if (onStatus) onStatus(Object.assign({}, lastStatus));
    }

    async function fetchWithTimeout(endpoint, requestOptions) {
      let timer = null;
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const optionsWithSignal = controller ? Object.assign({}, requestOptions, { signal: controller.signal }) : requestOptions;
      const timeoutPromise = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          if (controller) controller.abort();
          const error = new Error(`timeout after ${timeoutMs}ms`);
          error.code = "OVERPASS_TIMEOUT";
          reject(error);
        }, timeoutMs);
      });
      try {
        return await Promise.race([Promise.resolve(fetchFn(endpoint, optionsWithSignal)), timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    return {
      kind: "location",
      get endpoint() { return lastEndpoint; },
      get error() { return lastError; },
      get status() { return Object.assign({}, lastStatus); },
      async discover(context) {
        if (!fetchFn) throw new Error("Geographic discovery is unavailable");
        const location = context && context.location;
        if (!location) throw new Error("Location is required for geographic discovery");
        const query = buildOverpassQuery(location.latitude, location.longitude, radius);
        const failures = [];
        for (let index = 0; index < endpoints.length; index += 1) {
          const endpoint = endpoints[index];
          lastEndpoint = endpoint;
          lastError = "";
          emit({ state: "requesting", endpoint, attempt: index + 1, total: endpoints.length, httpStatus: null, error: "", timedOut: false });
          try {
            const response = await fetchWithTimeout(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
              body: `data=${encodeURIComponent(query)}`
            });
            const httpStatus = response && response.status ? response.status : null;
            if (!response || !response.ok) {
              const error = new Error(`HTTP ${httpStatus || "error"}`);
              error.httpStatus = httpStatus;
              throw error;
            }
            const payload = await response.json();
            const geographic = normalizeGeographicContext(payload && payload.elements);
            const discoveries = discoveriesFromFeatures(geographic.types, { limit, namesByType: geographic.namesByType });
            lastError = "";
            emit({ state: "success", endpoint, attempt: index + 1, total: endpoints.length, httpStatus, error: "", timedOut: false, features: geographic.types.slice(), names: Object.values(geographic.namesByType).filter(Boolean), discoveries: discoveries.length });
            return discoveries;
          } catch (error) {
            const message = error && error.message ? error.message : "failed";
            const timedOut = !!(error && error.code === "OVERPASS_TIMEOUT");
            const httpStatus = error && error.httpStatus ? error.httpStatus : null;
            lastError = message;
            failures.push(`${endpoint}: ${message}`);
            emit({ state: "failed", endpoint, attempt: index + 1, total: endpoints.length, httpStatus, error: message, timedOut });
          }
        }
        lastError = failures.join(" | ");
        throw new Error(`Geographic data could not be loaded (${lastError})`);
      }
    };
  }

  return {
    FEATURE_ORDER,
    DISCOVERY_SIGNAL_PRIORITY,
    DEFAULT_OVERPASS_ENDPOINTS,
    DISCOVERY_RULES,
    normalizePlace,
    normalizeGeographicFeature,
    normalizeGeographicContext,
    normalizeGeographicFeatures,
    selectDiverseDiscoveryCandidates,
    discoveriesFromFeatures,
    investigateDiscovery,
    buildOverpassQuery,
    createSimulatedDiscoveryProvider,
    createLocationDiscoveryProvider
  };
});