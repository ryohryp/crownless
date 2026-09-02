const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Signals = require("../src/world-atlas-npc-signals.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-npc-signals.js"), "utf8");

test("roadside rescan bridge reuses the canonical Atlas scan and redraw flow", async () => {
  const calls = [];
  const result = {
    state: "ready",
    foundCount: 2,
    newCount: 1,
    rememberedCount: 2,
    currentCell: { id: "cell:16:1:2" },
    cached: false
  };
  const Core = {};
  const root = {
    CrownlessCore: Core,
    CrownlessWorldAtlas: {
      async scanNearby(core, passedRoot, options) {
        calls.push(["scan", core, passedRoot, options]);
        return result;
      },
      openAtlas(document, core, passedRoot, options) {
        calls.push(["open", document, core, passedRoot, options]);
        return true;
      }
    }
  };
  const document = {};

  assert.equal(await Signals.rescanNearbyForSignal(document, root), result);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "scan");
  assert.equal(calls[0][1], Core);
  assert.equal(calls[0][2], root);
  assert.deepEqual(calls[0][3], { force: true });
  assert.equal(calls[1][0], "open");
  assert.equal(calls[1][1], document);
  assert.equal(calls[1][2], Core);
  assert.equal(calls[1][3], root);
  assert.deepEqual(calls[1][4], { autoScan: false, scanResult: result, view: "nearby" });
});

test("roadside rescan bridge fails closed when canonical Atlas scanning is unavailable", async () => {
  const result = await Signals.rescanNearbyForSignal({}, { CrownlessCore: {} });
  assert.equal(result.state, "unavailable");
  assert.equal(result.foundCount, 0);
  assert.equal(result.newCount, 0);
});

test("roadside signal offers rescan without inventing event GPS or persistence", () => {
  assert.match(source, /現在地周辺を調べる/);
  assert.match(source, /Atlas\.scanNearby\(Core, root, \{ force: true \}\)/);
  assert.match(source, /Atlas\.openAtlas\(document, Core, root, \{ autoScan: false, scanResult: result, view: "nearby" \}\)/);
  assert.match(source, /kind === "event" \? \(\) =>/);
  assert.doesNotMatch(source, /SAVE_VERSION/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|saveWorldKnowledge|recordExploredCell/);
});
