const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function replaceOnce(relativePath, before, after) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${relativePath}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${relativePath}: source fragment is not unique`);
  fs.writeFileSync(filePath, source.slice(0, first) + after + source.slice(first + before.length));
}

replaceOnce(
  "src/world-atlas.js",
  "  const NEARBY_LIMIT = 3;",
  "  const NEARBY_LIMIT = 6;"
);

replaceOnce(
  "src/world-atlas.js",
  "      return `周囲の ${result.foundCount} 件を照合。すべて既知の探索候補だった。`;",
  "      return `周囲の ${result.foundCount} 件を照合。既知の地点を地図へ重ねた。時間や世界の動きで、新しい気配が現れることもある。`;"
);

replaceOnce(
  "src/location-discovery-runtime.js",
  "    return [watchtower, ...source].slice(0, 3);",
  "    return [watchtower, ...source].slice(0, 6);"
);

replaceOnce(
  "src/location-discovery-runtime.js",
  "GeographyApi.createProxyLocationDiscoveryProvider({ limit: 3, radius: 650, timeoutMs: 22000,",
  "GeographyApi.createProxyLocationDiscoveryProvider({ limit: 6, radius: 650, timeoutMs: 22000,"
);

replaceOnce(
  "test/location-discovery-runtime.test.js",
  "  assert.match(runtimeSource, /limit: 3/);",
  "  assert.match(runtimeSource, /limit: 6/);"
);

const densityTest = `const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Atlas = require("../src/world-atlas.js");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

function discovery(index) {
  return {
    title: \`周辺候補\${index + 1}\`,
    baseTitle: \`候補\${index + 1}\`,
    realPlaceName: \`地点\${index + 1}\`,
    sourceRef: \`way:\${900 + index}\`,
    contentKind: index % 3 === 0 ? "encounter" : index % 3 === 1 ? "event" : "dungeon",
    features: index % 2 === 0 ? ["water"] : ["road_hub"],
    mapOrigin: { latitude: 35.68, longitude: 139.77 },
    representativeCoordinate: {
      latitude: 35.68 + (index + 1) * 0.00025,
      longitude: 139.77 + ((index % 4) - 1.5) * 0.00035
    }
  };
}

test("nearby atlas can present six real-world discoveries without persisting raw coordinates", () => {
  const runtime = {
    state: "ready",
    discoveries: Array.from({ length: 8 }, (_, index) => discovery(index)),
    worldKnowledgeKey(item) { return \`geo:\${item.sourceRef}\`; }
  };

  const model = Atlas.nearbyViewModel(runtime, { discoveries: {} });
  assert.equal(Atlas.NEARBY_LIMIT, 6);
  assert.equal(model.length, 6);
  assert.deepEqual(model.map((entry) => entry.name), [
    "周辺候補1", "周辺候補2", "周辺候補3", "周辺候補4", "周辺候補5", "周辺候補6"
  ]);
  assert.doesNotMatch(JSON.stringify(model), /latitude|longitude|35\\.68|139\\.77/);
});

test("location runtime requests enough geographic discoveries to feed the denser atlas", () => {
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider\\(\\{ limit: 6, radius: 650/);
  assert.match(runtimeSource, /return \\[watchtower, \\.\\.\\.source\\]\\.slice\\(0, 6\\)/);
});

test("known-only rescan copy keeps the surrounding world open-ended", () => {
  const copy = Atlas.scanResultText({ state: "ready", foundCount: 6, newCount: 0 }, false);
  assert.match(copy, /時間や世界の動き/);
  assert.doesNotMatch(copy, /すべて既知/);
});
`;
fs.writeFileSync(path.join(root, "test/world-atlas-nearby-density.test.js"), densityTest);

for (const relativePath of ["scripts/apply-issue-361.js", ".github/workflows/issue-361-apply.yml"]) {
  const filePath = path.join(root, relativePath);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}
