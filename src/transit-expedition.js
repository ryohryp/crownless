"use strict";

const { discoverMovementTrace } = require("./movement-discovery-pulse");

function parseRegionKey(regionKey) {
  const match = String(regionKey || "").match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { latitude: Number(match[1]), longitude: Number(match[2]) };
}

function coarseJourneyBand(previousRegionKey, currentRegionKey) {
  if (!previousRegionKey || !currentRegionKey || previousRegionKey === currentRegionKey) return "same";
  const previous = parseRegionKey(previousRegionKey);
  const current = parseRegionKey(currentRegionKey);
  if (!previous || !current) return "moved";
  const delta = Math.max(Math.abs(current.latitude - previous.latitude), Math.abs(current.longitude - previous.longitude));
  return delta >= 0.05 ? "journey" : "nearby";
}

function discoverTransitJourney(previousRegionKey, currentLocation, state = {}) {
  const movement = discoverMovementTrace(previousRegionKey, currentLocation, state);
  if (!movement.trace) return { trace: null, state: movement.state };

  const band = coarseJourneyBand(previousRegionKey, currentLocation && currentLocation.regionKey);
  if (band !== "journey") return movement;

  return {
    trace: {
      ...movement.trace,
      title: "旅の先の気配",
      text: `大きく土地を移った先で、${movement.trace.text}`,
      journey: true,
      travelMode: "any"
    },
    state: movement.state
  };
}

module.exports = { coarseJourneyBand, discoverTransitJourney };
