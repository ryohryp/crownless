(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessLocationVisuals = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLocationVisuals() {
  "use strict";

  const VISUALS_BY_BASE_TITLE = Object.freeze({
    "崩れた物見台": Object.freeze({
      id: "ruined-watchtower",
      assetPath: "assets/locations/ruined-watchtower.png",
      alt: "崩れた石造りの物見台"
    })
  });

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function resolveLocationVisual(entry) {
    if (!entry || typeof entry !== "object") return null;
    const baseTitle = cleanText(entry.baseTitle);
    const visual = VISUALS_BY_BASE_TITLE[baseTitle];
    return visual ? Object.assign({}, visual) : null;
  }

  function resolveLatestDiscoveredVisual(worldKnowledge) {
    const discoveries = worldKnowledge && worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;

    const ordered = Object.values(discoveries)
      .filter((entry) => entry && typeof entry === "object")
      .sort((left, right) => (Number(right.firstDiscoveredAt) || 0) - (Number(left.firstDiscoveredAt) || 0));

    for (const entry of ordered) {
      const visual = resolveLocationVisual(entry);
      if (visual) return { entry, visual };
    }
    return null;
  }

  return {
    resolveLocationVisual,
    resolveLatestDiscoveredVisual
  };
});
