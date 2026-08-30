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

test("atlas scan remembers new geographic discoveries and persists only coarse geography", () => {
  let stored = {
    phase: "hub",
    expedition: null,
    worldKnowledge: { discoveries: {} }
  };
  const Core = {
    loadSafeState() { return JSON.parse(JSON.stringify(stored)); },
    sanitizeWorldKnowledge(value) { return value || { discoveries: {} }; },
    explorationAreaFromLocation() { return { id: "area:14:25:50", zoom: 14, x: 25, y: 50 }; },
    recordExploredCell(state) {
      state.worldKnowledge.exploredCells = {
        "cell:16:102:202": { id: "cell:16:102:202", firstExploredAt: 123 }
      };
      return { cell: { id: "cell:16:102:202", zoom: 16, x: 102, y: 202 }, added: true };
    },
    saveWorldKnowledge(state) { stored = JSON.parse(JSON.stringify(state)); return true; }
  };
  const runtime = {
    currentAreaId: "area:14:25:50",
    discoveries: [
      {
        title: "中川の血濡れの渡し場",
        baseTitle: "血濡れの渡し場",
        sourceRef: "way:901",
        contentKind: "encounter",
        features: ["water", "crossing"],
        representativeCoordinate: { latitude: 35.69, longitude: 139.78 },
        mapOrigin: { latitude: 35.68, longitude: 139.77 }
      }
    ],
    worldKnowledgeKey() { return "geo:way:901:encounter:crossing+water"; }
  };

  const result = Atlas.rememberScannedDiscoveries(Core, runtime, 999);
  assert.equal(result.newCount, 1);
  assert.equal(result.rememberedCount, 1);
  assert.equal(result.currentCell.id, "cell:16:102:202");
  const entry = stored.worldKnowledge.discoveries["geo:way:901:encounter:crossing+water"];
  assert.equal(entry.name, "中川の血濡れの渡し場");
  assert.equal(entry.areaId, "area:14:25:50");
  assert.equal(entry.visits, 1);
  assert.deepEqual(entry.terrain, ["water", "crossing"]);
  assert.ok(stored.worldKnowledge.exploredCells["cell:16:102:202"]);
  assert.doesNotMatch(JSON.stringify(stored), /latitude|longitude|35\.69|139\.78|35\.68|139\.77/);
});

test("rescanning the same discovery keeps it remembered without inflating visits", () => {
  let stored = {
    phase: "hub",
    expedition: null,
    worldKnowledge: {
      discoveries: {
        "geo:node:7:dungeon:height": {
          key: "geo:node:7:dungeon:height",
          name: "古い物見台",
          baseTitle: "崩れた物見台",
          terrain: ["height"],
          contentKind: "dungeon",
          state: "discovered",
          firstDiscoveredAt: 100,
          visits: 1,
          areaId: "area:14:12:13"
        }
      }
    }
  };
  const Core = {
    loadSafeState() { return JSON.parse(JSON.stringify(stored)); },
    sanitizeWorldKnowledge(value) { return value; },
    explorationAreaFromLocation() { return { id: "area:14:12:13" }; },
    saveWorldKnowledge(state) { stored = JSON.parse(JSON.stringify(state)); return true; }
  };
  const runtime = {
    currentAreaId: "area:14:12:13",
    discoveries: [{
      title: "丘の崩れた物見台",
      baseTitle: "崩れた物見台",
      sourceRef: "node:7",
      contentKind: "dungeon",
      features: ["height"],
      representativeCoordinate: { latitude: 35.7, longitude: 139.8 }
    }],
    worldKnowledgeKey() { return "geo:node:7:dungeon:height"; }
  };

  const result = Atlas.rememberScannedDiscoveries(Core, runtime, 200);
  assert.equal(result.newCount, 0);
  assert.equal(stored.worldKnowledge.discoveries["geo:node:7:dungeon:height"].visits, 1);
  assert.equal(stored.worldKnowledge.discoveries["geo:node:7:dungeon:height"].firstDiscoveredAt, 100);
  assert.equal(stored.worldKnowledge.discoveries["geo:node:7:dungeon:height"].name, "丘の崩れた物見台");
});

test("atlas open automatically scans nearby world and offers a manual rescan", () => {
  assert.match(source, /scanNearby\(Core, root/);
  assert.match(source, /CrownlessLocationDiscoveryRuntime/);
  assert.match(source, /周辺を再調査/);
  assert.match(source, /SCAN_COOLDOWN_MS = 30000/);
  assert.match(source, /crownless:world-knowledge-updated/);
  assert.match(css, /world-atlas-scan/);
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