"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const presentation = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-presentation.js"), "utf8");

function functionBody(name, nextName) {
  const start = presentation.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} should exist`);
  const end = nextName ? presentation.indexOf(`function ${nextName}`, start + 1) : presentation.length;
  assert.ok(end > start, `${name} body should be readable`);
  return presentation.slice(start, end);
}

test("Grey Hearth starts timed recovery instead of clearing injury immediately", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  assert.match(body, /const injuredCompanions = state\.companions\.filter\(\(companion\) => companion\.condition === "injured"\)/);
  assert.match(body, /灰炉で休養を始める/);
  assert.match(body, /system\.startRecovery\(state, injuredCompanions\.map\(\(companion\) => companion\.id\), Date\.now\(\)\)/);
  assert.doesNotMatch(body, /companion\.condition = "healthy"/);
});

test("recovering companions are shown separately and remain unavailable", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  assert.match(body, /const recoveringCompanions = state\.companions\.filter\(\(companion\) => companion\.condition === "recovering"\)/);
  assert.match(body, /recoveryLabel\(companion\)/);
  assert.match(body, /休養中/);
  assert.match(body, /dispatch\.disabled = true/);
});

test("prepare reconciles elapsed recovery before deriving available companions", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  const reconcile = body.indexOf("state = system.reconcileRecoveries(state, Date.now())");
  const available = body.indexOf("const availableCompanions = state.companions.filter(companionAvailable)");
  assert.ok(reconcile >= 0 && available > reconcile);
  assert.match(body, /save\(state\)/);
});
