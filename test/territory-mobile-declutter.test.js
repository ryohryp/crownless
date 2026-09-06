const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Declutter = require("../src/territory-mobile-declutter.js");
const source = fs.readFileSync(path.join(__dirname, "../src/territory-mobile-declutter.js"), "utf8");

test("overlapping territory points receive deterministic bounded offsets", () => {
  const points = [
    { key: "a", x: 100, y: 100 },
    { key: "b", x: 103, y: 102 },
    { key: "c", x: 101, y: 98 },
  ];
  const first = Declutter.layoutOffsets(points);
  const second = Declutter.layoutOffsets(points);
  assert.deepEqual(first, second);
  assert.deepEqual(first[0], { key: "a", x: 0, y: 0 });
  assert.ok(first.some((item) => item.x || item.y), "at least one close marker must move");
  first.forEach((item) => {
    assert.ok(Math.abs(item.x) <= 24);
    assert.ok(Math.abs(item.y) <= 28);
  });
});

test("well-separated points keep their geographic positions", () => {
  const offsets = Declutter.layoutOffsets([
    { key: "a", x: 20, y: 20 },
    { key: "b", x: 120, y: 120 },
    { key: "c", x: 240, y: 160 },
  ]);
  assert.ok(offsets.every((item) => item.x === 0 && item.y === 0));
});

test("mobile declutter remains presentation-only and bounded", () => {
  assert.equal(Declutter.MOBILE_MAX, 700);
  assert.match(source, /world-atlas-map--nearby/);
  assert.match(source, /data-territory-frontier/);
  assert.match(source, /territory-atlas-summary/);
  assert.doesNotMatch(source, /localStorage|latitude|longitude|control.?xp|buildingLevel|resource|dispatchExpedition/i);
});
