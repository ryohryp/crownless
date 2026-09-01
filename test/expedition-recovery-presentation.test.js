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

test("latest return report offers direct timed recovery only for currently injured companions", () => {
  const eligibility = functionBody("reportRecoverableCompanions", "renderReport");
  assert.match(eligibility, /const latestReport = state\.completedReports\[0\]/);
  assert.match(eligibility, /latestReport\.expeditionId !== report\.expeditionId/);
  assert.match(eligibility, /injuredIds\.has\(companion\.id\) && companion\.condition === "injured"/);

  const report = functionBody("renderReport", "document.addEventListener");
  assert.match(report, /負傷者を休ませて次を準備する/);
  assert.match(report, /system\.startRecovery\(state, recoverableCompanions\.map\(\(companion\) => companion\.id\), Date\.now\(\)\)/);
  assert.match(report, /save\(state\)/);
  assert.match(report, /renderPrepare\(content\)/);
});

test("historical reports and already recovering companions cannot reapply recovery", () => {
  const eligibility = functionBody("reportRecoverableCompanions", "renderReport");
  assert.match(eligibility, /if \(!latestReport \|\| latestReport\.expeditionId !== report\.expeditionId\) return \[\]/);
  assert.match(eligibility, /companion\.condition === "injured"/);
  assert.doesNotMatch(eligibility, /condition === "recovering"/);
  assert.doesNotMatch(eligibility, /condition === "healthy"/);
});
