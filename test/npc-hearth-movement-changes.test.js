const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");

test("Hearth movement changes describe arrivals and departures without leaking off-screen locations", () => {
  const beforeMarcoLeaves = NpcLife.snapshotAt(8);
  const afterMarcoLeaves = NpcLife.snapshotAt(9);
  const left = NpcLife.hearthMovementChanges(beforeMarcoLeaves, afterMarcoLeaves);

  assert.deepEqual(left.map((change) => change.text), ["マルコは炉端を離れて出かけた。"]);
  assert.doesNotMatch(left[0].text, /北の街道|工房|市場|川辺|酒場|自宅|宿/);

  const beforeMiraReturns = NpcLife.snapshotAt(9);
  const afterMiraReturns = NpcLife.snapshotAt(10);
  const arrived = NpcLife.hearthMovementChanges(beforeMiraReturns, afterMiraReturns);

  assert.deepEqual(arrived.map((change) => change.text), ["ミラが炉端へ戻ってきた。"]);
  assert.equal(arrived[0].direction, "arrived");
});

test("Hearth movement changes are empty when presence does not change", () => {
  assert.deepEqual(
    NpcLife.hearthMovementChanges(NpcLife.snapshotAt(10), NpcLife.snapshotAt(11)),
    []
  );
  assert.deepEqual(NpcLife.hearthMovementChanges([], NpcLife.snapshotAt(11)), []);
});
