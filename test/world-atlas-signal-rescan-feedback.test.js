const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Feedback = require("../src/world-atlas-signal-rescan-feedback.js");

function harness(result) {
  const calls = [];
  const detail = {
    status: null,
    querySelector(selector) {
      return selector === `.${Feedback.STATUS_CLASS}` ? this.status : null;
    }
  };
  const button = {
    textContent: Feedback.LABEL,
    disabled: false,
    dataset: {},
    isConnected: true,
    matches(selector) { return selector === "button.world-atlas-npc-signal-match__open"; },
    closest(selector) { return selector === ".world-atlas-detail" ? detail : null; },
    insertAdjacentElement(_where, node) { detail.status = node; }
  };
  const document = {
    createElement() {
      return {
        className: "",
        textContent: "",
        attrs: {},
        setAttribute(name, value) { this.attrs[name] = value; }
      };
    }
  };
  const Core = {};
  const Atlas = {
    scanResultText(value, scanning) {
      if (scanning) return "SCANNING";
      return value && value.state === "denied" ? "DENIED" : "FAILED";
    },
    async scanNearby(core, root, options) {
      calls.push(["scan", core, root, options]);
      return result;
    },
    openAtlas(doc, core, root, options) {
      calls.push(["open", doc, core, root, options]);
      return true;
    }
  };
  const root = { CrownlessCore: Core, CrownlessWorldAtlas: Atlas };
  return { calls, detail, button, document, Core, Atlas, root };
}

test("signal detail rescan uses canonical forced Atlas scan and redraws nearby on success", async () => {
  const result = { state: "ready", foundCount: 2, newCount: 1 };
  const h = harness(result);

  const actual = await Feedback.rescanFromSignalDetail(h.document, h.root, h.button);

  assert.equal(actual, result);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0][0], "scan");
  assert.equal(h.calls[0][1], h.Core);
  assert.equal(h.calls[0][2], h.root);
  assert.deepEqual(h.calls[0][3], { force: true });
  assert.equal(h.calls[1][0], "open");
  assert.deepEqual(h.calls[1][4], { autoScan: false, scanResult: result, view: "nearby" });
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.textContent, Feedback.PENDING_LABEL);
  assert.equal(h.detail.status.textContent, "SCANNING");
});

test("signal detail rescan exposes failure and restores retry button", async () => {
  const h = harness({ state: "denied", foundCount: 0, newCount: 0 });

  const actual = await Feedback.rescanFromSignalDetail(h.document, h.root, h.button);

  assert.equal(actual.state, "denied");
  assert.equal(h.calls.length, 1);
  assert.equal(h.detail.status.textContent, "DENIED");
  assert.equal(h.button.disabled, false);
  assert.equal(h.button.dataset.signalRescanPending, "false");
  assert.equal(h.button.textContent, Feedback.LABEL);
});

test("signal detail rescan ignores a second activation while the first is pending", async () => {
  let release;
  const result = { state: "ready", foundCount: 1, newCount: 0 };
  const h = harness(result);
  h.Atlas.scanNearby = () => new Promise((resolve) => { release = resolve; });

  const first = Feedback.rescanFromSignalDetail(h.document, h.root, h.button);
  const second = await Feedback.rescanFromSignalDetail(h.document, h.root, h.button);
  assert.equal(second.state, "ignored");

  release(result);
  await first;
});

test("bridge is loaded by the runtime bootstrap", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /loadSignalRescanFeedback\(root\)/);
  assert.match(source, /src\/world-atlas-signal-rescan-feedback\.js/);
});
