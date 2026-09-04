const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Fleeting = require("../src/expedition-fleeting-leads.js");

const bridgeSource = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");

function banditExpedition(id = "exp-1") {
  return {
    id,
    inputs: {
      destinationId: Fleeting.BANDIT_DESTINATION_ID,
      companionIds: ["mira", "ed"],
      policyId: "balanced",
    },
  };
}

function banditReport() {
  return {
    expeditionId: "exp-1",
    destinationId: Fleeting.BANDIT_DESTINATION_ID,
    outcome: "success",
    signalEncounter: { kind: "bandit-ambush" },
    discoveries: [],
    log: [],
  };
}

function stateWithBandit() {
  return {
    destinations: [{
      id: Fleeting.BANDIT_DESTINATION_ID,
      name: "街道の襲撃跡",
      family: "road",
      dangerTags: ["bandit"],
      opportunityTags: ["road"],
      durationMs: 180000,
    }],
    discoveredDestinationIds: [Fleeting.BANDIT_DESTINATION_ID],
    completedReports: [],
  };
}

test("successful bandit report reveals two mutually exclusive fleeting leads", () => {
  const report = Fleeting.decorateReport(banditReport(), banditExpedition());

  assert.equal(report.fleetingLeads.leadIds.length, 2);
  assert.equal(report.discoveries.filter((item) => item.kind === "fleeting-lead").length, 2);
  assert.match(report.notableEvent.text, /次の遠征で追えるのは一方だけ/);
  assert.match(report.notableEvent.text, /別の遠征を先に出せば/);
});

test("applying the report unlocks both choices once with distinct risk and opportunity", () => {
  const state = stateWithBandit();
  const report = Fleeting.decorateReport(banditReport(), banditExpedition());

  Fleeting.unlockLeads(state, report);
  Fleeting.unlockLeads(state, report);

  const leads = Fleeting.pendingLeads(state);
  assert.equal(leads.length, 2);
  assert.equal(new Set(leads.map((item) => item.id)).size, 2);
  assert.ok(leads.some((item) => item.opportunityTags.includes("valuable") && item.dangerTags.includes("pursuit")));
  assert.ok(leads.some((item) => item.opportunityTags.includes("intel") && item.opportunityTags.includes("route")));
});

test("dispatching one fleeting lead expires its sibling but keeps the chosen lead until its report", () => {
  const state = stateWithBandit();
  const report = Fleeting.decorateReport(banditReport(), banditExpedition());
  Fleeting.unlockLeads(state, report);
  const [chosen, sibling] = Fleeting.pendingLeads(state);

  const result = Fleeting.applyDispatchExpiry(state, chosen.id);

  assert.equal(result.chosen.id, chosen.id);
  assert.deepEqual(result.expiredIds, [sibling.id]);
  assert.ok(state.destinations.some((item) => item.id === chosen.id));
  assert.ok(!state.destinations.some((item) => item.id === sibling.id));
  assert.ok(!state.discoveredDestinationIds.includes(sibling.id));
});

test("dispatching somewhere else lets both fleeting leads disappear", () => {
  const state = stateWithBandit();
  const report = Fleeting.decorateReport(banditReport(), banditExpedition());
  Fleeting.unlockLeads(state, report);
  const ids = Fleeting.pendingLeads(state).map((item) => item.id);

  const result = Fleeting.applyDispatchExpiry(state, "another-destination");

  assert.equal(result.chosen, null);
  assert.deepEqual(new Set(result.expiredIds), new Set(ids));
  assert.equal(Fleeting.pendingLeads(state).length, 0);
  ids.forEach((id) => assert.ok(!state.discoveredDestinationIds.includes(id)));
});

test("resolved chosen lead is retired so it cannot be replayed as a permanent task", () => {
  const state = stateWithBandit();
  const report = Fleeting.decorateReport(banditReport(), banditExpedition());
  Fleeting.unlockLeads(state, report);
  const chosen = Fleeting.pendingLeads(state)[0];
  Fleeting.applyDispatchExpiry(state, chosen.id);

  assert.equal(Fleeting.retireResolvedLead(state, { destinationId: chosen.id }), true);
  assert.equal(Fleeting.pendingLeads(state).length, 0);
  assert.ok(!state.discoveredDestinationIds.includes(chosen.id));
});

test("failure and unrelated destinations do not create fleeting aftermath leads", () => {
  const failed = { ...banditReport(), outcome: "failure" };
  const unrelatedExpedition = { id: "exp-2", inputs: { destinationId: "somewhere-else" } };

  assert.equal(Fleeting.decorateReport(failed, banditExpedition()).fleetingLeads, undefined);
  assert.equal(Fleeting.decorateReport(banditReport(), unrelatedExpedition).fleetingLeads, undefined);
});

test("runtime bridge loads fleeting leads without a second app bootstrap", () => {
  assert.match(bridgeSource, /loadFleetingLeads\(root\)/);
  assert.match(bridgeSource, /CrownlessExpeditionFleetingLeads/);
  assert.match(bridgeSource, /src\/expedition-fleeting-leads\.js/);
});