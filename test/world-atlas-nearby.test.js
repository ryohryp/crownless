const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Atlas = require("../src/world-atlas.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../world-atlas.css"), "utf8");

test("GPS-ready atlas defaults to the nearby discovery view", () => {
  const nearby = [{ name: "血濡れの渡し場" }];
  assert.equal(Atlas.initialAtlasView({ state: "ready" }, nearby), "nearby");
  assert.equal(Atlas.initialAtlasView({ state: "failed" }, nearby), "world");
  assert.equal(Atlas.initialAtlasView({ state: "ready" }, nearby, "world"), "world");
  assert.equal(Atlas.initialAtlasView({ state: "ready" }, [], "nearby"), "world");
});

test("nearby model uses ephemeral coordinates for relative placement without retaining them", () => {
  const runtime = {
    state: "ready",
    discoveries: [{
      title: "中川の血濡れの渡し場",
      baseTitle: "血濡れの渡し場",
      realPlaceName: "中川",
      sourceRef: "way:901",
      contentKind: "encounter",
      features: ["water", "crossing"],
      mapOrigin: { latitude: 35.68, longitude: 139.77 },
      representativeCoordinate: { latitude: 35.681, longitude: 139.772 }
    }],
    worldKnowledgeKey() { return "geo:way:901:encounter:crossing+water"; }
  };
  const knowledge = {
    discoveries: {
      "geo:way:901:encounter:crossing+water": {
        key: "geo:way:901:encounter:crossing+water",
        name: "中川の血濡れの渡し場",
        state: "discovered",
        terrain: ["water", "crossing"],
        contentKind: "encounter"
      }
    }
  };

  const model = Atlas.nearbyViewModel(runtime, knowledge);
  assert.equal(model.length, 1);
  assert.equal(model[0].name, "中川の血濡れの渡し場");
  assert.equal(model[0].shortName, "中川");
  assert.ok(model[0].x > 50);
  assert.ok(model[0].y < 50);
  assert.match(model[0].direction, /北東|東|北/);
  assert.doesNotMatch(JSON.stringify(model), /latitude|longitude|35\.68|139\.77|35\.681|139\.772/);
});

test("world atlas keeps markers inset from clipped edges", () => {
  const model = Atlas.atlasViewModel({
    discoveries: {
      edge: {
        key: "edge",
        name: "境界の石堂",
        state: "discovered",
        terrain: ["sacred"],
        contentKind: "event",
        areaId: "area:14:25:50"
      }
    }
  }, null);

  assert.equal(model.discoveries.length, 1);
  assert.equal(model.discoveries[0].left, Atlas.MARKER_INSET_PERCENT);
  assert.equal(model.discoveries[0].top, Atlas.MARKER_INSET_PERCENT);
  assert.ok(model.discoveries[0].left >= 5 && model.discoveries[0].left <= 95);
  assert.ok(model.discoveries[0].top >= 5 && model.discoveries[0].top <= 95);
});

test("atlas presentation exposes nearby/world switching and explicit current position", () => {
  assert.match(source, /周辺探索図/);
  assert.match(source, /世界Atlas/);
  assert.match(source, /現在地周辺/);
  assert.match(source, /現在地の領域/);
  assert.match(source, /線は経路ではない/);
  assert.doesNotMatch(source, /VISIT /);
  assert.match(css, /world-atlas-nearby-current/);
  assert.match(css, /world-atlas-nearby-ink/);
  assert.match(css, /data-label-horizontal/);
});

test("nearby discovery labels are real hit targets instead of visual-only text", () => {
  assert.match(css, /\.world-atlas-nearby-marker \{[^}]*width:48px;[^}]*height:48px;/s);
  assert.match(css, /\.world-atlas-nearby-marker > span \{[^}]*pointer-events:auto;[^}]*touch-action:manipulation;/s);
  assert.match(css, /\.world-atlas-nearby-marker:hover,\.world-atlas-nearby-marker:focus-visible,\.world-atlas-nearby-marker\.active \{ z-index:14; \}/);
  assert.match(css, /@media \(max-width:700px\)[\s\S]*\.world-atlas-nearby-marker \{ width:52px; height:52px;/);
});
