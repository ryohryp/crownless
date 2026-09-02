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

test("closed-door investigation reveals concrete follow-up actions instead of flavor-only copy", () => {
  const event = Actions.buildLocalEvent(entry({
    key: "geo:settlement:1",
    name: "古い市場跡",
    contentKind: "unknown",
    terrain: ["settlement"]
  }));

  assert.equal(event.title, "閉じた戸口の取引");
  const investigate = event.choices.find((choice) => choice.id === "investigate");
  assert.match(investigate.result, /北の古井戸/);
  assert.match(investigate.result, /黒い石/);
  assert.ok(Array.isArray(investigate.followUps));
  assert.ok(investigate.followUps.length >= 2);
  assert.deepEqual(investigate.followUps.map((choice) => choice.label), ["黒い石について聞く", "商品の包みを見る", "店主の後をつける"]);

  const rumor = investigate.followUps.find((choice) => choice.id === "ask-black-stone");
  assert.match(rumor.result, /井戸の底ではなく、その脇/);
  assert.equal(rumor.effect.kind, "rumor");
  assert.equal(rumor.effect.name, "北の古井戸の噂");

  const merchant = investigate.followUps.find((choice) => choice.id === "inspect-bundle");
  assert.equal(merchant.effect.kind, "merchant");
});

test("wounded traveler investigation exposes a concrete armed-band lead and choices", () => {
  const event = Actions.buildLocalEvent(entry({
    key: "geo:settlement:2",
    name: "街道脇の宿場跡",
    contentKind: "unknown",
    terrain: ["settlement"]
  }));

  assert.equal(event.title, "傷ついた旅人");
  const investigate = event.choices.find((choice) => choice.id === "investigate");
  assert.match(investigate.result, /赤布/);
  assert.match(investigate.result, /武装集団/);
  assert.ok(Array.isArray(investigate.followUps));
  assert.deepEqual(investigate.followUps.map((choice) => choice.label), ["赤布の武装集団について聞く", "捨てた荷車の場所を確かめる", "旅人を休ませる"]);

  const rumor = investigate.followUps.find((choice) => choice.id === "ask-red-cloth-band");
  assert.equal(rumor.effect.kind, "rumor");
  assert.equal(rumor.effect.name, "赤布の武装集団の噂");
  assert.match(rumor.effect.baseTitle, /誰かを探している/);

  const risk = investigate.followUps.find((choice) => choice.id === "check-abandoned-cart");
  assert.equal(risk.effect, undefined);
  assert.match(risk.result, /遠征の備え/);
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