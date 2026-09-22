"use strict";

const SAFE_HAVENS = Object.freeze({
  "whispering-forest": {
    id: "root-hollow",
    name: "根洞の火床",
    cue: "倒木の根元に、雨を避けられる古い火床が残っている。",
    benefit: "次の遠征では土地勘を頼りに薬草を1つ余分に持ち込める。"
  }
});

function discoverSafeHaven(state, locationId) {
  if (!state || !locationId || !SAFE_HAVENS[locationId]) return null;
  if (!state.safeHavens) state.safeHavens = {};
  if (state.safeHavens[locationId]) return null;

  const haven = SAFE_HAVENS[locationId];
  state.safeHavens[locationId] = { id: haven.id, discovered: true };
  return { locationId, ...haven };
}

function expeditionStartBenefit(state, locationId) {
  const entry = state && state.safeHavens && state.safeHavens[locationId];
  const haven = SAFE_HAVENS[locationId];
  if (!entry || !entry.discovered || !haven) return null;

  return {
    kind: "extra-herb",
    amount: 1,
    label: `${haven.name}の土地勘`,
    description: haven.benefit
  };
}

function applyExpeditionStartBenefit(state, locationId) {
  const benefit = expeditionStartBenefit(state, locationId);
  if (!benefit || !state || !state.expedition) return null;

  const current = Number(state.expedition.herbs || 0);
  state.expedition.herbs = Math.min(3, current + benefit.amount);
  return { ...benefit, applied: state.expedition.herbs > current };
}

module.exports = {
  SAFE_HAVENS,
  discoverSafeHaven,
  expeditionStartBenefit,
  applyExpeditionStartBenefit
};
