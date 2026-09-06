const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const reportPath = "qa-output/krita-504/krita-run-report.json";
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
assert.equal(report.ok, true, report.error || "Krita recipe did not complete");

const requiredOps = [
  "open-document",
  "select-and-lock-base-layer",
  "import-image-as-layer",
  "set-layer-visibility-opacity",
  "create-correction-layer",
  "transform-layer",
  "local-correction",
  "save-editable-source",
  "export-runtime-asset"
];
for (const operation of requiredOps) {
  assert.ok(report.operations.includes(operation), `missing Krita operation: ${operation}`);
}

const requiredFiles = [report.baseSnapshot, report.editableSource, report.runtimeExport];
for (const path of requiredFiles) assert.ok(fs.statSync(path).size > 0, `empty output: ${path}`);
assert.ok(fs.statSync(report.editableSource).size > 1024, "editable .kra is suspiciously small");

const digest = (path) => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
assert.notEqual(digest(report.baseSnapshot), digest(report.runtimeExport), "runtime export must contain a local edit");
assert.ok(report.width >= 640 && report.height >= 360, "representative asset is too small for screen QA");

console.log(`Krita phase-1 contract OK: ${report.width}x${report.height}, ${requiredOps.length} operations`);
