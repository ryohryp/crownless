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

test("Atlas focus path keeps mobile summary status-only and causal routes directional", () => {
  assert.equal(Declutter.MOBILE_MAX, 700);
  assert.equal(typeof Declutter.decorateCausalRoutes, "function");
  assert.match(source, /territory-route-arrowhead/);
  assert.match(source, /marker-end/);
  assert.match(source, /data-territory-directional/);
  assert.match(source, /\.territory-atlas-summary span \{ display:none !important; \}/);
});

test("conquest payoff derives one next-target reason from current territory state", () => {
  const target = Declutter.conquestPayoffTarget({
    CrownlessTerritoryPhase1: {
      territories: () => [
        { key: "geo:held", owner: "player", entry: { name: "丘の物見台" }, meta: { effect: "街道攻略の所要時間を35%短縮" } },
        { key: "geo:next", owner: "npc", entry: { name: "街道の露店" }, meta: { effect: "資源地攻略の所要時間を25%短縮" } },
      ],
    },
  });
  assert.deepEqual(target, {
    key: "geo:next",
    name: "街道の露店",
    reason: "取れば、資源地攻略の所要時間を25%短縮。",
  });
  assert.equal(typeof Declutter.decorateConquestPayoff, "function");
  assert.match(source, /territory-conquest-temptation/);
  assert.match(source, /territory-support-write/);
  assert.match(source, /prefers-reduced-motion:reduce/);
});

test("mobile declutter remains presentation-only and bounded", () => {
  assert.equal(Declutter.MOBILE_MAX, 700);
  assert.match(source, /world-atlas-map--nearby/);
  assert.match(source, /data-territory-frontier/);
  assert.match(source, /territory-atlas-summary/);
  assert.doesNotMatch(source, /localStorage|latitude|longitude|control.?xp|buildingLevel|resource|dispatchExpedition/i);
});