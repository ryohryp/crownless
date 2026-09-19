"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const path = require("node:path");

const script = path.join(__dirname, "..", "scripts", "jev-shadow-evaluate.cjs");

function run(evidence, env = {}) {
  const result = spawnSync(process.execPath, [script], {
    input: JSON.stringify(evidence),
    encoding: "utf8",
    env: { ...process.env, CROWNLESS_JEV_MCP_COMMAND: "", ...env },
  });
  assert.equal(result.status, 0);
  return JSON.parse(result.stdout);
}

test("Jev shadow evaluator is fail-open when not configured", () => {
  const result = run({ task: "#744", agentChoice: "done" });
  assert.equal(result.shadowOnly, true);
  assert.equal(result.authoritative, false);
  assert.equal(result.available, false);
  assert.equal(result.error, "not_configured");
  assert.equal(result.agentChoice, "done");
});

test("Jev shadow evaluator compares normalized choices without changing authority", () => {
  const mock = path.join(__dirname, "fixtures", "mock-jev-evaluator.cjs");
  const result = run(
    { task: "#744", agentChoice: "done", diffSummary: "bounded" },
    { CROWNLESS_JEV_MCP_COMMAND: process.execPath + " " + mock },
  );
  assert.equal(result.available, true);
  assert.equal(result.choice, "retry");
  assert.equal(result.agrees, false);
  assert.equal(result.confidence, 0.82);
  assert.equal(result.shadowOnly, true);
  assert.equal(result.authoritative, false);
});

test("Jev failures do not fail the development loop", () => {
  const result = run(
    { task: "#744", agentChoice: "retry" },
    { CROWNLESS_JEV_MCP_COMMAND: "__missing_jev_command__" },
  );
  assert.equal(result.available, false);
  assert.equal(result.error, "evaluator_failed");
  assert.equal(result.agentChoice, "retry");
});
