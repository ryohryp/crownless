"use strict";

const Discovery = require("./discovery-provider.js");

const DEFAULT_TIMEOUT_MS = 15000;

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

async function fetchWithTimeout(fetchFn, endpoint, options, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timer = null;
  const requestOptions = controller ? Object.assign({}, options, { signal: controller.signal }) : options;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      const error = new Error(`timeout after ${timeoutMs}ms`);
      error.code = "OVERPASS_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(fetchFn(endpoint, requestOptions)), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
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
    : Discovery.DEFAULT_OVERPASS_ENDPOINTS.slice();
  const query = Discovery.buildOverpassQuery(latitude, longitude, radius);
  const attempts = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(fetchFn, endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "Crownless/0.1 (+https://crownless-iota.vercel.app/)"
        },
        body: `data=${encodeURIComponent(query)}`
      }, timeoutMs);
      const httpStatus = response && response.status ? response.status : null;
      if (!response || !response.ok) {
        const error = new Error(`HTTP ${httpStatus || "error"}`);
        error.httpStatus = httpStatus;
        throw error;
      }
      const payload = await response.json();
      attempts.push({ endpoint, state: "success", httpStatus, error: "", timedOut: false });
      return {
        elements: Array.isArray(payload && payload.elements) ? payload.elements : [],
        endpoint,
        attempts,
        total: endpoints.length
      };
    } catch (error) {
      attempts.push({
        endpoint,
        state: "failed",
        httpStatus: error && error.httpStatus ? error.httpStatus : null,
        error: error && error.message ? error.message : "failed",
        timedOut: !!(error && error.code === "OVERPASS_TIMEOUT")
      });
    }
  }

  const error = new Error("Geographic upstreams could not be loaded");
  error.code = "GEOGRAPHY_UPSTREAM_FAILED";
  error.attempts = attempts;
  error.total = endpoints.length;
  throw error;
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

function createGeographyHandler(options) {
  const settings = options || {};
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
      return sendJson(res, 200, result);
    } catch (error) {
      const invalid = error && error.code === "INVALID_LOCATION";
      return sendJson(res, invalid ? 400 : 502, {
        error: error && error.message ? error.message : "Geographic data could not be loaded",
        attempts: Array.isArray(error && error.attempts) ? error.attempts : [],
        total: Number(error && error.total) || 0
      });
    }
  };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  normalizeRadius,
  requestGeography,
  createGeographyHandler
};
