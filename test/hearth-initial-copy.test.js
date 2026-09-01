const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Grey Hearth initial HTML uses expedition preparation copy", () => {
  assert.match(html, /aria-label="遠征に持ち出す装備を確かめる"/);
  assert.match(html, /id="loadout-title">遠征の支度をする</);
  assert.match(html, /持ち出す装備はまだない。地図と仲間を見て、次の遠征を決めよう。/);
});

test("Grey Hearth initial HTML does not expose legacy direct-combat copy", () => {
  assert.doesNotMatch(html, /拳だけで出る/);
  assert.doesNotMatch(html, /拳は最初から最後まで選べる戦い方だ/);
});
