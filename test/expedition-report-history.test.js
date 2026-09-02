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

test("report history stays hidden until at least two completed reports exist", () => {
  const body = functionBody("renderReportHistory", "renderReport");
  assert.match(body, /state\.completedReports\.length < 2/);
  assert.match(body, /document\.createElement\("select"\)/);
  assert.match(body, /過去の帰還報告を選ぶ/);
});

test("report history defaults to the newest saved report", () => {
  const renderBody = functionBody("render", "heading");
  assert.match(renderBody, /selectedReport \|\| state\.completedReports\[0\]/);
  assert.match(renderBody, /selectedReportExpeditionId = report\.expeditionId/);
});

test("active expedition keeps precedence over completed report history", () => {
  const renderBody = functionBody("render", "heading");
  const active = renderBody.indexOf("if (state.activeExpedition)");
  const reports = renderBody.indexOf("state.completedReports.length");
  assert.ok(active >= 0 && reports > active);
});

test("choosing an older report only rerenders presentation", () => {
  const body = functionBody("renderReportHistory", "renderReport");
  assert.match(body, /state\.completedReports\.find/);
  assert.match(body, /renderReport\(content, selected\)/);
  assert.doesNotMatch(body, /save\(/);
  assert.doesNotMatch(body, /applyReport/);
  assert.doesNotMatch(body, /advance\(/);
  assert.doesNotMatch(body, /dispatchExpedition/);
});

test("starting the next expedition clears transient report selection", () => {
  const prepareBody = functionBody("renderPrepare", "formatLiveClock");
  assert.match(prepareBody, /selectedReportExpeditionId = null/);
});