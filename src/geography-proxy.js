"use strict";

// Geography enriches exploration asynchronously after GPS acquisition. Race
// independent public Overpass instances so one degraded service does not consume
// the whole enrichment window. The UI remains playable while this completes.
const DEFAULT_OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
const DEFAULT_TIMEOUT_MS = 15000;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 12;
const METRES_PER_LATITUDE_DEGREE = 111320;

function parseCoordinate(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`Invalid ${label}`);
    error.code = "INVALID_LOCATION";
    throw error;
  }
  return number;
}

function normalizeRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 650;
  return Math.max(100, Math.min(1500, number));
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function buildBoundingBox(latitude, longitude, radius) {
  const lat = parseCoordinate(latitude, -90, 90, "latitude");
  const lng = parseCoordinate(longitude, -180, 180, "longitude");
  const metres = normalizeRadius(radius);
  const latitudeDelta = metres / METRES_PER_LATITUDE_DEGREE;
  const longitudeScale = Math.abs(Math.cos(lat * Math.PI / 180));

  // Near the poles or the antimeridian, keep the exact-radius query instead of
  // manufacturing an invalid or heavily distorted bounding box.
  if (longitudeScale < 0.1) return null;
  const longitudeDelta = metres / (METRES_PER_LATITUDE_DEGREE * longitudeScale);
  if (lng - longitudeDelta < -180 || lng + longitudeDelta > 180) return null;

  return [
    roundCoordinate(Math.max(-90, lat - latitudeDelta)),
    roundCoordinate(lng - longitudeDelta),
    roundCoordinate(Math.min(90, lat + latitudeDelta)),
    roundCoordinate(lng + longitudeDelta)
  ];
}

function buildSignalQuery(spatialFilter) {
  // Discovery only needs enough real-world signals to create up to three
  // choices. Query relevant tagged objects directly instead of materializing
  // every object in a dense area. Nodes already carry coordinates and Overpass
  // supplies a lightweight center for ways; relations stay excluded to keep the
  // enrichment query small and avoid pulling complete GIS geometry.
  return `nw(${spatialFilter})[natural~"^(water|wood|peak|ridge|hill|coastline)$"];`
    + `nw(${spatialFilter})[waterway];`
    + `nw(${spatialFilter})[bridge];`
    + `nw(${spatialFilter})[amenity=place_of_worship];`
    + `nw(${spatialFilter})[landuse~"^(cemetery|forest)$"];`
    + `nw(${spatialFilter})[leisure=park];`
    + `nw(${spatialFilter})[railway=station];`
    + `nw(${spatialFilter})[public_transport=station];`
    + `nw(${spatialFilter})[place~"^(city|town|village|hamlet|suburb|neighbourhood|quarter|island)$"];`;
}

function buildAroundQuery(latitude, longitude, radius) {
  const lat = parseCoordinate(latitude, -90, 90, "latitude");
  const lng = parseCoordinate(longitude, -180, 180, "longitude");
  const metres = normalizeRadius(radius);
  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];(`
    + buildSignalQuery(`around:${metres},${lat},${lng}`)
    + `);out tags center qt;`;
}

function buildOverpassQuery(latitude, longitude, radius) {
  const bounds = buildBoundingBox(latitude, longitude, radius);
  if (!bounds) return buildAroundQuery(latitude, longitude, radius);

  // A bbox is cheaper than repeatedly evaluating an around-distance filter, and
  // applying the selective tag filters directly avoids the dense-area failure
  // mode where PR #99 first loaded every node and way into a named set.
  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];(`
    + buildSignalQuery(bounds.join(","))
    + `);out tags center qt;`;
}

function classifyUpstreamFailure(error) {
  if (error && error.code === "OVERPASS_TIMEOUT") return "timeout";
  if (error && error.httpStatus) return "http";
  if (error && (error.name === "AbortError" || error.code === "ABORT_ERR")) return "aborted";
  return "network";
}

async function fetchWithTimeout(fetchFn, endpoint, options, timeoutMs, parentSignal) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timer = null;
  let onParentAbort = null;
  const requestOptions = controller ? Object.assign({}, options, { signal: controller.signal }) : options;
  if (controller && parentSignal) {
    onParentAbort = () => controller.abort(parentSignal.reason);
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`timeout after ${timeoutMs}ms`);
      error.code = "OVERPASS_TIMEOUT";
      reject(error);
      if (controller) controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(fetchFn(endpoint, requestOptions)), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    if (parentSignal && onParentAbort) parentSignal.removeEventListener("abort", onParentAbort);
  }
}

