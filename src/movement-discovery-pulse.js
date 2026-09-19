"use strict";

const TRACES = Object.freeze([
  Object.freeze({ id: "wagon-ruts", title: "新しい轍", text: "見慣れない荷車の轍が、森の方へ続いている。", followUp: "囁きの森を調べる" }),
  Object.freeze({ id: "faint-smoke", title: "遠くの煙", text: "移動してきた先で、丘の向こうに細い煙を見つけた。", followUp: "煙の気配を追う" }),
  Object.freeze({ id: "carved-mark", title: "木に刻まれた印", text: "前の土地では見なかった古い印が、道端の木に残っている。", followUp: "印の由来を探る" })
]);

function traceIndex(regionKey) {
  let hash = 0;
  for (const char of String(regionKey || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % TRACES.length;
}

function discoverMovementTrace(previousRegionKey, currentLocation, state = {}) {
  const currentRegionKey = currentLocation && currentLocation.regionKey;
  if (!previousRegionKey || !currentRegionKey || previousRegionKey === currentRegionKey) {
    return { trace: null, state: { ...state } };
  }

  const seenRegions = new Set(Array.isArray(state.seenRegions) ? state.seenRegions : []);
  if (seenRegions.has(currentRegionKey)) return { trace: null, state: { ...state } };

  seenRegions.add(currentRegionKey);
  const source = TRACES[traceIndex(currentRegionKey)];
  const trace = {
    id: source.id,
    title: source.title,
    text: source.text,
    followUp: source.followUp,
    regionLabel: currentLocation.label || "新しい地域"
  };

  return {
    trace,
    state: { seenRegions: [...seenRegions] }
  };
}

module.exports = { TRACES, discoverMovementTrace };
