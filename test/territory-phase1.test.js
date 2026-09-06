const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Territory = require("../src/territory-phase1.js");

const source = fs.readFileSync(path.join(__dirname, "../src/territory-phase1.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");

function entries() {
  return [
    { key: "geo:bridge", name: "古い渡河点", contentKind: "unknown", terrain: ["crossing", "water"] },
    { key: "geo:fort", name: "崩れた小砦", contentKind: "dungeon", terrain: ["height"] },
    { key: "geo:grove", name: "煤けた樹林", contentKind: "unknown", terrain: ["woods"] },
  ];
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

function rootWithEntries(discoveries = entries()) {
  return {
    localStorage: memoryStorage(),
    CrownlessCore: {
      loadSafeState() {
        return { worldKnowledge: { discoveries: Object.fromEntries(discoveries.map((entry) => [entry.key, entry])) } };
      }
    }
  };
}

test("three representative discoveries deterministically become foothold, route, and resource", () => {
  const first = Territory.ensureAssignments(entries(), {});
  assert.deepEqual(first.assignments, {
    foothold: "geo:fort",
    route: "geo:bridge",
    resource: "geo:grove",
  });

  const reordered = Territory.ensureAssignments(entries().slice().reverse(), first);
  assert.deepEqual(reordered.assignments, first.assignments);

  const withNewHighAffinityPoint = Territory.ensureAssignments([
    ...entries(),
    { key: "geo:aaa-new-fort", name: "新しい高台", contentKind: "dungeon", terrain: ["height"] },
  ], first);
  assert.deepEqual(withNewHighAffinityPoint.assignments, first.assignments, "once assigned, new discoveries must not reshuffle the three-point slice");
});

test("bounded persistent state stores only territory decisions, never location coordinates or route history", () => {
  const normalized = Territory.normalizeState({
    assignments: { foothold: "geo:fort", route: "geo:bridge", resource: "geo:grove", latitude: 35.0 },
    scoutedKeys: ["geo:fort", "geo:fort"],
    controlledKeys: ["geo:fort"],
    appliedExpeditionIds: ["exp-1"],
    pendingContestKey: "geo:bridge",
    activeContest: { expeditionId: "exp-2", key: "geo:bridge", longitude: 139.0 },
    exactRoute: ["x"],
  });

  assert.deepEqual(normalized.assignments, { foothold: "geo:fort", route: "geo:bridge", resource: "geo:grove" });
  assert.deepEqual(normalized.scoutedKeys, ["geo:fort"]);
  assert.deepEqual(normalized.activeContest, { expeditionId: "exp-2", key: "geo:bridge" });
  assert.doesNotMatch(JSON.stringify(normalized), /latitude|longitude|coordinate|exactRoute|routeHistory/i);
});

test("captured predecessor visibly shortens only the next territory contest", () => {
  const assigned = Territory.ensureAssignments(entries(), {});
  const modelsBefore = Territory.territoryModels(entries(), assigned);
  const routeBefore = modelsBefore.find((item) => item.role === "route");
  const resourceBefore = modelsBefore.find((item) => item.role === "resource");

  assert.equal(Territory.effectiveContestDuration(assigned, routeBefore, 240000), 240000);
  assert.equal(Territory.effectiveContestDuration(assigned, resourceBefore, 240000), 240000);

  const afterFoothold = { ...assigned, controlledKeys: [assigned.assignments.foothold] };
  const routeAfter = Territory.territoryModels(entries(), afterFoothold).find((item) => item.role === "route");
  assert.equal(Territory.effectiveContestDuration(afterFoothold, routeAfter, 240000), 156000, "foothold gives the advertised 35% route reduction");

  const afterRoute = { ...afterFoothold, controlledKeys: [assigned.assignments.foothold, assigned.assignments.route] };
  const resourceAfter = Territory.territoryModels(entries(), afterRoute).find((item) => item.role === "resource");
  assert.equal(Territory.effectiveContestDuration(afterRoute, resourceAfter, 240000), 180000, "route gives the advertised 25% resource reduction");
});

test("successful matching contest captures exactly once and decorates the report", () => {
  const root = rootWithEntries();
  const assigned = Territory.ensureAssignments(entries(), {});
  const active = {
    ...assigned,
    activeContest: { expeditionId: "exp-control", key: assigned.assignments.foothold },
  };
  root.localStorage.setItem(Territory.STORAGE_KEY, JSON.stringify(active));
  const report = { expeditionId: "exp-control", outcome: "success", log: [], worldChanges: [] };

  const first = Territory.applyContestReport(root, report);
  assert.equal(first.changed, true);
  assert.equal(first.controlled, true);
  assert.equal(report.territoryOutcome.controlled, true);
  assert.equal(report.territoryOutcome.owner, "player");
  assert.match(report.territoryOutcome.summary, /勢力圏/);
  assert.equal(report.worldChanges.filter((item) => item.id === `territory-control:${assigned.assignments.foothold}`).length, 1);
  assert.equal(report.log.filter((item) => item.type === "territory-control").length, 1);

  const stored = JSON.parse(root.localStorage.getItem(Territory.STORAGE_KEY));
  assert.deepEqual(stored.controlledKeys, [assigned.assignments.foothold]);
  assert.deepEqual(stored.appliedExpeditionIds, ["exp-control"]);
  assert.equal(stored.activeContest, null);

  const second = Territory.applyContestReport(root, report);
  assert.equal(second.changed, false);
  assert.equal(JSON.parse(root.localStorage.getItem(Territory.STORAGE_KEY)).controlledKeys.length, 1);
});

test("early return or failure never changes NPC control", () => {
  for (const outcome of ["early-return", "failed"]) {
    const root = rootWithEntries();
    const assigned = Territory.ensureAssignments(entries(), {});
    const key = assigned.assignments.foothold;
    root.localStorage.setItem(Territory.STORAGE_KEY, JSON.stringify({
      ...assigned,
      activeContest: { expeditionId: `exp-${outcome}`, key },
    }));
    const report = { expeditionId: `exp-${outcome}`, outcome, log: [], worldChanges: [] };

    const result = Territory.applyContestReport(root, report);
    assert.equal(result.controlled, false);
    assert.equal(result.changed, false);
    assert.equal(report.territoryOutcome.owner, "npc");
    assert.equal(JSON.parse(root.localStorage.getItem(Territory.STORAGE_KEY)).controlledKeys.includes(key), false);
  }
});

test("Phase 1 reuses the authoritative Atlas → Expedition flow and exposes scout/control surfaces", () => {
  assert.match(source, /CrownlessWorldAtlasActionsPresentation/);
  assert.match(source, /presentation\.openExpedition\(document, root, territory\.entry, status\)/);
  assert.match(source, /pendingContestKey/);
  assert.match(source, /偵察せず攻略の準備へ/);
  assert.match(source, /report\.outcome === "success"/);
  assert.match(source, /territory-prepare-note/);
  assert.match(source, /territory-report-note/);
  assert.doesNotMatch(source, /支配度|stamina|energy|daily/i);
});

test("runtime loader installs territory before the geographic bridge wraps expedition dispatch", () => {
  assert.match(loaderSource, /await api\.loadTerritoryPhase1\(root\);/);
  assert.match(loaderSource, /CrownlessTerritoryPhase1/);
  assert.match(loaderSource, /src\/territory-phase1\.js/);
});
