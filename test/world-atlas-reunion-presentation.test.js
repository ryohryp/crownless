const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NpcLife = require("../src/npc-life.js");
const Encounter = require("../src/npc-reunion-encounter.js");
const DiscoveryActions = require("../src/discovery-actions.js");
const Presentation = require("../src/world-atlas-reunion-presentation.js");

const knownDestinations = {
  "sim:north-road-ford": {
    key: "sim:north-road-ford",
    name: "北の街道の古い渡し場",
    location: "north-road",
    state: "discovered"
  },
  "sim:old-forest": {
    key: "sim:old-forest",
    name: "古い森",
    location: "forest",
    state: "discovered"
  }
};

function rootWithKnowledge(options = {}) {
  const safe = options.safe || {
    worldKnowledge: { discoveries: knownDestinations },
    npcLife: { reunions: {} }
  };
  let saveCount = 0;
  const expeditionState = options.expeditionState || {
    destinations: [
      {
        id: "world:sim:north-road-ford",
        name: "北の街道の古い渡し場",
        discoveryKey: "sim:north-road-ford"
      },
      {
        id: "ashen-wood",
        name: "灰の森"
      }
    ],
    completedReports: []
  };
  return {
    CrownlessCore: {
      loadSafeState() {
        return safe;
      },
      saveSafeState() {
        saveCount += 1;
        return true;
      }
    },
    CrownlessNpcLife: NpcLife,
    CrownlessNpcReunionEncounter: Encounter,
    CrownlessDiscoveryActions: DiscoveryActions,
    CrownlessExpeditionSystem: {
      normalizeState(input) {
        return input && typeof input === "object" ? input : expeditionState;
      }
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, "crownless.expedition-poc.v1");
        return JSON.stringify(expeditionState);
      }
    },
    getSaveCount() {
      return saveCount;
    },
    safe
  };
}

function reunionReport(overrides = {}) {
  return {
    expeditionId: "exp-reunion-1",
    destinationId: "world:sim:north-road-ford",
    destinationName: "北の街道の古い渡し場",
    completedAt: new Date(2026, 8, 1, 11, 0, 0).getTime(),
    ...overrides
  };
}

test("selected reunion destination projects Marco into the Atlas candidate model", () => {
  const reunion = Presentation.reunionForEntry(
    rootWithKnowledge(),
    knownDestinations["sim:north-road-ford"],
    new Date(2026, 8, 1, 11, 0, 0)
  );

  assert.ok(reunion);
  assert.equal(reunion.npcId, "marco");
  assert.equal(reunion.npcName, "マルコ");
  assert.equal(reunion.discoveryKey, "sim:north-road-ford");
});

test("explicit reunion clue helper remains deterministic for a future confirmed encounter surface", () => {
  const root = rootWithKnowledge();
  const entry = knownDestinations["sim:north-road-ford"];
  const now = new Date(2026, 8, 1, 11, 0, 0);
  const first = Presentation.reunionClueForEntry(root, entry, now);
  const second = Presentation.reunionClueForEntry(root, entry, now);
  const localEvent = DiscoveryActions.buildLocalEvent(entry);

  assert.ok(first);
  assert.deepEqual(first, second);
  assert.equal(first.npcId, "marco");
  assert.equal(first.eventId, localEvent.id);
});

test("another destination and travel-window boundaries do not produce a reunion candidate", () => {
  const root = rootWithKnowledge();
  assert.equal(Presentation.reunionForEntry(root, knownDestinations["sim:old-forest"], new Date(2026, 8, 1, 11)), null);
  assert.equal(Presentation.reunionForEntry(root, knownDestinations["sim:north-road-ford"], new Date(2026, 8, 1, 8)), null);
  assert.equal(Presentation.reunionForEntry(root, knownDestinations["sim:north-road-ford"], new Date(2026, 8, 1, 15)), null);
});

test("completed expedition report resolves reunion using completedAt and authoritative destination discoveryKey", () => {
  const report = reunionReport();
  const expeditionState = {
    destinations: [
      {
        id: report.destinationId,
        name: report.destinationName,
        discoveryKey: "sim:north-road-ford"
      }
    ],
    completedReports: [report]
  };
  const reunion = Presentation.reunionForExpeditionReport(rootWithKnowledge({ expeditionState }), report);

  assert.ok(reunion);
  assert.equal(reunion.npcId, "marco");
  assert.equal(reunion.discoveryKey, "sim:north-road-ford");

  const outsideWindow = { ...report, completedAt: new Date(2026, 8, 1, 8).getTime() };
  const outsideState = { ...expeditionState, completedReports: [outsideWindow] };
  assert.equal(Presentation.reunionForExpeditionReport(rootWithKnowledge({ expeditionState: outsideState }), outsideWindow), null);
});

