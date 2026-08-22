const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const viewportCss = fs.readFileSync(path.join(root, "hearth-viewport.css"), "utf8");
const hearthCss = fs.readFileSync(path.join(root, "hearth.css"), "utf8");
const presentationJs = fs.readFileSync(path.join(root, "src", "hearth-presentation.js"), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = viewportCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
}

test("mobile Grey Hearth keeps the scene copy and gate in separate visual bands", () => {
  assert.match(viewportCss, /@media \(max-width:\s*700px\)/);
  assert.match(rule("#hub-screen .hearth-scene"), /min-height:\s*820px/);

  const copy = rule("#hub-screen .hearth-scene-copy");
  assert.match(copy, /top:\s*18px/);
  assert.match(copy, /left:\s*16px/);
  assert.match(copy, /width:\s*min\(290px,\s*calc\(100% - 32px\)\)/);

  const map = rule("#hub-screen .hearth-scene--empty-room .hearth-map");
  assert.match(map, /top:\s*184px/);
  assert.match(map, /width:\s*46%/);

  const gate = rule("#hub-screen .hearth-scene--empty-room .hearth-gate");
  assert.match(gate, /top:\s*166px/);
  assert.match(gate, /height:\s*49%/);
});

test("mobile floor hit regions follow the selected room composition", () => {
  const character = rule("#hub-screen .hearth-scene--empty-room .hearth-character");
  assert.match(character, /left:\s*46%/);
  assert.match(character, /bottom:\s*17%/);

  const fire = rule("#hub-screen .hearth-scene--empty-room .hearth-fire");
  assert.match(fire, /left:\s*2%/);
  assert.match(fire, /bottom:\s*16%/);

  const shelf = rule("#hub-screen .hearth-scene--empty-room .hearth-loot-shelf");
  assert.match(shelf, /left:\s*75%/);
  assert.match(shelf, /bottom:\s*16%/);

  const shelfLabel = rule("#hub-screen .hearth-scene--empty-room .hearth-loot-shelf .object-label");
  assert.match(shelfLabel, /top:\s*-10px/);
  assert.match(shelfLabel, /bottom:\s*auto/);

  const gateLabel = rule("#hub-screen .hearth-scene--empty-room .hearth-gate .object-label");
  assert.match(gateLabel, /right:\s*-42px/);
});

test("mobile layout override keeps Hearth interactions and location-art sizing independent", () => {
  assert.match(presentationJs, /ensureStylesheet\("hearth-viewport\.css"\)/);
  assert.match(presentationJs, /map\?\.addEventListener\("click"/);
  assert.doesNotMatch(presentationJs, /mapPaper\.style\.backgroundImage/);

  assert.match(hearthCss, /\.hearth-map\s*\{[\s\S]*?width:\s*175px[\s\S]*?height:\s*118px/);
  assert.doesNotMatch(viewportCss, /has-location-visual[\s\S]*?(?:width|height)\s*:/);
});
