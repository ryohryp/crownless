"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "expedition.css"), "utf8");

test("report history select is width-constrained inside the folio", () => {
  assert.match(css, /\.expedition-report-history \.expedition-secondary\{[^}]*width:100%[^}]*max-width:100%[^}]*min-width:0/);
});

test("report history stacks copy and select on phone widths", () => {
  assert.match(css, /@media\(max-width:600px\)\{\.expedition-report-history\{grid-template-columns:minmax\(0,1fr\)/);
});
