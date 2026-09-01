"use strict";

const { createGeographyHandler } = require("../src/geography-proxy.js");

// Production geography must only race Overpass instances with global data
// coverage. Regional instances can return HTTP 200 with an empty result for
// Tokyo and would otherwise win the race before a valid global response.
const PRODUCTION_OVERPASS_ENDPOINTS = Object.freeze([
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
]);

const PRODUCTION_MAX_RADIUS_METRES = 500;
const PRODUCTION_FALLBACK = "simulated";

function productionRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return PRODUCTION_MAX_RADIUS_METRES;
  return Math.max(100, Math.min(PRODUCTION_MAX_RADIUS_METRES, number));
}

function productionFallbackPayload(payload) {
  return Object.assign({}, payload || {}, {
    degraded: true,
    fallback: PRODUCTION_FALLBACK,
    elements: [],
    endpoint: null
  });
}

function createProductionResponse(res) {
  let statusCode = 200;
  const wrapper = {
    setHeader(name, value) {
      if (res && typeof res.setHeader === "function") res.setHeader(name, value);
    },
    status(code) {
      statusCode = Number(code) || 500;
      return wrapper;
    },
    json(payload) {
      const upstreamFailure = statusCode === 502 && payload && Array.isArray(payload.attempts);
      const outgoingStatus = upstreamFailure ? 200 : statusCode;
      const outgoingPayload = upstreamFailure ? productionFallbackPayload(payload) : payload;
      if (res && typeof res.status === "function" && typeof res.json === "function") {
        return res.status(outgoingStatus).json(outgoingPayload);
      }
      if (res) {
        res.statusCode = outgoingStatus;
        if (typeof res.setHeader === "function") res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (typeof res.end === "function") return res.end(JSON.stringify(outgoingPayload));
      }
      return undefined;
    },
    end(value) {
      if (res && typeof res.end === "function") return res.end(value);
      return undefined;
    }
  };

  Object.defineProperty(wrapper, "statusCode", {
    get() { return res ? res.statusCode : statusCode; },
    set(value) {
      statusCode = value;
      if (res) res.statusCode = value;
    }
  });

  return wrapper;
}

const handler = createGeographyHandler({ endpoints: PRODUCTION_OVERPASS_ENDPOINTS });

function geographyHandler(req, res) {
  if (req && typeof req === "object") {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    req.query = Object.assign({}, query, { radius: String(productionRadius(query.radius)) });
  }
  return handler(req, createProductionResponse(res));
}

module.exports = geographyHandler;
module.exports.PRODUCTION_OVERPASS_ENDPOINTS = PRODUCTION_OVERPASS_ENDPOINTS;
module.exports.PRODUCTION_MAX_RADIUS_METRES = PRODUCTION_MAX_RADIUS_METRES;
module.exports.PRODUCTION_FALLBACK = PRODUCTION_FALLBACK;
module.exports.productionRadius = productionRadius;
module.exports.productionFallbackPayload = productionFallbackPayload;
module.exports.createProductionResponse = createProductionResponse;
