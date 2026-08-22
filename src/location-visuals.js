(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessLocationVisuals = api;

  if (root && root.document) {
    const loadJournalBrowser = () => {
      if (root.CrownlessDiscoveryJournal || root.document.querySelector('script[src="src/discovery-journal-browser.js"]')) return;
      const script = root.document.createElement("script");
      script.src = "src/discovery-journal-browser.js";
      script.async = false;
      root.document.body.appendChild(script);
    };
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", loadJournalBrowser, { once: true });
    else loadJournalBrowser();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createLocationVisuals() {
  "use strict";

  const RUINED_WATCHTOWER_VISUAL = Object.freeze({
    id: "ruined-watchtower",
    assetPath: "assets/locations/ruined-watchtower.png",
    alt: "崩れた石造りの物見台"
  });

  const VISUALS_BY_BASE_TITLE = Object.freeze({
    "崩れた物見台": RUINED_WATCHTOWER_VISUAL,
    // Legacy simulated location from the prototype. It represents the same
    // watchtower / signal-tower archetype and can safely reuse this visual.
    "消えかけた烽火台": RUINED_WATCHTOWER_VISUAL
  });

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function cleanTerrain(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  function isRuinedWatchtowerArchetype(entry) {
    const contentKind = cleanText(entry && entry.contentKind);
    const terrain = cleanTerrain(entry && entry.terrain);
    return contentKind === "dungeon" && terrain.includes("height");
  }

  function resolveLocationVisual(entry) {
    if (!entry || typeof entry !== "object") return null;
    const baseTitle = cleanText(entry.baseTitle) || cleanText(entry.name);
    const byTitle = VISUALS_BY_BASE_TITLE[baseTitle];
    if (byTitle) return Object.assign({}, byTitle);
    if (isRuinedWatchtowerArchetype(entry)) return Object.assign({}, RUINED_WATCHTOWER_VISUAL);
    return null;
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
