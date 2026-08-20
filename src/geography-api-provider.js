(function (root, factory) {
  "use strict";
  const api = factory(root && root.CrownlessDiscovery, typeof module === "object" && module.exports ? require("./discovery-provider.js") : null);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessGeographyApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGeographyApiProvider(browserDiscovery, nodeDiscovery) {
  "use strict";

  const Discovery = browserDiscovery || nodeDiscovery;
  const DEFAULT_PROXY_ENDPOINT = "https://crownless-iota.vercel.app/api/geography";

  function formatAttemptErrors(attempts) {
    return (Array.isArray(attempts) ? attempts : [])
      .filter((attempt) => attempt && attempt.state === "failed")
      .map((attempt) => `${attempt.endpoint}: ${attempt.error || "failed"}`)
      .join(" | ");
  }

  function validCoordinate(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
      ? { latitude: lat, longitude: lon }
      : null;
  }

  function representativeCoordinate(feature) {
    if (!feature) return null;
    const direct = validCoordinate(feature.lat, feature.lon);
    if (direct) return direct;
    return validCoordinate(feature.center && feature.center.lat, feature.center && feature.center.lon);
  }

  function sourceFeatureRef(feature, fallbackId) {
    const type = String(feature && feature.type || "").trim().toLowerCase();
    const id = String(feature && feature.id != null ? feature.id : fallbackId != null ? fallbackId : "").trim();
    if (!id) return "";
    if (["node", "way", "relation"].includes(type)) return `${type}:${id}`;
    return `feature:${id}`;
  }

  function featureCandidates(elements) {
    return (Array.isArray(elements) ? elements : []).map((element, index) => {
      const normalized = Discovery && typeof Discovery.normalizeGeographicFeature === "function"
        ? Discovery.normalizeGeographicFeature(element)
        : { id: String((element && element.id) || index), name: "", types: [] };
      return {
        index,
        id: normalized.id,
        sourceRef: sourceFeatureRef(element, normalized.id),
        name: normalized.name,
        types: normalized.types,
        coordinate: representativeCoordinate(element)
      };
    }).filter((candidate) => candidate.coordinate);
  }

  function sharesFeature(discovery, candidate) {
    const discoveryFeatures = Array.isArray(discovery && discovery.features) ? discovery.features : [];
    const candidateTypes = Array.isArray(candidate && candidate.types) ? candidate.types : [];
    return discoveryFeatures.some((feature) => candidateTypes.includes(feature));
  }

  function pickCandidate(discovery, candidates, used) {
    const placeName = String(discovery && discovery.realPlaceName || "").trim();
    const unused = (predicate) => candidates.find((candidate) => !used.has(candidate.index) && predicate(candidate));
    return (placeName && unused((candidate) => candidate.name === placeName && sharesFeature(discovery, candidate)))
      || unused((candidate) => sharesFeature(discovery, candidate))
      || (placeName && unused((candidate) => candidate.name === placeName))
      || candidates.find((candidate) => placeName && candidate.name === placeName && sharesFeature(discovery, candidate))
      || candidates.find((candidate) => sharesFeature(discovery, candidate))
      || null;
  }

  function decorateDiscoveriesWithMapData(discoveries, elements, location) {
    const origin = validCoordinate(location && location.latitude, location && location.longitude);
    const candidates = featureCandidates(elements);
    const used = new Set();
    return (Array.isArray(discoveries) ? discoveries : []).map((discovery) => {
      const candidate = pickCandidate(discovery, candidates, used);
      if (candidate) used.add(candidate.index);
      return Object.assign({}, discovery, {
        sourceRef: candidate ? candidate.sourceRef : "",
        representativeCoordinate: candidate ? Object.assign({}, candidate.coordinate) : null,
        mapOrigin: origin ? Object.assign({}, origin) : null
      });
    });
  }

  function createProxyLocationDiscoveryProvider(options) {
    const settings = options || {};
    const limit = Math.max(1, Number(settings.limit) || 3);
    const radius = Math.max(100, Math.min(1500, Number(settings.radius) || 500));
    const timeoutMs = Math.max(1000, Number(settings.timeoutMs) || 22000);
    const proxyEndpoint = settings.endpoint || DEFAULT_PROXY_ENDPOINT;
    const fetchFn = settings.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const onStatus = typeof settings.onStatus === "function" ? settings.onStatus : null;
    let lastEndpoint = proxyEndpoint;
    let lastError = "";
    let lastStatus = { state: "idle", endpoint: proxyEndpoint, attempt: 0, total: 0 };

    function emit(status) {
      lastStatus = Object.assign({}, lastStatus, status);
      if (onStatus) onStatus(Object.assign({}, lastStatus));
    }

    async function fetchJsonWithTimeout(url) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      let timer = null;
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`geography API timeout after ${timeoutMs}ms`);
          error.code = "GEOGRAPHY_API_TIMEOUT";
          // Settle our timeout promise before aborting fetch. Some browsers reject
          // fetch synchronously on abort and otherwise surface the unhelpful
          // "signal is aborted without reason" error instead of our timeout.
          reject(error);
          if (controller) controller.abort(error);
        }, timeoutMs);
      });
      try {
        const response = await Promise.race([
          Promise.resolve(fetchFn(url, controller ? { method: "GET", signal: controller.signal } : { method: "GET" })),
          timeout
        ]);
        let payload = null;
        try { payload = response && typeof response.json === "function" ? await response.json() : null; } catch (_) { payload = null; }
        return { response, payload };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    return {
      kind: "location-proxy",
      get endpoint() { return lastEndpoint; },
      get error() { return lastError; },
      get status() { return Object.assign({}, lastStatus); },
      async discover(context) {
        if (!Discovery) throw new Error("Discovery rules are unavailable");
        if (!fetchFn) throw new Error("Geographic discovery API is unavailable");
        const location = context && context.location;
        if (!location) throw new Error("Location is required for geographic discovery");

        const url = new URL(proxyEndpoint);
        url.searchParams.set("lat", String(location.latitude));
        url.searchParams.set("lng", String(location.longitude));
        url.searchParams.set("radius", String(radius));
        lastEndpoint = proxyEndpoint;
        lastError = "";
        emit({ state: "requesting", endpoint: proxyEndpoint, attempt: 1, total: 1, httpStatus: null, error: "", timedOut: false });

        try {
          const result = await fetchJsonWithTimeout(url.toString());
          const response = result.response;
          const payload = result.payload || {};
          const httpStatus = response && response.status ? response.status : null;
          const attempts = Array.isArray(payload.attempts) ? payload.attempts : [];
          if (!response || !response.ok) {
            const upstreamError = formatAttemptErrors(attempts);
            const error = new Error(upstreamError || payload.error || `HTTP ${httpStatus || "error"}`);
            error.httpStatus = httpStatus;
            error.attempts = attempts;
            throw error;
          }

          const elements = Array.isArray(payload.elements) ? payload.elements : [];
          const geographic = Discovery.normalizeGeographicContext(elements);
          const ruleDiscoveries = Discovery.discoveriesFromFeatures(geographic.types, { limit, namesByType: geographic.namesByType });
          const discoveries = decorateDiscoveriesWithMapData(ruleDiscoveries, elements, location);
          const successfulAttempt = attempts.find((attempt) => attempt && attempt.state === "success");
          lastEndpoint = payload.endpoint || (successfulAttempt && successfulAttempt.endpoint) || proxyEndpoint;
          lastError = "";
          emit({
            state: "success",
            endpoint: lastEndpoint,
            attempt: attempts.length || 1,
            total: Number(payload.total) || attempts.length || 1,
            httpStatus: successfulAttempt && successfulAttempt.httpStatus ? successfulAttempt.httpStatus : httpStatus,
            error: "",
            timedOut: false,
            features: geographic.types.slice(),
            names: Object.values(geographic.namesByType).filter(Boolean),
            discoveries: discoveries.length
          });
          return discoveries;
        } catch (error) {
          const attempts = Array.isArray(error && error.attempts) ? error.attempts : [];
          const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;
          lastEndpoint = (lastAttempt && lastAttempt.endpoint) || proxyEndpoint;
          lastError = formatAttemptErrors(attempts) || (error && error.message ? error.message : "failed");
          emit({
            state: "failed",
            endpoint: lastEndpoint,
            attempt: attempts.length || 1,
            total: Number(error && error.total) || attempts.length || 1,
            httpStatus: (lastAttempt && lastAttempt.httpStatus) || (error && error.httpStatus) || null,
            error: lastError,
            timedOut: !!(error && error.code === "GEOGRAPHY_API_TIMEOUT") || !!(lastAttempt && lastAttempt.timedOut)
          });
          throw error;
        }
      }
    };
  }

  return {
    DEFAULT_PROXY_ENDPOINT,
    validCoordinate,
    representativeCoordinate,
    sourceFeatureRef,
    decorateDiscoveriesWithMapData,
    createProxyLocationDiscoveryProvider
  };
});