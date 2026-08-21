const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const LocationVisuals = require("../src/location-visuals.js");

const RUINED_WATCHTOWER_VISUAL = {
  id: "ruined-watchtower",
  assetPath: "assets/locations/ruined-watchtower.png",
  alt: "崩れた石造りの物見台"
};

test("崩れた物見台 resolves to the Ruined Watchtower static asset", () => {
  const entry = {
    name: "近所の丘の崩れた物見台",
    baseTitle: "崩れた物見台",
    contentKind: "dungeon",
    firstDiscoveredAt: 100,
    visits: 1
  };

  assert.deepEqual(LocationVisuals.resolveLocationVisual(entry), RUINED_WATCHTOWER_VISUAL);
  assert.equal(entry.assetPath, undefined);
});

test("legacy discovery name resolves the location visual when baseTitle is absent", () => {
  const entry = {
    name: "崩れた物見台",
    baseTitle: "",
    contentKind: "dungeon",
    firstDiscoveredAt: 100,
    visits: 1
  };

  assert.deepEqual(LocationVisuals.resolveLocationVisual(entry), RUINED_WATCHTOWER_VISUAL);
});

test("legacy simulated watchfire hill resolves to the same watchtower archetype", () => {
  const entry = {
    name: "消えかけた烽火台",
    baseTitle: "",
    contentKind: "combat",
    firstDiscoveredAt: 100,
    visits: 1
  };

  assert.deepEqual(LocationVisuals.resolveLocationVisual(entry), RUINED_WATCHTOWER_VISUAL);
});

test("height dungeon discovery resolves by archetype even when its title drifted", () => {
  const entry = {
    name: "北丘の古い塔跡",
    baseTitle: "古い塔跡",
    terrain: ["height"],
    contentKind: "dungeon",
    firstDiscoveredAt: 100,
    visits: 1
  };

  assert.deepEqual(LocationVisuals.resolveLocationVisual(entry), RUINED_WATCHTOWER_VISUAL);
});

test("height alone does not leak the watchtower visual to unrelated discoveries", () => {
  assert.equal(LocationVisuals.resolveLocationVisual({ baseTitle: "高台の野営地", terrain: ["height"], contentKind: "encounter" }), null);
});

test("unmapped discoveries do not unlock a location visual", () => {
  assert.equal(LocationVisuals.resolveLocationVisual({ baseTitle: "森の野営地" }), null);
  assert.equal(LocationVisuals.resolveLocationVisual(null), null);
});

test("latest mapped discovery visual is resolved from world knowledge without persisting asset metadata", () => {
  const worldKnowledge = {
    discoveries: {
      oldTower: {
        baseTitle: "崩れた物見台",
        name: "古い物見台",
        firstDiscoveredAt: 10,
        visits: 2
      },
      newerUnmapped: {
        baseTitle: "苔むした聖域",
        name: "新しい聖域",
        firstDiscoveredAt: 30,
        visits: 1
      },
      newestTower: {
        baseTitle: "崩れた物見台",
        name: "新しい物見台",
        firstDiscoveredAt: 20,
        visits: 1
      }
    }
  };

  const resolved = LocationVisuals.resolveLatestDiscoveredVisual(worldKnowledge);
  assert.equal(resolved.entry.name, "新しい物見台");
  assert.equal(resolved.visual.id, "ruined-watchtower");
  assert.equal(worldKnowledge.discoveries.newestTower.assetPath, undefined);
});

test("location visual runtime and future location assets trigger Production deployment", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "vercel-production.yml"), "utf8");
  assert.match(workflow, /"index\.html"/);
  assert.match(workflow, /"src\/location-visuals\.js"/);
  assert.match(workflow, /"src\/hearth-presentation\.js"/);
  assert.match(workflow, /"assets\/locations\/\*\*"/);
});

test("Ruined Watchtower Candidate is a decoded 16:9 PNG at the canonical runtime path", () => {
  const assetPath = path.join(__dirname, "..", "assets", "locations", "ruined-watchtower.png");
  const bytes = fs.readFileSync(assetPath);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  assert.ok(bytes.length > pngSignature.length, "location asset should not be empty");
  assert.deepEqual(bytes.subarray(0, pngSignature.length), pngSignature);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  assert.equal(bytes.readUInt32BE(16), 1280);
  assert.equal(bytes.readUInt32BE(20), 720);
});

test("Ruined Watchtower registry preserves Candidate status and fail-closed generation policy", () => {
  const registry = fs.readFileSync(path.join(__dirname, "..", "assets", "locations", "README.md"), "utf8");
  assert.match(registry, /project_id: `crownless`/);
  assert.match(registry, /asset_type: `background`/);
  assert.match(registry, /location_id: `ruined_watchtower`/);
  assert.match(registry, /status: `candidate`/);
  assert.match(registry, /Approved Visual Anchor: `false`/);
  assert.match(registry, /must_use_approved_anchor=false/);
  assert.match(registry, /must_not_chain_from_candidate=true/);
  assert.match(registry, /must_review_after_generation=true/);
});
