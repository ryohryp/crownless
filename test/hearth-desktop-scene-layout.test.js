const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const viewportCss = fs.readFileSync(path.join(root, "hearth-viewport.css"), "utf8");
const desktopMarker = "@media (min-width: 901px)";
const desktopStart = viewportCss.indexOf(desktopMarker);

assert.notEqual(desktopStart, -1, "missing desktop Hearth media query");
const desktopCss = viewportCss.slice(desktopStart);

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = desktopCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing desktop CSS rule: ${selector}`);
  return match[1];
}

test("desktop Hearth keeps hero copy above the map band", () => {
  const copy = rule("#hub-screen .hearth-scene-copy");
  assert.match(copy, /width:\s*min\(500px,\s*44%\)/);

  const heading = rule("#hub-screen .hearth-scene-copy h1");
  assert.match(heading, /font-size:\s*clamp\(44px,\s*4\.2vw,\s*58px\)/);
  assert.match(heading, /line-height:\s*\.98/);

  const map = rule("#hub-screen .hearth-map");
  assert.match(map, /left:\s*3%/);
  assert.match(map, /top:\s*225px/);
});

test("desktop Hearth separates shelf, character and fire labels horizontally", () => {
  const shelfLabel = rule("#hub-screen .hearth-loot-shelf .object-label");
  assert.match(shelfLabel, /left:\s*-72px/);
  assert.match(shelfLabel, /width:\s*125px/);
  assert.match(shelfLabel, /min-width:\s*0/);

  const character = rule("#hub-screen .hearth-character");
  assert.match(character, /left:\s*28%/);

  const fire = rule("#hub-screen .hearth-fire");
  assert.match(fire, /left:\s*46%/);
});
