const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const appPath = path.join(__dirname, "..", "src", "app.js");
const source = fs.readFileSync(appPath, "utf8");

test("combat app remains valid JavaScript", () => {
  assert.doesNotThrow(() => new vm.Script(source, { filename: "src/app.js" }));
});

test("technique is immediate rather than queued behind auto attacks", () => {
  assert.doesNotMatch(source, /queuedSkill/);
  assert.match(source, /p\.attack && p\.attack\.kind === "light"/);
  assert.match(source, /p\.attack = null;\s+p\.comboStep = 0;/);
});

test("mistimed techniques create commitment and recovery", () => {
  assert.match(source, /MISS — 技の隙/);
  assert.match(source, /p\.recovery = attack\.kind === "counter" \? 0\.28 : 0\.44/);
  assert.match(source, /技の最中は回避できない/);
  assert.match(source, /CRUSHED — 技を潰された/);
});

test("enemy telegraphs can be interrupted by a timed technique", () => {
  assert.match(source, /technique && enemy\.telegraph > 0/);
  assert.match(source, /enemy\.telegraph = 0/);
  assert.match(source, /"INTERRUPT"/);
  assert.match(source, /enemy\.kind === "rusher" \? "COUNTER"/);
  assert.match(source, /reaction = "BREAK"/);
});

test("perfect evade opens a dedicated counter window", () => {
  assert.match(source, /p\.counterWindow = 0\.9/);
  assert.match(source, /p\.skillCooldown = 0/);
  assert.match(source, /PERFECT — 反撃好機/);
  assert.match(source, /kind: counter \? "counter" : "heavy"/);
});

test("weapon families have distinct counter identities", () => {
  assert.match(source, /label: "RIPOSTE"/);
  assert.match(source, /label: "CLASH"/);
  assert.match(source, /label: "RUSH"/);
});
