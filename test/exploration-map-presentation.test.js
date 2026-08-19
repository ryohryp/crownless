const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Presentation = require("../src/exploration-map-presentation.js");
const Discovery = require("../src/discovery-provider.js");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const presentationSource = fs.readFileSync(path.join(__dirname, "..", "src", "exploration-map-presentation.js"), "utf8");

function card(name, risk, signal) {
  const title = { textContent: name };
  const description = { textContent: "通常の手がかり" };
  const omen = { textContent: "通常の兆し" };
  const signalNode = { textContent: signal };
  const pips = Array.from({ length: 5 }, (_, index) => ({
    on: index < risk,
    classList: {
      toggle(className, enabled) {
        if (className === "on") pips[index].on = Boolean(enabled);
      }
    }
  }));
  const classes = new Set(["lead-card", "palette-road"]);

  return {
    dataset: {},
    style: {},
    className: "lead-card palette-road",
    classList: {
      [Symbol.iterator]: function* () { yield* classes; },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      }
    },
    querySelectorAll(selector) {
      if (selector === ".pips.risk i.on") return pips.filter((pip) => pip.on);
      if (selector === ".pips.risk i") return pips;
      return [];
    },
    querySelector(selector) {
      if (selector === "h3") return title;
      if (selector === "p") return description;
      if (selector === ".lead-omen") return omen;
      if (selector === ".lead-signals label strong") return signalNode;
      return null;
    },
    nodes: { title, description, omen, signal: signalNode, pips }
  };
}

test("direct discovery limits the decision surface to three destinations", () => {
  const cards = [card("崩れた祠", 2, "異様な気配"), card("黒い坑道", 4, "ダンジョン"), card("荷車の跡", 1, "物資の気配"), card("遠い煙", 3, "敵影")];
  const destinations = Presentation.selectDestinations(cards, Discovery);
  assert.equal(destinations.length, 3);
  assert.deepEqual(destinations.map((item) => item.title), ["崩れた祠", "黒い坑道", "荷車の跡"]);
});

test("direct destinations retain visible decision signals", () => {
  const destination = Presentation.extractDestination(card("黒い坑道", 4, "ダンジョン"), 0);
  assert.equal(destination.risk, 4);
  assert.equal(destination.signal, "ダンジョン");
  assert.equal(destination.palette, "road");
});

test("discovery heading reflects a ready geographic runtime", () => {
  assert.equal(Presentation.discoverySourceFromRuntime({ state: "ready", discoveries: [{ id: "geo-1" }] }), "geographic");
  assert.equal(Presentation.discoverySourceFromRuntime({ state: "ready", discoveries: [] }), "simulated");
  assert.equal(Presentation.discoverySourceFromRuntime({ state: "failed", discoveries: [{ id: "geo-1" }] }), "simulated");
});

test("rebuilt exploration cards are restored from cached geographic discoveries", () => {
  const first = card("通常の探索先", 1, "気配");
  const second = card("別の探索先", 1, "気配");
  const runtime = {
    state: "ready",
    discoveries: [{
      title: "川沿いの痕跡",
      signal: "水音が近い",
      risk: 3,
      palette: "water",
      contentKind: "encounter",
      features: ["water", "crossing"],
      realPlaceName: "Test River"
    }]
  };

  assert.equal(Presentation.applyGeographicDiscoveries([first, second], runtime), true);
  assert.equal(first.dataset.discoverySource, "geographic");
  assert.equal(first.style.display, "");
  assert.equal(first.nodes.title.textContent, "川沿いの痕跡");
  assert.equal(first.nodes.description.textContent, "水音が近い");
  assert.equal(first.nodes.omen.textContent, "地形：水辺 / 渡り場");
  assert.equal(first.nodes.signal.textContent, "遭遇");
  assert.deepEqual(first.nodes.pips.map((pip) => pip.on), [true, true, true, false, false]);
  assert.equal(first.className, "lead-card palette-marsh discovery-ready");
  assert.equal(second.dataset.discoverySource, "simulated");
  assert.equal(second.style.display, "none");
});

test("geographic restoration leaves simulated cards unchanged when runtime is not ready", () => {
  const simulated = card("通常の探索先", 2, "探索イベント");
  assert.equal(Presentation.applyGeographicDiscoveries([simulated], { state: "loading", discoveries: [{ title: "未適用" }] }), false);
  assert.equal(simulated.nodes.title.textContent, "通常の探索先");
  assert.equal(simulated.style.display, undefined);
  assert.equal(simulated.dataset.discoverySource, undefined);
});

test("lead-list observer refresh reapplies geographic discoveries after any DOM rebuild", () => {
  const observerIndex = presentationSource.indexOf("new MutationObserver(scheduleRefresh)");
  const refreshIndex = presentationSource.indexOf("applyGeographicDiscoveries(cards, locationRuntime)");
  assert.ok(observerIndex >= 0, "lead-list must remain observed for child-list rebuilds");
  assert.ok(refreshIndex >= 0, "observer-driven refresh must reapply cached geographic discoveries");
  assert.match(presentationSource, /observer\.observe\(leadList, \{ childList: true, subtree: false \}\)/);
});

test("browser loads direct exploration presentation after existing presentation layers", () => {
  const noncombat = index.indexOf('src/noncombat-presentation.js');
  const exploration = index.indexOf('src/exploration-map-presentation.js');
  assert.ok(noncombat >= 0);
  assert.ok(exploration > noncombat);
});