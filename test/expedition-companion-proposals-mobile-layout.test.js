"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "../expedition.css"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "../src/expedition-companion-proposals.js"), "utf8");

test("companion proposal panel keeps long copy in a single readable column", () => {
  assert.match(source, /data\.companionProposal = "true"/);
  assert.match(css, /\.expedition-form-feedback\[data-companion-proposal\]\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.expedition-form-feedback\[data-companion-proposal\]>span[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.expedition-form-feedback\[data-companion-proposal\]>small[^}]*overflow-wrap:anywhere/);
});

test("companion proposal actions stay tappable without horizontal overflow from 360 to 700px", () => {
  assert.match(css, /@media\(max-width:700px\)\{\.expedition-form-feedback\[data-companion-proposal\]/);
  assert.match(css, /\.expedition-form-feedback\[data-companion-proposal\]>\.ghost\{display:block;width:100%;min-width:0;min-height:44px/);
  assert.doesNotMatch(css, /\.expedition-form-feedback\[data-companion-proposal\][^}]*white-space:nowrap/);
});
