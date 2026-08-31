const test = require("node:test");
const assert = require("node:assert/strict");
const Atlas = require("../src/world-atlas.js");

const EPSILON = 1e-9;

function assertInsideWorldFrame(model) {
  const inset = Atlas.MARKER_INSET_PERCENT;
  for (const cell of model.cells) {
    assert.ok(cell.left >= inset - EPSILON, `${cell.id} starts before the left inset`);
    assert.ok(cell.top >= inset - EPSILON, `${cell.id} starts before the top inset`);
    assert.ok(cell.left + cell.width <= 100 - inset + EPSILON, `${cell.id} exceeds the right inset`);
    assert.ok(cell.top + cell.height <= 100 - inset + EPSILON, `${cell.id} exceeds the bottom inset`);
  }
  for (const discovery of model.discoveries) {
    assert.ok(discovery.left >= inset - EPSILON && discovery.left <= 100 - inset + EPSILON);
    assert.ok(discovery.top >= inset - EPSILON && discovery.top <= 100 - inset + EPSILON);
  }
}

test("world atlas keeps a compact first explored area padded instead of over-zooming it", () => {
  const model = Atlas.atlasViewModel({
    exploredCells: {
      "cell:16:100:200": { id: "cell:16:100:200" }
    }
  }, { id: "cell:16:100:200" });

  assert.equal(model.bounds.width, 3);
  assert.equal(model.bounds.height, 3);
  assert.equal(model.bounds.span, Atlas.WORLD_MIN_SPAN_CELLS);
  assert.equal(model.bounds.inset, Atlas.MARKER_INSET_PERCENT);
  assertInsideWorldFrame(model);
  assert.ok(model.cells[0].width < 20, "the first known area should retain breathing room around the map");
});

test("world atlas dynamically zooms out for sparse horizontal exploration without stretching the short axis", () => {
  const near = Atlas.atlasViewModel({
    exploredCells: {
      "cell:16:100:200": { id: "cell:16:100:200" },
      "cell:16:101:200": { id: "cell:16:101:200" }
    }
  }, null);
  const far = Atlas.atlasViewModel({
    exploredCells: {
      "cell:16:100:200": { id: "cell:16:100:200" },
      "cell:16:160:200": { id: "cell:16:160:200" }
    }
  }, null);

  assert.ok(far.bounds.span > near.bounds.span);
  assert.ok(far.cells[0].width < near.cells[0].width, "cell scale should shrink as explored bounds expand");
  assert.equal(far.cells[0].width, far.cells[0].height, "world cells should share one scale instead of stretching X/Y independently");
  assertInsideWorldFrame(far);

  const tops = far.cells.map((cell) => cell.top);
  assert.ok(Math.min(...tops) > Atlas.MARKER_INSET_PERCENT, "a horizontal route should stay vertically centered rather than filling the full map height");
});

test("world atlas dynamically zooms out for sparse vertical exploration and keeps discoveries inside phone-safe padding", () => {
  const model = Atlas.atlasViewModel({
    exploredCells: {
      "cell:16:102:120": { id: "cell:16:102:120" },
      "cell:16:102:190": { id: "cell:16:102:190" }
    },
    discoveries: {
      tower: {
        key: "tower",
        name: "崩れた物見台",
        areaId: "area:14:25:30",
        contentKind: "dungeon",
        terrain: ["height"]
      },
      ford: {
        key: "ford",
        name: "古い渡し場",
        areaId: "area:14:25:47",
        contentKind: "encounter",
        terrain: ["water", "crossing"]
      }
    }
  }, { id: "cell:16:102:190" });

  assert.ok(model.bounds.height > model.bounds.width);
  assert.equal(model.bounds.span, model.bounds.height);
  assertInsideWorldFrame(model);
  assert.ok(model.discoveries.every((entry) => entry.left >= 8 && entry.left <= 92));
  assert.ok(model.discoveries.every((entry) => entry.top >= 8 && entry.top <= 92));
});

test("world atlas fit change leaves the nearby-map projection contract untouched", () => {
  const projected = Atlas.projectNearbyPoint(
    { latitude: 35.68, longitude: 139.77 },
    { latitude: 35.681, longitude: 139.772 },
    Atlas.NEARBY_RADIUS_METRES
  );

  assert.ok(projected.x >= 16 && projected.x <= 84);
  assert.ok(projected.y >= 16 && projected.y <= 84);
  assert.equal(Atlas.NEARBY_RADIUS_METRES, 650);
});
