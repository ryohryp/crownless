const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("GitHub Pages publishes the staged repository root and watchtower asset", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "pages.yml"), "utf8");
  assert.match(workflow, /rsync -a --delete[\s\S]*\.\/ _site\//);
  assert.match(workflow, /actions\/upload-pages-artifact@v3[\s\S]*path:\s*_site/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "locations", "ruined-watchtower.png")));
});
