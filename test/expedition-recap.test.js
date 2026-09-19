const test = require("node:test");
const assert = require("node:assert/strict");
const Recap = require("../src/expedition-recap.js");

test("safe return recap stays within three factual lines", () => {
  const lines = Recap.recapFromReport({ place: "囁きの森", died: false, scrap: 17, gear: ["牙の短剣"] });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /囁きの森.*生還/);
  assert.match(lines[1], /牙の短剣.*持ち帰/);
  assert.match(lines[2], /次/);
});

test("defeat recap reflects the actual loss without inventing a victory", () => {
  const lines = Recap.recapFromReport({ place: "鐘なき塔", died: true, scrap: 9, gear: [] });
  assert.equal(lines.length, 3);
  assert.match(lines[0], /倒れた/);
  assert.match(lines[1], /9鉄片.*残した/);
  assert.doesNotMatch(lines.join(" "), /生還した/);
});
