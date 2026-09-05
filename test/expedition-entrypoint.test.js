"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtime = fs.readFileSync(path.join(root, "src", "app-runtime-state.js"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src", "expedition-presentation.js"), "utf8");

test("expedition gate holds fast clicks until the async presentation is ready", () => {
  assert.match(runtime, /holdGateUntilExpeditionReady/);
  assert.match(runtime, /event\.stopImmediatePropagation\(\)/);
  assert.match(runtime, /presentation\.onload/);
  assert.match(runtime, /gate\.click\(\)/);
});

test("dispatch form reports validation failures instead of failing silently", () => {
  assert.match(presentation, /expedition-form-feedback/);
  assert.match(presentation, /if \(!companionId\)/);
  assert.match(presentation, /try \{/);
  assert.match(presentation, /遠征を開始できない:/);
});

test("all-injured parties can start timed recovery without deadlocking the hearth", () => {
  assert.match(presentation, /availableCompanions\.length/);
  assert.match(presentation, /灰炉で休養を始める/);
  assert.match(presentation, /companion\.condition === "injured"/);
  assert.match(presentation, /system\.startRecovery\(/);
  assert.match(presentation, /companion\.condition === "recovering"/);
  assert.doesNotMatch(presentation, /companion\.condition = "healthy"/);
});


test("expedition presentation exposes an explicit runtime entrypoint", () => {
  assert.match(presentation, /CrownlessExpeditionPresentation/);
  assert.match(presentation, /Object\.freeze\(\{[\s\S]*open,[\s\S]*close,[\s\S]*isReady/);
});
