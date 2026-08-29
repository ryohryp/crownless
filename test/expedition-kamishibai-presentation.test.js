"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const runtime = fs.readFileSync(path.join(root, "src", "app-runtime-state.js"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src", "expedition-presentation.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "expedition-kamishibai.css"), "utf8");
const battleStyles = fs.readFileSync(path.join(root, "expedition-kamishibai-battle.css"), "utf8");

test("runtime loads scene projection, battle composition, and kamishibai styles before report presentation", () => {
  assert.match(runtime, /expedition-kamishibai\.css/);
  assert.match(runtime, /expedition-kamishibai-battle\.css/);
  assert.match(runtime, /src\/expedition-scenes\.js/);
  assert.match(runtime, /src\/expedition-visual-composition\.js/);
  assert.match(runtime, /scenes\.onload = loadExpeditionComposition/);
  assert.match(runtime, /scenes\.onerror = loadExpeditionComposition/);
  assert.match(runtime, /composition\.onload = loadExpeditionDomain/);
  assert.match(runtime, /composition\.onerror = loadExpeditionDomain/);
});

test("completed report reads as kamishibai then result summary then details", () => {
  const reportStart = presentation.indexOf("function renderReport");
  const reportEnd = presentation.indexOf("document.addEventListener", reportStart);
  assert.ok(reportStart >= 0 && reportEnd > reportStart);
  const reportBody = presentation.slice(reportStart, reportEnd);
  const sceneCall = reportBody.indexOf("renderKamishibai(content, report, generatedNarrative)");
  const summaryCall = reportBody.indexOf("content.append(summary)");
  const detailsCall = reportBody.indexOf("details.dataset.expeditionDetails");
  assert.ok(sceneCall >= 0, "kamishibai should exist");
  assert.ok(summaryCall > sceneCall, "result summary should follow the kamishibai");
  assert.ok(detailsCall > summaryCall, "raw details should follow the result summary");
  assert.match(presentation, /詳細へ ↓/);
  assert.match(presentation, /詳細を見る ↓/);
  assert.match(presentation, /details\.open = false/);
});

test("scene kind drives explicit phase labels without generic combat copy", () => {
  assert.match(presentation, /function scenePhaseLabel/);
  assert.match(presentation, /"combat-opening": "遭遇"/);
  assert.match(presentation, /"combat-climax": "戦闘"/);
  assert.match(presentation, /injury: "負傷"/);
  assert.match(presentation, /retreat: "撤退"/);
  assert.match(presentation, /defeat: "敗走"/);
  assert.match(presentation, /return: "帰還"/);
  assert.doesNotMatch(presentation, /"遠征の途中"/);
});

test("paper theatre keeps only one page counter and two navigation actions", () => {
  assert.match(presentation, /expedition-kamishibai__mark/);
  assert.doesNotMatch(presentation, /expedition-kamishibai__counter/);
  assert.doesNotMatch(styles, /\.expedition-kamishibai__counter/);
  assert.match(presentation, /nav\.append\(previous, next\)/);
  assert.match(styles, /grid-template-columns: 1fr 1fr/);
});

test("paper theatre is the only authored story surface while raw chronology remains available", () => {
  assert.match(presentation, /buildExpeditionNarrative/);
  assert.match(presentation, /renderKamishibai\(content, report, generatedNarrative\)/);
  assert.doesNotMatch(presentation, /renderBattleNarrative/);
  assert.doesNotMatch(presentation, /BATTLE NARRATIVE/);
  assert.doesNotMatch(presentation, /遠征記/);
  assert.match(presentation, /時系列と戦闘数値を確認する/);
  assert.match(presentation, /details\.dataset\.expeditionDetails/);
  assert.match(presentation, /expedition-log--report-details/);
  assert.match(styles, /\.expedition-log--report-details/);
});

test("battle scenes render composition layers while keeping the fixed-asset fallback", () => {
  assert.match(presentation, /CrownlessExpeditionVisualComposition/);
  assert.match(presentation, /buildBattleComposition/);
  assert.match(presentation, /appendBattleComposition/);
  assert.match(presentation, /visual\.dataset\.sceneKind = composition\.kind/);
  assert.match(presentation, /visual\.dataset\.outcome = composition\.outcome/);
  assert.match(presentation, /expedition-kamishibai__battle-layer/);
  assert.match(presentation, /if \(composition\)/);
  assert.match(presentation, /if \(resolved\.assetPath\)/);
});

test("opening, climax, injury, and retreat states have distinct responsive compositions", () => {
  assert.match(battleStyles, /data-scene-kind="combat-opening"/);
  assert.match(battleStyles, /data-scene-kind="combat-climax"/);
  assert.match(battleStyles, /data-outcome="victory"/);
  assert.match(battleStyles, /data-outcome="retreat"/);
  assert.match(battleStyles, /data-scene-kind="injury"/);
  assert.match(battleStyles, /data-scene-kind="defeat"/);
  assert.match(battleStyles, /battle-layer--enemy-rear-2/);
  assert.match(battleStyles, /battle-layer--silhouette/);
  assert.match(battleStyles, /@media \(max-width: 600px\)/);
  assert.match(battleStyles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("kamishibai offers phone-friendly navigation and manuscript visual motifs", () => {
  assert.match(styles, /\.expedition-kamishibai__visual/);
  assert.match(styles, /data-motif="forest"/);
  assert.match(styles, /data-motif="combat-beast"/);
  assert.match(styles, /min-height: 44vh/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(presentation, /← 前の場面/);
  assert.match(presentation, /次の場面 →/);
});
