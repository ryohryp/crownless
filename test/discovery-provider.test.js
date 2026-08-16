const test = require("node:test");
const assert = require("node:assert/strict");
const Discovery = require("../src/discovery-provider.js");

test("simulated discovery exposes a small immediately actionable set", () => {
  const provider = Discovery.createSimulatedDiscoveryProvider({ limit: 3 });
  const leads = [
    { id: "a", title: "崩れた祠", signal: "shrine", risk: 2 },
    { id: "b", title: "黒い坑道", signal: "dungeon", risk: 4 },
    { id: "c", title: "荷車の跡", signal: "cache", risk: 1 },
    { id: "d", title: "遠い煙", signal: "combat", risk: 3 }
  ];

  const places = provider.discover({ leads });
  assert.equal(provider.kind, "simulated");
  assert.equal(places.length, 3);
  assert.deepEqual(places.map((place) => place.id), ["a", "b", "c"]);
  assert.equal(places[1].source, leads[1]);
});

test("discovered places normalize risk without changing source content", () => {
  const low = Discovery.normalizePlace({ id: "low", risk: 0 }, 0);
  const high = Discovery.normalizePlace({ id: "high", risk: 99 }, 1);
  assert.equal(low.risk, 1);
  assert.equal(high.risk, 5);
  assert.equal(high.source.risk, 99);
});
