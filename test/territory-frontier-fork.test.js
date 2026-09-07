const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Fork = require("../src/territory-frontier-fork.js");
const source = fs.readFileSync(path.join(__dirname, "../src/territory-frontier-fork.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");

function model(role, owner, extra = {}) {
  return {
    key: `geo:${role}`,
    role,
    owner,
    scouted: false,
    supported: false,
    entry: { name: role === "foothold" ? "崩れた小砦" : role === "route" ? "古い渡河点" : "煤けた樹林" },
    meta: {
      value: role === "resource" ? "希少な資源地。" : "戦略地点。",
      effect: role === "route" ? "資源地攻略の所要時間を25%短縮" : "次の攻略条件が変わる"
    },
    ...extra,
  };
}

test("route and resource stay locked until the foothold is controlled", () => {
  const state = Fork.frontierState([
    model("foothold", "npc"),
    model("route", "npc"),
    model("resource", "npc"),
  ]);
  assert.equal(state.unlocked, false);
  assert.deepEqual(state.lockedRoles, ["route", "resource"]);
  assert.deepEqual(state.candidates, []);
});

test("capturing the foothold opens a real two-target frontier fork", () => {
  const state = Fork.frontierState([
    model("foothold", "player"),
    model("route", "npc", { supported: true }),
    model("resource", "npc"),
  ]);
  assert.equal(state.unlocked, true);
  assert.deepEqual(state.candidates.map((item) => item.role), ["route", "resource"]);
  assert.match(state.candidates[0].support, /-35%/);
  assert.match(state.candidates[1].headline, /急襲/);
  assert.match(state.candidates[1].support, /支援なし/);
});

test("taking the route changes the resource plan instead of merely ticking a checklist", () => {
  const state = Fork.frontierState([
    model("foothold", "player"),
    model("route", "player"),
    model("resource", "npc", { supported: true }),
  ]);
  assert.deepEqual(state.candidates.map((item) => item.role), ["resource"]);
  assert.match(state.candidates[0].headline, /補給路/);
  assert.match(state.candidates[0].support, /-25%/);
  assert.equal(state.candidates[0].approach, "補給路から進軍");
});

test("fork stays bounded to the existing three-place Territory slice", () => {
  assert.match(source, /WAR COUNCIL \/ 次の一手/);
  assert.match(source, /急襲 \/ 迂回/);
  assert.match(source, /同じ攻略を周回せず/);
  assert.doesNotMatch(source, /control.?xp|stamina|energy|daily|season|ranking|clan|guild|latitude|longitude|routeHistory/i);
});

test("runtime loader includes the frontier fork after Territory base and reward state", () => {
  assert.match(loaderSource, /loadTerritoryPhase1\(root\)/);
  assert.match(loaderSource, /loadTerritoryRewardSurface\(root\)/);
  assert.match(loaderSource, /loadTerritoryFrontierFork\(root\)/);
  assert.match(loaderSource, /src\/territory-frontier-fork\.js/);
});