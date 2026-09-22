"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  discoverSafeHaven,
  expeditionStartBenefit,
  applyExpeditionStartBenefit
} = require("../src/safe-haven");

test("discovers one safe haven in the supported location", () => {
  const state = {};
  const found = discoverSafeHaven(state, "whispering-forest");

  assert.equal(found.name, "根洞の火床");
  assert.equal(state.safeHavens["whispering-forest"].discovered, true);
  assert.equal(discoverSafeHaven(state, "whispering-forest"), null);
});

test("does not invent havens for unsupported locations", () => {
  const state = {};
  assert.equal(discoverSafeHaven(state, "ruined-watchtower"), null);
  assert.equal(state.safeHavens, undefined);
});

test("a discovered haven grants a small visible revisit benefit", () => {
  const state = { expedition: { herbs: 1 } };
  discoverSafeHaven(state, "whispering-forest");

  const preview = expeditionStartBenefit(state, "whispering-forest");
  assert.equal(preview.kind, "extra-herb");
  assert.match(preview.label, /根洞の火床/);

  const applied = applyExpeditionStartBenefit(state, "whispering-forest");
  assert.equal(applied.applied, true);
  assert.equal(state.expedition.herbs, 2);
});

test("revisit benefit respects the existing herb cap", () => {
  const state = { expedition: { herbs: 3 } };
  discoverSafeHaven(state, "whispering-forest");

  const applied = applyExpeditionStartBenefit(state, "whispering-forest");
  assert.equal(applied.applied, false);
  assert.equal(state.expedition.herbs, 3);
});
