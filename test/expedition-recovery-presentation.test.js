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

test("Grey Hearth offers recovery whenever any companion is injured", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  assert.match(body, /const injuredCompanions = state\.companions\.filter\(\(companion\) => companion\.condition === "injured"\)/);
  assert.match(body, /if \(injuredCompanions\.length\)/);
  assert.match(body, /灰炉で休養する/);
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

test("recovery changes only injured companions and records Grey Hearth rest", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  assert.match(body, /if \(companion\.condition !== "injured"\) return/);
  assert.match(body, /companion\.condition = "healthy"/);
  assert.match(body, /companion\.history = `\$\{companion\.history \|\| ""\} \/ 灰炉で休養`/);
  assert.match(body, /save\(state\)/);
  assert.match(body, /renderPrepare\(content\)/);
});

test("recovery control is gated by injured companion count", () => {
  const body = functionBody("renderPrepare", "formatLiveClock");
  const gate = body.indexOf("if (injuredCompanions.length)");
  const button = body.indexOf('"灰炉で休養する"');
  assert.ok(gate >= 0 && button > gate);
});
