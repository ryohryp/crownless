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

function productionRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return PRODUCTION_MAX_RADIUS_METRES;
  return Math.max(100, Math.min(PRODUCTION_MAX_RADIUS_METRES, number));
}

const handler = createGeographyHandler({ endpoints: PRODUCTION_OVERPASS_ENDPOINTS });

function geographyHandler(req, res) {
  if (req && typeof req === "object") {
    const query = req.query && typeof req.query === "object" ? req.query : {};
    req.query = Object.assign({}, query, { radius: String(productionRadius(query.radius)) });
  }
  return handler(req, res);
}

module.exports = geographyHandler;
module.exports.PRODUCTION_OVERPASS_ENDPOINTS = PRODUCTION_OVERPASS_ENDPOINTS;
module.exports.PRODUCTION_MAX_RADIUS_METRES = PRODUCTION_MAX_RADIUS_METRES;
module.exports.productionRadius = productionRadius;
