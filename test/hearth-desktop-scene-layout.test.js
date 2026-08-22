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

test("desktop Hearth keeps the scene copy secondary to the room", () => {
  const scene = rule("#hub-screen .hearth-scene");
  assert.match(scene, /min-height:\s*650px/);

  const copy = rule("#hub-screen .hearth-scene-copy");
  assert.match(copy, /width:\s*min\(310px,\s*30%\)/);

  const heading = rule("#hub-screen .hearth-scene-copy h1");
  assert.match(heading, /font-size:\s*clamp\(34px,\s*3\.4vw,\s*44px\)/);
  assert.match(heading, /line-height:\s*\.98/);

  const map = rule("#hub-screen .hearth-scene--empty-room .hearth-map");
  assert.match(map, /left:\s*29%/);
  assert.match(map, /top:\s*14%/);
});

test("desktop Hearth aligns transparent hit regions with the room art", () => {
  const shelf = rule("#hub-screen .hearth-scene--empty-room .hearth-loot-shelf");
  assert.match(shelf, /left:\s*78%/);
  assert.match(shelf, /width:\s*17%/);

  const character = rule("#hub-screen .hearth-scene--empty-room .hearth-character");
  assert.match(character, /left:\s*47%/);
  assert.match(character, /width:\s*20%/);
  assert.match(character, /height:\s*52%/);

  const fire = rule("#hub-screen .hearth-scene--empty-room .hearth-fire");
  assert.match(fire, /left:\s*12%/);
});
