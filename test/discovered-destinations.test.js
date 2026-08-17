const test = require("node:test");
const assert = require("node:assert/strict");
const Presentation = require("../src/exploration-map-presentation.js");
const Discovery = require("../src/discovery-provider.js");

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

test("direct exploration exposes at most three discovered destinations", () => {
  const cards = [
    card("崩れた祠", 2, "異様な気配"),
    card("黒い坑道", 4, "ダンジョン"),
    card("荷車の跡", 1, "物資の気配"),
    card("遠い煙", 3, "敵影")
  ];
  const destinations = Presentation.selectDestinations(cards, Discovery);
  assert.equal(Presentation.DESTINATION_LIMIT, 3);
  assert.equal(destinations.length, 3);
  assert.deepEqual(destinations.map((item) => item.title), ["崩れた祠", "黒い坑道", "荷車の跡"]);
  assert.equal(destinations[1].card, cards[1]);
});

test("destination cards preserve useful risk and signal information", () => {
  const destination = Presentation.extractDestination(card("黒い坑道", 4, "ダンジョン"), 0);
  assert.equal(destination.title, "黒い坑道");
  assert.equal(destination.risk, 4);
  assert.equal(destination.signal, "ダンジョン");
  assert.equal(destination.palette, "road");
});
