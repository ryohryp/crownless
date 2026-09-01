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

test("Grey Hearth offers timed recovery whenever any companion is injured", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  assert.match(body, /const injuredCompanions = state\.companions\.filter\(\(companion\) => companion\.condition === "injured"\)/);
  assert.match(body, /const recoveringCompanions = state\.companions\.filter\(\(companion\) => companion\.condition === "recovering"\)/);
  assert.match(body, /if \(injuredCompanions\.length\)/);
  assert.match(body, /灰炉で休養を始める/);
});

test("dispatch is disabled only when no companion is available", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  const disabledBlockStart = body.indexOf("if (!availableCompanions.length)");
  const recoveryBlockStart = body.indexOf("if (injuredCompanions.length)");
  assert.ok(disabledBlockStart >= 0 && recoveryBlockStart > disabledBlockStart);
  const disabledBlock = body.slice(disabledBlockStart, recoveryBlockStart);
  assert.match(disabledBlock, /dispatch\.disabled = true/);
  assert.doesNotMatch(body.slice(recoveryBlockStart), /dispatch\.disabled = true/);
});

test("recovery delegates state transitions to the expedition system instead of healing instantly", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  assert.match(body, /system\.startRecovery\(state, injuredCompanions\.map\(\(companion\) => companion\.id\), Date\.now\(\)\)/);
  assert.doesNotMatch(body, /companion\.condition = "healthy"/);
  assert.match(body, /save\(state\)/);
  assert.match(body, /renderPrepare\(content\)/);
});

test("recovering companions expose remaining time and stay unavailable", () => {
  const body = functionBody("recoveryLabel", "choiceGroup");
  assert.match(body, /item\.condition !== "recovering"/);
  assert.match(body, /remainingMinutes/);
  assert.match(body, /休養中・あと約/);

  const availability = functionBody("companionAvailable", "recoveryLabel");
  assert.match(availability, /\["healthy", "ready"\]\.includes\(item\.condition\)/);
});

test("recovery control is gated by injured companion count", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  const gate = body.indexOf("if (injuredCompanions.length)");
  const button = body.indexOf('"灰炉で休養を始める"');
  assert.ok(gate >= 0 && button > gate);
});
