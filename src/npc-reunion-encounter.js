((root, factory) => {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./npc-life.js")
      : root && root.CrownlessNpcLife
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessNpcReunionEncounter = api;
})(typeof window !== "undefined" ? window : globalThis, (NpcLife) => {
  "use strict";

  function cleanKey(value) {
    return String(value == null ? "" : value).trim();
  }

  function encounterAtDiscovery(snapshot, knownDestinations, discoveryKey) {
    const key = cleanKey(discoveryKey);
    if (!key || !NpcLife || typeof NpcLife.reunionCandidates !== "function") return null;

    const candidate = NpcLife.reunionCandidates(snapshot, knownDestinations)
      .find((entry) => cleanKey(entry && entry.discoveryKey) === key);
    if (!candidate) return null;

    return Object.freeze({
      npcId: candidate.targetId,
      npcName: candidate.targetName,
      discoveryKey: candidate.discoveryKey,
      destinationName: candidate.destinationName,
      location: candidate.location,
      locationLabel: candidate.locationLabel,
      state: "reunion",
      message: `${candidate.destinationName}で${candidate.targetName}を見つけた。`
    });
  }

  function encounterForExpedition(snapshot, knownDestinations, expeditionState, expedition) {
    const destinationId = cleanKey(expedition && expedition.inputs && expedition.inputs.destinationId);
    if (!destinationId) return null;

    const destinations = Array.isArray(expeditionState && expeditionState.destinations)
      ? expeditionState.destinations
      : [];
    const destination = destinations.find((entry) => cleanKey(entry && entry.id) === destinationId);
    const discoveryKey = cleanKey(destination && destination.discoveryKey);
    if (!discoveryKey) return null;

    return encounterAtDiscovery(snapshot, knownDestinations, discoveryKey);
  }

  return Object.freeze({
    encounterAtDiscovery,
    encounterForExpedition
  });
});
