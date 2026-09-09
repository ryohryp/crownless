const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("root entrypoint sends players to the canonical reboot", () => {
  assert.match(html, /<meta http-equiv="refresh" content="0; url=reboot\.html" \/>/);
  assert.match(html, /<link rel="canonical" href="reboot\.html" \/>/);
  assert.match(html, /location\.replace\('reboot\.html' \+ location\.search \+ location\.hash\)/);
});

test("root entrypoint does not restore the retired Grey Hearth or direct-combat shell", () => {
  assert.doesNotMatch(html, /id="loadout-title"/);
  assert.doesNotMatch(html, /遠征に持ち出す装備を確かめる/);
  assert.doesNotMatch(html, /拳だけで出る/);
  assert.doesNotMatch(html, /拳は最初から最後まで選べる戦い方だ/);
});
