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

  const report = functionBody("renderReport");
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

test("periodic recovery refresh keeps the next-expedition preparation screen instead of reopening the previous report", () => {
  assert.match(presentation, /let preparingNextExpedition = false/);

  const render = functionBody("render", "heading");
  const prepareBranch = render.indexOf("else if (preparingNextExpedition) renderPrepare(content)");
  const reportBranch = render.indexOf("else if (lastResolved || state.completedReports.length)");
  assert.ok(prepareBranch >= 0 && reportBranch > prepareBranch, "prepare mode must win over historical reports");

  const report = functionBody("renderReport");
  assert.match(report, /preparingNextExpedition = true/);

  const refresh = functionBody("refresh", "updateGateCopy");
  assert.match(refresh, /if \(advanced\.report\)[\s\S]*preparingNextExpedition = false/);

  assert.match(presentation, /window\.setInterval\([\s\S]*refresh\(Date\.now\(\)\)[\s\S]*render\(\)/);
});

test("periodic recovery refresh preserves Prepare wizard step and selections across full render", () => {
  const capture = functionBody("capturePrepareUiState", "restorePrepareUiState");
  assert.match(capture, /form\.dataset\.journeyStep/);
  assert.match(capture, /input\[name\], select\[name\], textarea\[name\]/);
  assert.match(capture, /control\.type === "radio" \|\| control\.type === "checkbox"/);

  const restore = functionBody("restorePrepareUiState", "render");
  assert.match(restore, /control\.checked = selected\.includes\(control\.value\)/);

  const render = functionBody("render", "heading");
  const snapshot = render.indexOf("capturePrepareUiState(prepareForm)");
  const replace = render.indexOf("content.replaceChildren()");
  assert.ok(snapshot >= 0 && replace > snapshot, "Prepare state must be captured before periodic full render clears the form");

  const journey = functionBody("prepareJourney", "renderAdapt");
  assert.match(journey, /prepareUiState\?\.step/);
  assert.match(journey, /form\.dataset\.journeyStep = String\(step\)/);
  assert.match(journey, /restorePrepareUiState\(form\)/);
  assert.match(journey, /capturePrepareUiState\(form, step\)/);
});
