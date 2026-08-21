"use strict";

const { createGeographyHandler } = require("../src/geography-proxy.js");

// Keep the production pool on currently listed global public Overpass instances.
// The generic proxy module remains configurable for tests and local experiments.
const PRODUCTION_OVERPASS_ENDPOINTS = Object.freeze([
  "https://overpass-api.de/api/interpreter",
  "https://overpass.maprva.org/api/interpreter",
  "https://ethiopia.overpass.openplaceguide.org/api/interpreter"
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
