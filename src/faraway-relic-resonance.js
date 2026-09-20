"use strict";

const { coarseJourneyBand } = require("./transit-expedition");

const SEALED_RELIC = "relic_moon_shard";
const AWAKENED_RELIC = "relic_moon_shard_awakened";

function discoverFarawayRelicResonance(previousRegionKey, currentLocation, inventory = [], state = {}) {
  const currentRegionKey = currentLocation && currentLocation.regionKey;
  const nextState = {
    resonatedRegions: Array.isArray(state.resonatedRegions) ? [...state.resonatedRegions] : []
  };

  if (!inventory.includes(SEALED_RELIC) || inventory.includes(AWAKENED_RELIC)) {
    return { resonance: null, state: nextState };
  }
  if (coarseJourneyBand(previousRegionKey, currentRegionKey) !== "journey") {
    return { resonance: null, state: nextState };
  }
  if (nextState.resonatedRegions.includes(currentRegionKey)) {
    return { resonance: null, state: nextState };
  }

  nextState.resonatedRegions.push(currentRegionKey);
  return {
    resonance: {
      relicId: SEALED_RELIC,
      regionLabel: currentLocation.label || "遠くの土地",
      title: "月片が、遠い土地で震えた",
      cue: "煤けた月片が冷たく鳴る。ここには、元の土地では分からなかった何かがある。",
      followUp: "この土地を探索して、月片の反応を確かめる",
      distanceBand: "far"
    },
    state: nextState
  };
}

module.exports = {
  SEALED_RELIC,
  AWAKENED_RELIC,
  discoverFarawayRelicResonance
};
