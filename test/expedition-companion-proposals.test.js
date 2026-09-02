"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const proposals = require("../src/expedition-companion-proposals.js");
const system = require("../src/expedition-system.js");

test("companion traits deterministically produce distinct expedition advice", () => {
  const state = system.initialState();
  const byId = (id) => state.companions.find((item) => item.id === id);

  assert.deepEqual(
    { objective: proposals.proposalFor(byId("mira")).objective, policy: proposals.proposalFor(byId("mira")).policy },
    { objective: "explore", policy: "cautious" }
  );
  assert.deepEqual(
    { objective: proposals.proposalFor(byId("ed")).objective, policy: proposals.proposalFor(byId("ed")).policy },
    { objective: "hunt", policy: "standard" }
  );
  assert.deepEqual(
    { objective: proposals.proposalFor(byId("sella")).objective, policy: proposals.proposalFor(byId("sella")).policy },
    { objective: "scavenge", policy: "greedy" }
  );
});

test("unknown or missing traits do not invent a proposal", () => {
  assert.equal(proposals.proposalFor(null), null);
  assert.equal(proposals.proposalFor({ traits: [] }), null);
  assert.equal(proposals.proposalFor({ traits: ["unknown"] }), null);
});

test("adopting advice changes only existing objective and policy controls", () => {
  const controls = {
    'input[name="objective"][value="hunt"]': { checked: false, dispatchEvent() {} },
    'input[name="policy"][value="standard"]': { checked: false, dispatchEvent() {} },
  };
  const form = { querySelector(selector) { return controls[selector] || null; } };
  const applied = proposals.applyProposal(form, { objective: "hunt", policy: "standard" }, { Event: class { constructor(type) { this.type = type; } } });
  assert.equal(applied, true);
  assert.equal(controls['input[name="objective"][value="hunt"]'].checked, true);
  assert.equal(controls['input[name="policy"][value="standard"]'].checked, true);
});

test("runtime bridge loads the proposal slice without changing expedition resolver contracts", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "../src/expedition-companion-proposals.js"), "utf8");
  assert.match(bridge, /loadCompanionProposals/);
  assert.match(bridge, /src\/expedition-companion-proposals\.js/);
  assert.doesNotMatch(source, /resolveExpedition\s*=/);
  assert.doesNotMatch(source, /localStorage\.setItem/);
  assert.doesNotMatch(source, /latitude|longitude|GPS/i);
});
