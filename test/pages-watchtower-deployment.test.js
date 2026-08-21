const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("GitHub Pages publishes the location visual client and asset from the repository root", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "pages.yml"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(workflow, /actions\/upload-pages-artifact@v3[\s\S]*path:\s*\./);
  assert.match(html, /src="src\/location-visuals\.js"/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "locations", "ruined-watchtower.png")));
});