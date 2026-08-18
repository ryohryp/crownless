const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Geography API runs in Tokyo to keep Japan GPS discovery close to Overpass", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));
  assert.deepEqual(config.functions["api/geography.js"].regions, ["hnd1"]);
});
