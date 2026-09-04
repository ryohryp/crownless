const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Bridge = require("../src/geographic-expedition-bridge.js");
const System = require("../src/expedition-system.js");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");

test("geographic discoveries map into the existing expedition families", () => {
  assert.equal(Bridge.destinationFamily({ contentKind: "dungeon", terrain: ["height"] }), "cave");
  assert.equal(Bridge.destinationFamily({ terrain: ["settlement", "road_hub"] }), "village");
  assert.equal(Bridge.destinationFamily({ terrain: ["woods"] }), "forest");
  assert.equal(Bridge.destinationFamily({ terrain: ["water"] }), "forest");
});

test("a remembered geographic discovery becomes a stable expedition destination", () => {
  const destination = Bridge.destinationFromKnowledge({
    key: "geo:way:901:encounter:crossing+water",
    name: "中川の血濡れの渡し場",
    terrain: ["water", "crossing"],
    contentKind: "encounter"
  });
  assert.equal(destination.id, "world:geo:way:901:encounter:crossing+water");
  assert.equal(destination.name, "中川の血濡れの渡し場");
  assert.equal(destination.family, "village");
  assert.ok(destination.dangerTags.includes("bandit"));
  assert.ok(destination.opportunityTags.includes("passage"));
  assert.equal(destination.geographic, true);
});

test("dispatch can augment state with a GPS-discovered destination without changing resolver rules", () => {
  const knowledge = {
    key: "geo:node:7:dungeon:height",
    name: "丘の崩れた物見台",
    terrain: ["height"],
    contentKind: "dungeon",
    firstDiscoveredAt: 100
  };
  const Core = {
    loadSafeState() {
      return { worldKnowledge: { discoveries: { [knowledge.key]: knowledge } } };
    }
  };
  const destinationId = Bridge.expeditionDestinationId(knowledge.key);
  const augmented = Bridge.augmentStateWithGeographicDestination(System, Core, System.initialState(), destinationId);
  assert.ok(augmented.destinations.some((item) => item.id === destinationId));

  const dispatched = System.dispatchExpedition(augmented, {
    destinationId,
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
    durationMs: 0,
    seed: 218
  }, 1000);
  assert.equal(dispatched.activeExpedition.inputs.destinationId, destinationId);
  const report = System.resolveExpedition(dispatched.activeExpedition, dispatched);
  assert.equal(report.destinationId, destinationId);
  assert.equal(report.destinationName, "丘の崩れた物見台");
});

test("only geographic world knowledge is exposed as GPS expedition choices", () => {
  const Core = {
    loadSafeState() {
      return {
        worldKnowledge: {
          discoveries: {
            geo: { key: "geo:node:1:dungeon:height", name: "物見台", terrain: ["height"], firstDiscoveredAt: 2 },
            sim: { key: "sim:ruined-chapel", name: "礼拝堂", firstDiscoveredAt: 3 }
          }
        }
      };
    }
  };
  const destinations = Bridge.geographicDestinations(Core);
  assert.equal(destinations.length, 1);
  assert.equal(destinations[0].name, "物見台");
});

test("successful geographic expedition advances atlas knowledge and emits a redraw event", () => {
  const key = "geo:node:8:encounter:road_hub";
  const safe = { worldKnowledge: { discoveries: { [key]: { key, name: "暗がりに揺れる火影", state: "discovered", visits: 1 } } } };
  let saved = null;
  const events = [];
  const Core = {
    loadSafeState() { return JSON.parse(JSON.stringify(safe)); },
    saveWorldKnowledge(next) { saved = JSON.parse(JSON.stringify(next)); return true; }
  };
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const root = { CustomEvent: FakeCustomEvent, dispatchEvent(event) { events.push(event); } };
  const report = { destinationId: `world:${key}`, outcome: "success", discoveries: [], log: [] };

  const progress = Bridge.applyGeographicReport(Core, report, root);
  assert.equal(progress.state, "investigated");
  assert.equal(saved.worldKnowledge.discoveries[key].state, "investigated");
  assert.equal(saved.worldKnowledge.discoveries[key].visits, 2);
  assert.match(report.worldKnowledgeProgress.summary, /一歩近づいた/);
  assert.equal(report.log.at(-1).type, "world-knowledge");
  assert.equal(events[0].type, "crownless:world-knowledge-updated");
  assert.equal(events[0].detail.discoveryKey, key);
});

test("geographic expedition with a new discovery can clear the atlas trace", () => {
  const progress = Bridge.geographicProgressForReport(
    { outcome: "success", discoveries: [{ id: "follow-up" }] },
    { name: "暗がりに揺れる火影", state: "discovered", visits: 1 }
  );
  assert.equal(progress.state, "cleared");
  assert.equal(progress.visits, 2);
});

test("failed geographic expedition records another visit without granting progress", () => {
  const key = "geo:node:9:encounter:woods";
  const safe = { worldKnowledge: { discoveries: { [key]: { key, name: "森の気配", state: "discovered", visits: 2 } } } };
  let saved = null;
  const Core = {
    loadSafeState() { return JSON.parse(JSON.stringify(safe)); },
    saveWorldKnowledge(next) { saved = JSON.parse(JSON.stringify(next)); return true; }
  };
  const report = { destinationId: `world:${key}`, outcome: "failed", discoveries: [], log: [] };
  const progress = Bridge.applyGeographicReport(Core, report, null);
  assert.equal(progress.state, "discovered");
  assert.equal(saved.worldKnowledge.discoveries[key].visits, 3);
  assert.match(report.worldKnowledgeProgress.summary, /まだ終わっていない/);
});

test("non-geographic expedition reports never change atlas knowledge", () => {
  let saved = false;
  const Core = {
    loadSafeState() { return { worldKnowledge: { discoveries: {} } }; },
    saveWorldKnowledge() { saved = true; return true; }
  };
  assert.equal(Bridge.applyGeographicReport(Core, { destinationId: "forest-edge", outcome: "success" }, null), null);
  assert.equal(saved, false);
});

test("runtime bootstrap loads the bridge after expedition presentation", () => {
  assert.match(runtimeSource, /src\/geographic-expedition-bridge\.js/);
  assert.match(runtimeSource, /presentation\.onload = loadGeographicExpeditionBridge/);
});