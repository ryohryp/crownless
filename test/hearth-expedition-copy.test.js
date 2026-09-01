const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "src", "hearth-presentation.js"), "utf8");

test("Grey Hearth normalizes legacy combat copy into expedition preparation copy", () => {
  assert.match(js, /function syncExpeditionReadinessCopy\(\)/);
  assert.match(js, /syncExpeditionReadinessCopy\(\);/);
  assert.match(js, /遠征に持ち出す装備を確かめる/);
  assert.match(js, /遠征の支度をする/);
  assert.match(js, /地図と仲間を見て、次の遠征を決めよう/);
  assert.match(js, /誰に託し、どこへ送るかを決めよう/);
});

test("Hearth equipment interaction no longer teaches direct real-time combat", () => {
  assert.doesNotMatch(js, /拳を鳴らした/);
  assert.doesNotMatch(js, /武器がなくても、外へは出られる/);
  assert.match(js, /遠征装備として確かめた/);
  assert.match(js, /誰に託すかは、送り出す前に決める/);
});
