"use strict";

const { coarseJourneyBand } = require("./transit-expedition");

const HORIZONS = Object.freeze([
  Object.freeze({ id: "wind-cut-highland", title: "風切りの高地", cue: "見慣れない稜線の向こうに、風に削られた古道が続いている。", followUp: "高地の古道へ遠征する" }),
  Object.freeze({ id: "ashen-marsh", title: "灰の湿地", cue: "遠い土地の水辺に、灰色の葦と沈んだ石標が見える。", followUp: "灰の湿地を調べる" }),
  Object.freeze({ id: "red-cliff-road", title: "赤崖の街道", cue: "赤い岩壁の間に、この辺りでは見ない古い街道が口を開けている。", followUp: "赤崖の街道へ進む" })
]);

function horizonIndex(regionKey) {
  let hash = 0;
  for (const char of String(regionKey || "")) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash % HORIZONS.length;
}

function discoverDistantHorizon(previousRegionKey, currentLocation, state = {}) {
  const currentRegionKey = currentLocation && currentLocation.regionKey;
  if (coarseJourneyBand(previousRegionKey, currentRegionKey) !== "journey") {
    return { horizon: null, state: { ...state } };
  }

  const openedRegions = new Set(Array.isArray(state.openedRegions) ? state.openedRegions : []);
  if (openedRegions.has(currentRegionKey)) return { horizon: null, state: { ...state } };

  openedRegions.add(currentRegionKey);
  const source = HORIZONS[horizonIndex(currentRegionKey)];
  return {
    horizon: {
      id: source.id,
      title: source.title,
      cue: source.cue,
      followUp: source.followUp,
      regionLabel: currentLocation.label || "遠くの地域",
      distanceBand: "far"
    },
    state: { openedRegions: [...openedRegions] }
  };
}

module.exports = { HORIZONS, discoverDistantHorizon };
