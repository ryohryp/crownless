const test = require("node:test");
const assert = require("node:assert/strict");
const Actions = require("../src/discovery-actions.js");

function entry(overrides = {}) {
  return {
    key: "geo:node/123:event:road_hub+settlement",
    name: "古い街道の辻",
    state: "discovered",
    contentKind: "event",
    terrain: ["road_hub", "settlement"],
    areaId: "area:14:14554:6451",
    ...overrides
  };
}

test("road settlement discovery exposes expedition, event, and merchant actions", () => {
  const actions = Actions.buildDiscoveryActions(entry({ contentKind: "unknown" }));
  assert.deepEqual(actions.map((action) => action.kind), ["expedition", "event", "facility"]);
  assert.equal(actions[2].facilityKind, "merchant");
});

test("different discovery terrain produces different action sets", () => {
  const woods = Actions.buildDiscoveryActions(entry({ key: "geo:woods", terrain: ["woods"], contentKind: "unknown" }));
  const sacred = Actions.buildDiscoveryActions(entry({ key: "geo:sacred", terrain: ["sacred"], contentKind: "unknown" }));
  assert.deepEqual(woods.map((action) => action.kind), ["expedition"]);
  assert.deepEqual(sacred.map((action) => action.kind), ["expedition", "event"]);
});

test("same discovery identity keeps actions, local event, and merchant stock stable", () => {
  const source = entry({ contentKind: "unknown" });
  assert.deepEqual(Actions.buildDiscoveryActions(source), Actions.buildDiscoveryActions({ ...source }));
  assert.deepEqual(Actions.buildLocalEvent(source), Actions.buildLocalEvent({ ...source }));
  assert.deepEqual(Actions.merchantStock(source), Actions.merchantStock({ ...source }));
});

test("unknown discovery state cannot expose actions", () => {
  assert.deepEqual(Actions.buildDiscoveryActions(entry({ state: "hinted" })), []);
});

test("atlas action projections never include precise location fields", () => {
  const source = entry({ latitude: 35.123456, longitude: 139.123456, representativeCoordinate: { latitude: 1, longitude: 2 } });
  const projected = {
    actions: Actions.buildDiscoveryActions(source),
    event: Actions.buildLocalEvent(source),
    stock: Actions.merchantStock(source)
  };
  const json = JSON.stringify(projected);
  assert.doesNotMatch(json, /latitude|longitude|representativeCoordinate|routeHistory/i);
});
