(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? require("./transit-expedition").coarseJourneyBand : null);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessNeighboringLands = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (externalJourneyBand) {
  "use strict";

  const WORLD_THREADS = Object.freeze([
    Object.freeze({ id: "whispering-wood", title: "囁きの森の続き", text: "前の土地で見た森の気配が、隣の土地でも途切れず続いている。", followUp: "森の続きを調べる" }),
    Object.freeze({ id: "ash-road", title: "灰の街道の続き", text: "前の土地から伸びていた古い街道が、この土地の先へ続いている。", followUp: "街道の先を調べる" }),
    Object.freeze({ id: "old-highland", title: "古い高地の続き", text: "遠くに見えていた高地の稜線が、隣の土地ではすぐ近くまで迫っている。", followUp: "高地の続きを調べる" })
  ]);

  function parseRegionKey(regionKey) {
    const match = String(regionKey || "").match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    return match ? { latitude: Number(match[1]), longitude: Number(match[2]) } : null;
  }

  function browserJourneyBand(previousRegionKey, currentRegionKey) {
    if (!previousRegionKey || !currentRegionKey || previousRegionKey === currentRegionKey) return "same";
    const previous = parseRegionKey(previousRegionKey);
    const current = parseRegionKey(currentRegionKey);
    if (!previous || !current) return "moved";
    return Math.max(Math.abs(current.latitude - previous.latitude), Math.abs(current.longitude - previous.longitude)) >= 0.05 ? "journey" : "nearby";
  }

  const coarseJourneyBand = externalJourneyBand || browserJourneyBand;

  function threadIndex(regionKey) {
    let hash = 0;
    for (const char of String(regionKey || "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash % WORLD_THREADS.length;
  }

  function connectNeighboringLands(previousLocation, currentLocation, state = {}) {
    const previousRegionKey = previousLocation && previousLocation.regionKey;
    const currentRegionKey = currentLocation && currentLocation.regionKey;
    if (!previousRegionKey || !currentRegionKey || coarseJourneyBand(previousRegionKey, currentRegionKey) !== "nearby") {
      return { connection: null, state: { ...state } };
    }

    const connectedRegions = new Set(Array.isArray(state.connectedRegions) ? state.connectedRegions : []);
    if (connectedRegions.has(currentRegionKey)) return { connection: null, state: { ...state } };

    connectedRegions.add(currentRegionKey);
    const thread = WORLD_THREADS[threadIndex(previousRegionKey)];
    return {
      connection: {
        id: thread.id,
        title: thread.title,
        text: thread.text,
        followUp: thread.followUp,
        fromLabel: previousLocation.label || "前の地域",
        toLabel: currentLocation.label || "隣の地域",
        connected: true
      },
      state: { connectedRegions: [...connectedRegions] }
    };
  }

  return { WORLD_THREADS, connectNeighboringLands };
});
