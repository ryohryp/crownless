(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessDiscovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDiscoveryProvider() {
  "use strict";

  function normalizePlace(lead, index) {
    const source = lead || {};
    const id = String(source.id || `discovery-${index + 1}`);
    const title = String(source.title || source.name || "名もない気配");
    const signal = String(source.signal || source.type || "unknown");
    const risk = Math.max(1, Math.min(5, Number(source.risk) || 1));
    return {
      id,
      title,
      signal,
      risk,
      palette: source.palette || "road",
      source
    };
  }

  function createSimulatedDiscoveryProvider(options) {
    const settings = options || {};
    const limit = Math.max(1, Number(settings.limit) || 3);

    return {
      kind: "simulated",
      discover(context) {
        const leads = Array.isArray(context && context.leads) ? context.leads : [];
        return leads.slice(0, limit).map(normalizePlace);
      }
    };
  }

  return {
    normalizePlace,
    createSimulatedDiscoveryProvider
  };
});
