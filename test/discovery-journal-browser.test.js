const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Journal = require("../src/discovery-journal-browser.js");
const LocationVisuals = require("../src/location-visuals.js");

const journalSource = fs.readFileSync(path.join(__dirname, "../src/discovery-journal-browser.js"), "utf8");
const locationVisualSource = fs.readFileSync(path.join(__dirname, "../src/location-visuals.js"), "utf8");
const cssSource = fs.readFileSync(path.join(__dirname, "../discovery-journal-browser.css"), "utf8");

test("journal lists all discovered places newest first without coordinates", () => {
  const entries = Journal.journalEntries({
    discoveries: {
      older: {
        key: "sim:older",
        name: "古い礼拝堂",
        state: "discovered",
        terrain: ["sacred"],
        contentKind: "event",
        firstDiscoveredAt: 100,
        visits: 1,
        latitude: 35.69,
        longitude: 139.78
      },
      newer: {
        key: "geo:way:1:dungeon:height",
        name: "丘の崩れた物見台",
        baseTitle: "崩れた物見台",
        state: "cleared",
        terrain: ["height"],
        contentKind: "dungeon",
        firstDiscoveredAt: 200,
        visits: 3
      }
    }
  });

  assert.deepEqual(entries.map((entry) => entry.key), ["geo:way:1:dungeon:height", "sim:older"]);
  const model = Journal.entryViewModel(entries[0], LocationVisuals);
  assert.equal(model.name, "丘の崩れた物見台");
  assert.equal(model.stateLabel, "踏破済み");
  assert.equal(model.kindLabel, "遺構");
  assert.equal(model.terrainLabel, "高地");
  assert.equal(model.visits, 3);
  assert.equal(model.visual.assetPath, "assets/locations/ruined-watchtower.png");
  assert.equal("latitude" in model, false);
  assert.equal("longitude" in model, false);
});

test("journal keeps places readable when no location visual exists", () => {
  const model = Journal.entryViewModel({
    key: "sim:chapel",
    name: "崩れた礼拝堂",
    state: "investigated",
    terrain: ["sacred", "woods"],
    contentKind: "event",
    firstDiscoveredAt: 1234,
    visits: 2
  }, LocationVisuals);

  assert.equal(model.visual, null);
  assert.equal(model.stateLabel, "調査済み");
  assert.equal(model.kindLabel, "異変");
  assert.equal(model.terrainLabel, "聖域 / 森");
  assert.equal(model.visits, 2);
});

test("empty and corrupt discovery journals fail closed", () => {
  assert.deepEqual(Journal.journalEntries(null), []);
  assert.deepEqual(Journal.journalEntries({ discoveries: [] }), []);
  assert.deepEqual(Journal.journalEntries({ discoveries: "broken" }), []);
});

test("wall map opens a responsive journal browser with selectable details", () => {
  assert.match(locationVisualSource, /DOMContentLoaded/);
  assert.match(locationVisualSource, /discovery-journal-browser\.js/);
  assert.match(journalSource, /document\.getElementById\("hearth-map-focus"\)/);
  assert.match(journalSource, /event\.stopImmediatePropagation\(\)/);
  assert.match(journalSource, /viewer\.id = "discovery-journal-browser"/);
  assert.match(journalSource, /className = `discovery-journal-entry/);
  assert.match(journalSource, /renderDetail\(detail, entry\)/);
  assert.match(journalSource, /resolveLocationVisual/);
  assert.match(journalSource, /event\.key === "Escape"/);
  assert.match(journalSource, /event\.target === viewer/);
  assert.match(journalSource, /探索録はまだ白紙だ/);
  assert.match(cssSource, /\.discovery-journal-browser\s*\{[\s\S]*position:\s*fixed/);
  assert.match(cssSource, /grid-template-columns:\s*minmax\(210px/);
  assert.match(cssSource, /@media \(max-width:\s*700px\)/);
  assert.doesNotMatch(journalSource, /latitude|longitude|mapOrigin|representativeCoordinate/);
});