test("latest completed report persists reunion exactly once and reload remains idempotent", () => {
  const report = reunionReport();
  const expeditionState = {
    destinations: [
      {
        id: report.destinationId,
        name: report.destinationName,
        discoveryKey: "sim:north-road-ford"
      }
    ],
    completedReports: [report]
  };
  const root = rootWithKnowledge({ expeditionState });

  const first = Presentation.expeditionReportReunion(root, report);
  const second = Presentation.expeditionReportReunion(root, report);

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.encounter.npcId, "marco");
  assert.equal(first.record.firstReunitedAt, report.completedAt);
  assert.equal(root.getSaveCount(), 1);
  assert.deepEqual(root.safe.npcLife.reunions["marco|sim:north-road-ford"], {
    npcId: "marco",
    discoveryKey: "sim:north-road-ford",
    firstReunitedAt: report.completedAt
  });
});

test("historical unrecorded report stays read-only", () => {
  const latest = reunionReport({ expeditionId: "exp-latest" });
  const historical = reunionReport({ expeditionId: "exp-old" });
  const expeditionState = {
    destinations: [
      {
        id: historical.destinationId,
        name: historical.destinationName,
        discoveryKey: "sim:north-road-ford"
      }
    ],
    completedReports: [latest, historical]
  };
  const root = rootWithKnowledge({ expeditionState });

  assert.equal(Presentation.expeditionReportReunion(root, historical), null);
  assert.equal(root.getSaveCount(), 0);
  assert.deepEqual(root.safe.npcLife.reunions, {});
});

test("built-in destination report cannot create an NPC reunion", () => {
  const report = reunionReport({ destinationId: "ashen-wood", destinationName: "灰の森" });
  const expeditionState = {
    destinations: [{ id: "ashen-wood", name: "灰の森" }],
    completedReports: [report]
  };
  const root = rootWithKnowledge({ expeditionState });

  assert.equal(Presentation.reunionForExpeditionReport(root, report), null);
  assert.equal(Presentation.expeditionReportReunion(root, report), null);
  assert.equal(root.getSaveCount(), 0);
});

test("Atlas candidate rendering is read-only and does not imply a confirmed reunion", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-reunion-presentation.js"), "utf8");
  const syncStart = source.indexOf("function syncReunion");
  const syncEnd = source.indexOf("function ensureStyles");
  const syncBody = source.slice(syncStart, syncEnd);

  assert.match(syncBody, /再会候補/);
  assert.match(syncBody, /遠征で会えるかもしれない/);
  assert.doesNotMatch(syncBody, /recordReunion\s*\(/);
  assert.doesNotMatch(syncBody, /reunionClueForEntry\s*\(/);
  assert.doesNotMatch(syncBody, /以前にもここで会った/);
});

test("expedition report only persists from the latest completed report", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-reunion-presentation.js"), "utf8");
  const start = source.indexOf("function expeditionReportReunion");
  const end = source.indexOf("function reportForFolio");
  const body = source.slice(start, end);

  assert.match(body, /completedReports\[0\]/);
  assert.match(body, /recordReunion\s*\(/);
  assert.match(body, /if \(!record && latest\)/);
});

test("Atlas reunion layer reuses authoritative domains without GPS or world-knowledge mutation", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-reunion-presentation.js"), "utf8");
  const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  const reunion = Presentation.reunionForEntry(rootWithKnowledge(), knownDestinations["sim:north-road-ford"], new Date(2026, 8, 1, 11));

  assert.match(source, /CrownlessNpcReunionEncounter/);
  assert.match(source, /encounterAtDiscovery/);
  assert.match(source, /encounterForExpedition/);
  assert.doesNotMatch(source, /saveWorldKnowledge|geolocation|getCurrentPosition/);
  assert.equal("latitude" in reunion, false);
  assert.equal("longitude" in reunion, false);
  assert.equal("coordinates" in reunion, false);
  assert.match(runtimeSource, /src\/npc-life\.js/);
  assert.match(runtimeSource, /src\/npc-reunion-encounter\.js/);
  assert.match(runtimeSource, /src\/world-atlas-reunion-presentation\.js/);
});