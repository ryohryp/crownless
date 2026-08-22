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

test("mobile Grey Hearth reserves separate copy and wall-object bands", () => {
  assert.match(viewportCss, /@media \(max-width:\s*700px\)/);
  assert.match(rule("#hub-screen .hearth-scene"), /min-height:\s*820px/);

  const copy = rule("#hub-screen .hearth-scene-copy");
  assert.match(copy, /top:\s*18px/);
  assert.match(copy, /left:\s*16px/);
  assert.match(copy, /width:\s*calc\(100% - 32px\)/);

  const map = rule("#hub-screen .hearth-map");
  assert.match(map, /top:\s*190px/);
  assert.match(map, /transform:\s*scale\(\.68\)/);

  const gate = rule("#hub-screen .hearth-gate");
  assert.match(gate, /top:\s*220px/);
  assert.match(gate, /height:\s*270px/);
});

test("mobile floor labels are separated instead of all sharing the bottom edge", () => {
  const character = rule("#hub-screen .hearth-character");
  assert.match(character, /left:\s*43%/);
  assert.match(character, /bottom:\s*155px/);

  const fire = rule("#hub-screen .hearth-fire");
  assert.match(fire, /left:\s*78%/);
  assert.match(fire, /bottom:\s*96px/);

  const shelf = rule("#hub-screen .hearth-loot-shelf");
  assert.match(shelf, /left:\s*2%/);
  assert.match(shelf, /bottom:\s*42px/);

  const shelfLabel = rule("#hub-screen .hearth-loot-shelf .object-label");
  assert.match(shelfLabel, /top:\s*-56px/);
  assert.match(shelfLabel, /bottom:\s*auto/);
});

test("mobile layout override keeps Hearth interactions and location-art sizing independent", () => {
  assert.match(presentationJs, /ensureStylesheet\("hearth-viewport\.css"\)/);
  assert.match(presentationJs, /map\?\.addEventListener\("click"/);
  assert.match(presentationJs, /mapPaper\.style\.backgroundImage/);

  assert.match(hearthCss, /\.hearth-map\s*\{[\s\S]*?width:\s*175px[\s\S]*?height:\s*118px/);
  assert.doesNotMatch(viewportCss, /has-location-visual[\s\S]*?(?:width|height)\s*:/);
});
