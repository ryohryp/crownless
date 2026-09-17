"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { resolveWeekendJourney } = require("../src/weekend-journey");
const { createExpeditionPostcard } = require("../src/expedition-postcard");

test("faraway expedition becomes a compact postcard", () => {
  const location = simulateLocation("faraway");
  const journey = resolveWeekendJourney(location);
  const card = createExpeditionPostcard({
    location,
    journey,
    loot: "灰風の護符",
    event: "旅人の焚き火跡を見つけた"
  });

  assert.equal(card.region, "遠くの地域");
  assert.equal(card.journeyTheme, "灰風の境界地");
  assert.equal(card.keepsake, "灰風の護符");
  assert.equal(card.memory, "旅人の焚き火跡を見つけた");
});

test("postcard never exposes precise movement history", () => {
  const location = simulateLocation("faraway");
  const card = createExpeditionPostcard({
    location,
    journey: resolveWeekendJourney(location)
  });

  assert.equal("latitude" in card, false);
  assert.equal("longitude" in card, false);
  assert.equal("route" in card, false);
  assert.equal("history" in card, false);
  assert.equal("regionKey" in card, false);
});
