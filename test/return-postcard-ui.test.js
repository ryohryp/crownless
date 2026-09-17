"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fromReportPanel } = require("../src/return-postcard-ui");

test("safe return creates a compact expedition postcard", () => {
  const card = fromReportPanel("SAFE RETURN / 霧深き森\n+12 鉄片を確保\n新しい一本を、火へ。");
  assert.equal(card.title, "遠征の記録");
  assert.equal(card.region, "霧深き森");
  assert.equal(card.memory, "新しい武具を火へ持ち帰った");
});

test("failed expedition does not create a success postcard", () => {
  assert.equal(fromReportPanel("EXPEDITION LOST / 霧深き森\n命だけを、持ち帰った。"), null);
});

test("postcard UI contract contains no precise movement fields", () => {
  const card = fromReportPanel("SAFE RETURN / 灰冠の廟\n+8 鉄片を確保");
  assert.equal("latitude" in card, false);
  assert.equal("longitude" in card, false);
  assert.equal("route" in card, false);
  assert.equal("history" in card, false);
  assert.equal("regionKey" in card, false);
});
