const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Cells = require("../src/exploration-cell-runtime.js");

test("expedition profile measures novelty against coarse known territory, not a home coordinate", () => {
  const known = ["cell:16:1000:1000", "cell:16:1001:1000"];

  const daily = Cells.expeditionProfile("cell:16:1004:1000", known);
  const nearby = Cells.expeditionProfile("cell:16:1012:1000", known);
  const long = Cells.expeditionProfile("cell:16:1040:1000", known);

  assert.equal(daily.tier, "daily");
  assert.equal(nearby.tier, "nearby");
  assert.equal(long.tier, "long");
  assert.ok(daily.score < nearby.score);
  assert.ok(nearby.score < long.score);
  assert.equal(long.unknownChance, 1);
  assert.doesNotMatch(JSON.stringify(long), /latitude|longitude|home|address/i);
});

test("the current cell does not collapse expedition distance when it has already been recorded", () => {
  const current = "cell:16:1040:1000";
  const known = ["cell:16:1000:1000", current];
  const profile = Cells.expeditionProfile(current, known);

  assert.equal(profile.tier, "long");
  assert.equal(profile.nearestKnownCells, 40);
});

test("long-distance expeditions veil one unknown geographic destination and reveal the real identity on investigation", () => {
  const profile = Cells.expeditionProfile("cell:16:1040:1000", ["cell:16:1000:1000"]);
  const source = [
    { title: "古い水門", signal: "石組みが残る", contentKind: "dungeon", features: ["water"], palette: "water", sourceRef: "osm:way:1", realPlaceName: "水門" },
    { title: "丘の道標", signal: "高みから道が分かれる", contentKind: "encounter", features: ["height"], palette: "road", sourceRef: "osm:node:2", realPlaceName: "道標" }
  ];

  const veiled = Cells.applyUnknownness(source, profile, () => false);
  assert.equal(veiled.length, 2);
  assert.equal(veiled[0].title, "？");
  assert.equal(veiled[0].contentKind, "mystery");
  assert.equal(veiled[0].realPlaceName, "");
  assert.equal(veiled[0].mysteryIdentity.sourceRef, "osm:way:1");

  const revealed = Cells.resolveDiscovery(veiled[0]);
  assert.equal(revealed.title, "古い水門");
  assert.equal(revealed.contentKind, "dungeon");
  assert.equal(revealed.sourceRef, "osm:way:1");
});

test("known destinations are not turned back into first-discovery mysteries on revisit", () => {
  const profile = Cells.expeditionProfile("cell:16:1040:1000", ["cell:16:1000:1000"]);
  const source = [
    { title: "既知の塔", sourceRef: "osm:node:known" },
    { title: "未踏の井戸", sourceRef: "osm:node:new" }
  ];

  const oneNew = Cells.applyUnknownness(source, profile, (item) => item.sourceRef === "osm:node:known");
  assert.equal(oneNew[0].title, "既知の塔");
  assert.equal(oneNew[1].title, "？");

  const allKnown = Cells.applyUnknownness(source, profile, () => true);
  assert.deepEqual(allKnown.map((item) => item.title), ["既知の塔", "未踏の井戸"]);
});

test("browser bridge owns geography coupling and resolves mystery before the existing journal records it", () => {
  const cellSource = fs.readFileSync(path.join(__dirname, "../src/exploration-cell-runtime.js"), "utf8");
  const bridgeSource = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  assert.doesNotMatch(cellSource, /GeographyApi|Overpass|google\.maps|mapbox|leaflet/i);
  assert.match(bridgeSource, /createProxyLocationDiscoveryProvider = function createProviderWithExpeditionUnknowns/);
  assert.match(bridgeSource, /provider\.discover = async function discoverWithExpeditionUnknowns/);
  assert.match(bridgeSource, /Cells\.applyUnknownness\(discovered, lastProfile, isKnown\)/);
  assert.match(bridgeSource, /Core\.discoverLocation = function discoverLocationWithUnknownReveal/);
  assert.match(bridgeSource, /Object\.assign\(visible, resolved\)/);
  assert.match(bridgeSource, /last\.wasUnknownDiscovery = true/);
  assert.ok(indexSource.indexOf("src/exploration-cell-runtime.js") < indexSource.indexOf("src/expedition-unknown-bridge.js"));
});
