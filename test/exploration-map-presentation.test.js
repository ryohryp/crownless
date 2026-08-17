const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Presentation = require("../src/exploration-map-presentation.js");
const Discovery = require("../src/discovery-provider.js");

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function card(name, risk, signal) {
  return {
    dataset: {},
    classList: {
      [Symbol.iterator]: function* () { yield "lead-card"; yield "palette-road"; }
    },
    querySelectorAll(selector) {
      return selector === ".pips.risk i.on" ? Array.from({ length: risk }) : [];
    },
    querySelector(selector) {
      if (selector === "h3") return { textContent: name };
      if (selector === ".lead-signals label strong") return { textContent: signal };
      return null;
    }
  };
}

test("direct discovery limits the decision surface to three destinations", () => {
  const cards = [
    card("崩れた祠", 2, "異様な気配"),
    card("黒い坑道", 4, "ダンジョン"),
    card("荷車の跡", 1, "物資の気配"),
    card("遠い煙", 3, "敵影")
  ];
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

test("browser loads direct exploration presentation after existing presentation layers", () => {
  const noncombat = index.indexOf('src/noncombat-presentation.js');
  const exploration = index.indexOf('src/exploration-map-presentation.js');
  assert.ok(noncombat >= 0);
  assert.ok(exploration > noncombat);
});
