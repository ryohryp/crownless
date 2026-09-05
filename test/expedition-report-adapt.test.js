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

test("return report exposes a real Adapt choice instead of a single generic next button", () => {
  const body = functionBody("renderReport");
  assert.match(body, /ADAPT \/ 次の判断/);
  assert.match(body, /へ備え直す/);
  assert.match(body, /別の遠征先を選ぶ/);
  assert.match(body, /beginNextPreparation\(content, report, recoverableCompanions, report\.destinationId\)/);
  assert.match(body, /beginNextPreparation\(content, report, recoverableCompanions, null\)/);
});

test("same-place Adapt carries the causal destination into Prepare", () => {
  assert.match(presentation, /let prepareDestinationId = null/);
  const begin = functionBody("beginNextPreparation", "renderReport");
  assert.match(begin, /prepareDestinationId = destinationId \|\| null/);
  assert.match(begin, /preparingNextExpedition = true/);
  assert.match(begin, /renderPrepare\(content\)/);

  const prepare = functionBody("renderPrepare", "formatLiveClock");
  assert.match(prepare, /state\.destinations\.find\(\(destination\) => destination\.id === prepareDestinationId\)/);
  assert.match(prepare, /preferredDestination \? preferredDestination\.id : state\.destinations\[0\]\?\.id/);
  assert.match(prepare, /前回と同じ場所でも、仲間・道具・方針を変えれば次の結果は変わりうる/);
});

test("manual destination changes replace the report-carried destination before dispatch", () => {
  const prepare = functionBody("renderPrepare", "formatLiveClock");
  assert.match(prepare, /event\.target\.name === "destination"\) prepareDestinationId = event\.target\.value/);
  assert.match(prepare, /destinationId: data\.get\("destination"\)/);
  assert.match(prepare, /prepareDestinationId = null/);
});

test("Adapt copy reacts to failed, early-return, discovery and plain-success outcomes", () => {
  const copy = functionBody("adaptCopy", "beginNextPreparation");
  assert.match(copy, /report\.outcome === "failed"/);
  assert.match(copy, /report\.outcome === "early-return"/);
  assert.match(copy, /report\.discoveries/);
  assert.match(copy, /同じ場所を深掘りするか、別の場所へ向かうか/);
});

test("latest-report recovery remains idempotent while either Adapt path starts it", () => {
  const recoverable = functionBody("reportRecoverableCompanions", "adaptCopy");
  assert.match(recoverable, /latestReport\.expeditionId !== report\.expeditionId/);
  assert.match(recoverable, /companion\.condition === "injured"/);

  const begin = functionBody("beginNextPreparation", "renderReport");
  assert.match(begin, /system\.startRecovery\(state, recoverableCompanions\.map\(\(companion\) => companion\.id\), Date\.now\(\)\)/);
  assert.match(begin, /save\(state\)/);
});