async function requestGeography(options) {
  const settings = options || {};
  const fetchFn = settings.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
  if (!fetchFn) throw new Error("Geographic upstream fetch is unavailable");

  const latitude = parseCoordinate(settings.latitude, -90, 90, "latitude");
  const longitude = parseCoordinate(settings.longitude, -180, 180, "longitude");
  const radius = normalizeRadius(settings.radius);
  const timeoutMs = Math.max(1000, Number(settings.timeoutMs) || DEFAULT_TIMEOUT_MS);
  const endpoints = Array.isArray(settings.endpoints) && settings.endpoints.length
    ? settings.endpoints.slice()
    : DEFAULT_OVERPASS_ENDPOINTS.slice();
  const query = buildOverpassQuery(latitude, longitude, radius);
  const attemptsByIndex = new Array(endpoints.length);
  const raceStartedAt = Date.now();
  const raceController = typeof AbortController === "function" ? new AbortController() : null;

  const requests = endpoints.map(async (endpoint, index) => {
    const startedAt = Date.now();
    try {
      const response = await fetchWithTimeout(fetchFn, endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "Crownless/0.1 (+https://crownless-iota.vercel.app/)"
        },
        body: `data=${encodeURIComponent(query)}`
      }, timeoutMs, raceController && raceController.signal);
      const httpStatus = response && response.status ? response.status : null;
      if (!response || !response.ok) {
        const error = new Error(`HTTP ${httpStatus || "error"}`);
        error.httpStatus = httpStatus;
        throw error;
      }
      const payload = await response.json();
      const attempt = {
        endpoint,
        state: "success",
        httpStatus,
        error: "",
        timedOut: false,
        failureKind: "",
        durationMs: Math.max(0, Date.now() - startedAt)
      };
      attemptsByIndex[index] = attempt;
      return { endpoint, payload, attempt };
    } catch (error) {
      const attempt = {
        endpoint,
        state: "failed",
        httpStatus: error && error.httpStatus ? error.httpStatus : null,
        error: error && error.message ? error.message : "failed",
        timedOut: !!(error && error.code === "OVERPASS_TIMEOUT"),
        failureKind: classifyUpstreamFailure(error),
        durationMs: Math.max(0, Date.now() - startedAt)
      };
      attemptsByIndex[index] = attempt;
      throw Object.assign(new Error(attempt.error), { attempt, cause: error });
    }
  });

  try {
    const winner = await Promise.any(requests);
    if (raceController) raceController.abort(new Error("geography upstream winner selected"));

    // Do not wait for losing fetches: some runtimes ignore AbortSignal until the
    // socket settles. Record pending losers as cancelled so diagnostics still
    // describe every configured endpoint without extending the enrichment wait.
    endpoints.forEach((endpoint, index) => {
      if (attemptsByIndex[index]) return;
      attemptsByIndex[index] = {
        endpoint,
        state: "cancelled",
        httpStatus: null,
        error: "cancelled after winner",
        timedOut: false,
        failureKind: "aborted",
        durationMs: Math.max(0, Date.now() - raceStartedAt)
      };
    });

    return {
      elements: Array.isArray(winner.payload && winner.payload.elements) ? winner.payload.elements : [],
      endpoint: winner.endpoint,
      attempts: attemptsByIndex.slice(),
      total: endpoints.length,
      timeoutMs
    };
  } catch (aggregateError) {
    if (raceController) raceController.abort(aggregateError);
    await Promise.allSettled(requests);
    const attempts = attemptsByIndex.filter(Boolean);
    const error = new Error("Geographic upstreams could not be loaded");
    error.code = "GEOGRAPHY_UPSTREAM_FAILED";
    error.attempts = attempts;
    error.total = endpoints.length;
    error.timeoutMs = timeoutMs;
    throw error;
  }
}

function setHeader(res, name, value) {
  if (res && typeof res.setHeader === "function") res.setHeader(name, value);
}

function sendJson(res, statusCode, payload) {
  if (res && typeof res.status === "function" && typeof res.json === "function") return res.status(statusCode).json(payload);
  if (res) {
    res.statusCode = statusCode;
    setHeader(res, "Content-Type", "application/json; charset=utf-8");
    if (typeof res.end === "function") res.end(JSON.stringify(payload));
  }
  return undefined;
}

function logUpstreamState(logger, level, payload) {
  if (!logger || typeof logger[level] !== "function") return;
  logger[level](JSON.stringify(Object.assign({ event: "geography_upstream_state" }, payload)));
}

function createGeographyHandler(options) {
  const settings = options || {};
  const logger = settings.logger || console;
  return async function geographyHandler(req, res) {
    setHeader(res, "Access-Control-Allow-Origin", "*");
    setHeader(res, "Access-Control-Allow-Methods", "GET, OPTIONS");
    setHeader(res, "Access-Control-Allow-Headers", "Content-Type");
    setHeader(res, "Cache-Control", "private, no-store");

    if (req && req.method === "OPTIONS") {
      if (res) res.statusCode = 204;
      if (res && typeof res.end === "function") res.end();
      return;
    }
    if (!req || req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

    const query = req.query || {};
    try {
      const result = await requestGeography({
        latitude: query.lat,
        longitude: query.lng,
        radius: query.radius,
        fetch: settings.fetch,
        endpoints: settings.endpoints,
        timeoutMs: settings.timeoutMs
      });
      const degraded = result.attempts.some((attempt) => attempt.state === "failed");
      if (degraded) {
        logUpstreamState(logger, "warn", {
          state: "fallback_success",
          endpoint: result.endpoint,
          attempts: result.attempts,
          total: result.total,
          timeoutMs: result.timeoutMs
        });
      }
      return sendJson(res, 200, result);
    } catch (error) {
      const invalid = error && error.code === "INVALID_LOCATION";
      if (!invalid) {
        logUpstreamState(logger, "error", {
          state: "all_failed",
          attempts: Array.isArray(error && error.attempts) ? error.attempts : [],
          total: Number(error && error.total) || 0,
          timeoutMs: Number(error && error.timeoutMs) || 0
        });
      }
      return sendJson(res, invalid ? 400 : 502, {
        error: error && error.message ? error.message : "Geographic data could not be loaded",
        attempts: Array.isArray(error && error.attempts) ? error.attempts : [],
        total: Number(error && error.total) || 0,
        timeoutMs: Number(error && error.timeoutMs) || 0
      });
    }
  };
}

module.exports = {
  DEFAULT_OVERPASS_ENDPOINTS,
  DEFAULT_TIMEOUT_MS,
  OVERPASS_QUERY_TIMEOUT_SECONDS,
  normalizeRadius,
  buildBoundingBox,
  buildOverpassQuery,
  classifyUpstreamFailure,
  requestGeography,
  createGeographyHandler
};
