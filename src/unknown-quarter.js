(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessUnknownQuarter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "crownless-expedition-v1-known-regions";

  function regionKey(anchor) {
    if (!anchor || !Number.isFinite(anchor.latitude) || !Number.isFinite(anchor.longitude)) return null;
    return `${Math.round(anchor.latitude * 100) / 100},${Math.round(anchor.longitude * 100) / 100}`;
  }

  function normalizeKnownRegions(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(v => typeof v === "string" && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(v)))].slice(-24);
  }

  function isKnown(knownRegions, key) {
    return Boolean(key) && normalizeKnownRegions(knownRegions).includes(key);
  }

  function markKnown(knownRegions, key) {
    const known = normalizeKnownRegions(knownRegions);
    if (!key || known.includes(key)) return known;
    return [...known, key].slice(-24);
  }

  function obscureMood(mood, familiar) {
    if (!mood || familiar) return mood ? Object.assign({}, mood) : null;
    return {
      label: "見知らぬ土地",
      text: "土地勘がなく、痕跡の意味まではまだ読めない。何かが先にいる気配だけがする。",
      cue: "危険度：不明"
    };
  }

  return { STORAGE_KEY, regionKey, normalizeKnownRegions, isKnown, markKnown, obscureMood };
});