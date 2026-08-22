const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeSource = fs
  .readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8")
  .replace(/\r\n/g, "\n");

function freshCore() {
  for (const modulePath of [
    "../src/game-core.js",
    "../src/hunt-system.js",
    "../src/dungeon-system.js"
  ]) delete require.cache[require.resolve(modulePath)];

  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  const installDungeons = require("../src/dungeon-system.js");
  return installDungeons(installHunts(baseCore));
}

function runtimeChoiceSlot(Core) {
  const match = runtimeSource.match(/function choiceSlot\(state, choiceId\) \{([\s\S]*?)\n  \}\n  function enrichDiscovery/);
  assert.ok(match, "location runtime choiceSlot implementation should be extractable");
  return new Function("Core", `return function choiceSlot(state, choiceId) {${match[1]}\n  }`)(Core);
}

test("geographic slot follows rendered exploration choice order when dungeon entrance occupies slot 3", () => {
  const Core = freshCore();
  let state = Core.createInitialState();
  const hunt = state.hunts.entries.find((entry) => entry.id === "ash-hound");
  assert.ok(hunt, "ash-hound hunt should exist");
  hunt.completed = true;

  state = Core.beginExpedition(state, 4242);
  const choices = Core.generateExplorationChoices(state);
  assert.equal(choices.length, 3);
  assert.equal(choices[2].choiceId, "dungeon:ash-eater-mine:entrance");

  const choiceSlot = runtimeChoiceSlot(Core);
  assert.equal(choiceSlot(state, choices[0].choiceId), 0);
  assert.equal(choiceSlot(state, choices[1].choiceId), 1);
  assert.equal(choiceSlot(state, choices[2].choiceId), 2);
});

test("location runtime resolves choice slot before the underlying discovery mutates state", () => {
  assert.match(runtimeSource, /const slot = choiceSlot\(state, choiceId\);/);
  assert.match(runtimeSource, /applySelectedGeographicDiscovery\(originalDiscoverLocation\(state, choiceId\), slot\)/);
  assert.doesNotMatch(runtimeSource, /geographicDiscoveries\[choiceSlot\(choiceId\)\]/);
});
