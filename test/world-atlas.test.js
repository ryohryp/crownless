const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Atlas = require("../src/world-atlas.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../world-atlas.css"), "utf8");
const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("atlas parses coarse cell and area identities without coordinates", () => {
  assert.deepEqual(Atlas.parseCellId("cell:16:100:200"), { id: "cell:16:100:200", zoom: 16, x: 100, y: 200 });
  assert.deepEqual(Atlas.parseAreaId("area:14:25:50"), { id: "area:14:25:50", zoom: 14, x: 25, y: 50 });
  assert.equal(Atlas.parseCellId("cell:99:1:1"), null);
  assert.equal(Atlas.parseAreaId("area:14:-1:1"), null);
});

test("atlas model shows explored, unknown fringe, current cell, and coarse discovery markers", () => {
  const model = Atlas.atlasViewModel({
    exploredCells: {
      "cell:16:100:200": { id: "cell:16:100:200", firstExploredAt: 1 },
      "cell:16:101:200": { id: "cell:16:101:200", firstExploredAt: 2 }
    },
    discoveries: {
      tower: {
        key: "tower",
        name: "崩れた物見台",
        state: "discovered",
        visits: 2,
        terrain: ["height"],
        contentKind: "dungeon",
        areaId: "area:14:25:50"
      }
    }
  }, { id: "cell:16:101:200" });

  assert.equal(model.exploredCount, 2);
  assert.equal(model.discoveryCount, 1);
  assert.ok(model.cells.some((cell) => cell.known));
  assert.ok(model.cells.some((cell) => !cell.known));
  assert.ok(model.cells.some((cell) => cell.current && cell.id === "cell:16:101:200"));
  assert.equal(model.discoveries[0].name, "崩れた物見台");
  assert.equal(model.discoveries[0].stateLabel, "発見済み / 遠征候補");
  assert.ok(Number.isFinite(model.discoveries[0].left));
  assert.ok(Number.isFinite(model.discoveries[0].top));
});

test("area mapping uses only coarse ids and never restores raw movement data", () => {
  assert.deepEqual(Atlas.areaCenterInCellSpace("area:14:25:50", 16), { x: 102, y: 202 });
  const model = Atlas.atlasViewModel({
    exploredCells: { "cell:16:102:202": { id: "cell:16:102:202" } },
    discoveries: {
      a: { key: "a", name: "旧街道", areaId: "area:14:25:50", latitude: 35.6, longitude: 139.7, routeHistory: [1, 2] }
    }
  }, null);
  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /latitude|longitude|routeHistory|35\.6|139\.7/);
});

test("discoveries without a coarse area stay visible as unanchored notes instead of fake pins", () => {
  const model = Atlas.atlasViewModel({
    discoveries: { sim: { key: "sim", name: "崩れた礼拝堂", state: "discovered", visits: 1 } }
  }, null);
  assert.equal(model.discoveries.length, 0);
  assert.equal(model.unplacedDiscoveries.length, 1);
  assert.equal(model.unplacedDiscoveries[0].name, "崩れた礼拝堂");
});

test("atlas remains manuscript UI rather than a navigation map and has phone rules", () => {
  assert.match(source, /THE WRITTEN WORLD \/ WORLD ATLAS/);
  assert.match(source, /正確な道路図ではない/);
  assert.doesNotMatch(source, /google\.maps|mapbox|leaflet/i);
  assert.match(css, /world-atlas-cell\.unknown/);
  assert.match(css, /world-atlas-cell\.known/);
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(runtimeSource, /src\/world-atlas\.js/);
});
