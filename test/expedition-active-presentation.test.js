"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-presentation.js"), "utf8");

function functionBody(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0, `${name} should exist`);
  assert.ok(end > start, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

test("active expedition shows expected return time without exposing resolver seed", () => {
  const body = functionBody("renderActive", "buildBattleNarrative");

  assert.match(body, /帰還まで 約/);
  assert.match(body, /formatLiveClock\(exp\.expectedReturnAt\)/);
  assert.match(body, /帰還予定/);
  assert.match(body, /system\.policies\[exp\.inputs\.policyId\]\.name/);
  assert.doesNotMatch(body, /exp\.seed/);
  assert.doesNotMatch(body, /\bseed\b/);
});
