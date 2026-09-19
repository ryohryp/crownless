"use strict";

const { discoverTransitJourney } = require("./transit-expedition");

function queueDiscoveryAfterMovement(previousRegionKey, currentLocation, state = {}) {
  const movement = discoverTransitJourney(previousRegionKey, currentLocation, state.discovery || {});
  if (!movement.trace) {
    return { pending: null, state: { ...state, discovery: movement.state } };
  }

  return {
    pending: {
      trace: movement.trace,
      regionKey: currentLocation.regionKey,
      regionLabel: currentLocation.label || "新しい地域"
    },
    state: { ...state, discovery: movement.state }
  };
}

function resolveStationaryDiscovery(pending, status = {}) {
  if (!pending) return { discovery: null, pending: null };
  if (!status.stationary) return { discovery: null, pending };

  return {
    discovery: {
      ...pending.trace,
      regionLabel: pending.regionLabel,
      resolvedAfterArrival: true
    },
    pending: null
  };
}

module.exports = { queueDiscoveryAfterMovement, resolveStationaryDiscovery };
