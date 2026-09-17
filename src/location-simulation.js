"use strict";

const PRESETS = Object.freeze({
  home: Object.freeze({ id: "home", regionKey: "35.75,139.85", label: "いつもの地域", visit: "revisit" }),
  nearby: Object.freeze({ id: "nearby", regionKey: "35.76,139.86", label: "隣の地域", visit: "first" }),
  faraway: Object.freeze({ id: "faraway", regionKey: "35.90,139.70", label: "遠くの地域", visit: "first" })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function simulateLocation(presetId = "home") {
  const preset = PRESETS[presetId];
  if (!preset) throw new Error(`Unknown simulated location: ${presetId}`);
  return clone({
    simulated: true,
    regionKey: preset.regionKey,
    label: preset.label,
    visit: preset.visit
  });
}

function simulateJourney(presetIds = ["home", "nearby", "faraway"]) {
  return presetIds.map(simulateLocation);
}

module.exports = { PRESETS, simulateLocation, simulateJourney };
