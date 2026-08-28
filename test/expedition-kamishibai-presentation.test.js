"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtime = fs.readFileSync(path.join(root, "src", "app-runtime-state.js"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src", "expedition-presentation.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "expedition-kamishibai.css"), "utf8");

test("runtime loads scene projection and kamishibai styles before report presentation", () => {
  assert.match(runtime, /expedition-kamishibai\.css/);
  assert.match(runtime, /src\/expedition-scenes\.js/);
  assert.match(runtime, /scenes\.onload = loadExpeditionDomain/);
  assert.match(runtime, /scenes\.onerror = loadExpeditionDomain/);
});

test("completed report renders kamishibai before the result summary", () => {
  const sceneCall = presentation.indexOf("renderKamishibai(content, report, generatedNarrative)");
  const summaryCall = presentation.indexOf('const summary = el("section", "expedition-report-summary")');
  assert.ok(sceneCall >= 0, "kamishibai render call should exist");
  assert.ok(summaryCall > sceneCall, "kamishibai should be the primary report surface");
  assert.match(presentation, /dataExpeditionSummary|dataset\.expeditionSummary/);
  assert.match(presentation, /成果を見る ↓/);
});

test("paper theatre keeps both narrative and raw chronology available", () => {
  assert.match(presentation, /renderBattleNarrative\(content, report, generatedNarrative\)/);
  assert.match(presentation, /時系列と戦闘数値を確認する/);
  assert.match(presentation, /expedition-log/);
});

test("kamishibai offers phone-friendly navigation and manuscript visual motifs", () => {
  assert.match(styles, /\.expedition-kamishibai__visual/);
  assert.match(styles, /data-motif="forest"/);
  assert.match(styles, /data-motif="combat-beast"/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(presentation, /← 前の場面/);
  assert.match(presentation, /次の場面 →/);
});
