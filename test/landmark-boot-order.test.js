const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("landmark catalogue and UI are available before first render of a saved game", () => {
  const html = fs.readFileSync("expedition.html", "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
  for (const path of ["src/travel-footprints.js", "src/travel-chronicle-ui.js", "src/slice-app.js"]) {
    assert.equal(scripts.filter(s => s === path).length, 1, path + " loads once");
  }
  assert(scripts.indexOf("src/travel-footprints.js") < scripts.indexOf("src/travel-chronicle-ui.js"));
  assert(scripts.indexOf("src/travel-chronicle-ui.js") < scripts.indexOf("src/slice-app.js"));
});
