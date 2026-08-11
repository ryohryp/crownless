const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const MapUI = require("../src/exploration-map-presentation.js");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("frontier cells are adjacent, unique, and avoid occupied cells", () => {
  const occupied = new Set(["0,0", "0,-1"]);
  const cells = MapUI.chooseFrontierCells({ x: 0, y: 0 }, occupied, 0, 3);

  assert.equal(cells.length, 3);
  assert.equal(new Set(cells.map((cell) => cell.key)).size, 3);
  assert.ok(cells.every((cell) => !occupied.has(cell.key)));
  assert.ok(cells.every((cell) => Math.max(Math.abs(cell.x), Math.abs(cell.y)) === 1));
});

test("frontier direction rotates by exploration step", () => {
  const occupied = new Set(["0,0"]);
  const first = MapUI.chooseFrontierCells({ x: 0, y: 0 }, occupied, 0, 1)[0];
  const second = MapUI.chooseFrontierCells({ x: 0, y: 0 }, occupied, 1, 1)[0];

  assert.notEqual(first.key, second.key);
});

test("frontier hints hide exact encounter type before reveal", () => {
  assert.equal(MapUI.frontierHint("戦闘 / 敵影"), "動く影");
  assert.equal(MapUI.frontierHint("探索イベント / 隠し荷"), "荷の跡");
  assert.equal(MapUI.frontierHint("ダンジョン / 入口"), "深い影");
  assert.equal(MapUI.frontierHint("標的 / 灰牙"), "強い気配");
});

test("visible signals can be restored to stable event kinds", () => {
  assert.equal(MapUI.inferEventKind("探索イベント / 隠し荷"), "cache");
  assert.equal(MapUI.inferEventKind("探索イベント / 祠"), "shrine");
  assert.equal(MapUI.inferEventKind("探索イベント / 人物"), "traveler");
  assert.equal(MapUI.inferEventKind("戦闘 / 待ち伏せ"), "ambush");
  assert.equal(MapUI.inferEventKind("標的 / 灰牙"), "hunt");
});

test("only safe map knowledge is serialized between expeditions", () => {
  const persisted = MapUI.persistableCells(new Map([
    ["0,0", { x: 0, y: 0, state: "hearth", name: "灰炉" }],
    ["1,0", { x: 1, y: 0, state: "visited", name: "死王の旧街道", glyph: "━" }],
    ["2,0", { x: 2, y: 0, state: "discovered", name: "崩れた礼拝堂" }],
    ["3,0", { x: 3, y: 0, state: "frontier", name: "未知" }]
  ]));

  assert.deepEqual(persisted.map((cell) => cell.state).sort(), ["hearth", "visited"]);
  assert.equal(persisted.find((cell) => cell.state === "visited").name, "死王の旧街道");
});

test("browser loads the fog-map presentation after existing presentation layers", () => {
  const noncombat = index.indexOf('src/noncombat-presentation.js');
  const map = index.indexOf('src/exploration-map-presentation.js');
  assert.ok(noncombat >= 0);
  assert.ok(map > noncombat);
});
