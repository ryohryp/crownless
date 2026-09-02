const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function replaceOnce(relativePath, before, after) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${relativePath}: expected source fragment not found: ${before}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${relativePath}: source fragment is not unique: ${before}`);
  fs.writeFileSync(filePath, source.slice(0, first) + after + source.slice(first + before.length));
}

replaceOnce(
  "src/world-atlas.js",
  "  const NEARBY_LIMIT = 6;",
  "  const NEARBY_LIMIT = 3;\n  const NEARBY_DISPLAY_LIMIT = 6;"
);
replaceOnce(
  "src/world-atlas.js",
  "  function nearbyViewModel(runtime, worldKnowledge, projectionApi) {",
  "  function nearbyViewModel(runtime, worldKnowledge, projectionApi, limit = NEARBY_LIMIT) {"
);
replaceOnce(
  "src/world-atlas.js",
  "    return runtime.discoveries.slice(0, NEARBY_LIMIT).map((discovery) => {",
  "    const visibleLimit = Math.max(1, Number(limit) || NEARBY_LIMIT);\n    return runtime.discoveries.slice(0, visibleLimit).map((discovery) => {"
);
replaceOnce(
  "src/world-atlas.js",
  "    const nearbyModel = nearbyViewModel(runtime, safe && safe.worldKnowledge, root && root.CrownlessExplorationMap);",
  "    const nearbyModel = nearbyViewModel(runtime, safe && safe.worldKnowledge, root && root.CrownlessExplorationMap, NEARBY_DISPLAY_LIMIT);"
);
replaceOnce(
  "src/world-atlas.js",
  "    NEARBY_LIMIT,\n    NEARBY_RADIUS_METRES,",
  "    NEARBY_LIMIT,\n    NEARBY_DISPLAY_LIMIT,\n    NEARBY_RADIUS_METRES,"
);

replaceOnce(
  "src/location-discovery-runtime.js",
  "  const GEOLOCATION_MAX_ATTEMPTS = 2;",
  "  const GEOLOCATION_MAX_ATTEMPTS = 2;\n  const NEARBY_DISCOVERY_LIMIT = 6;"
);
replaceOnce(
  "src/location-discovery-runtime.js",
  "GeographyApi.createProxyLocationDiscoveryProvider({ limit: 6, radius: 650, timeoutMs: 22000,",
  "GeographyApi.createProxyLocationDiscoveryProvider({ limit: 3, radius: 650, timeoutMs: 22000,"
);
replaceOnce(
  "src/location-discovery-runtime.js",
  "const discovered = await provider.discover({ location });",
  "const discovered = await provider.discover({ location, limit: NEARBY_DISCOVERY_LIMIT });"
);

replaceOnce(
  "src/geography-api-provider.js",
  "    const limit = Math.max(1, Number(settings.limit) || 3);",
  "    const defaultLimit = Math.max(1, Number(settings.limit) || 3);"
);
replaceOnce(
  "src/geography-api-provider.js",
  "        const location = context && context.location;\n        if (!location) throw new Error(\"Location is required for geographic discovery\");",
  "        const location = context && context.location;\n        if (!location) throw new Error(\"Location is required for geographic discovery\");\n        const limit = Math.max(1, Number(context && context.limit) || defaultLimit);"
);

replaceOnce(
  "test/location-discovery-runtime.test.js",
  "  assert.match(runtimeSource, /const discovered = await provider\\.discover\\(\\{ location \\}\\)/);",
  "  assert.match(runtimeSource, /const discovered = await provider\\.discover\\(\\{ location, limit: NEARBY_DISCOVERY_LIMIT \\}\\)/);"
);
replaceOnce(
  "test/location-discovery-runtime.test.js",
  "  assert.match(runtimeSource, /limit: 6/);",
  "  assert.match(runtimeSource, /NEARBY_DISCOVERY_LIMIT = 6/);\n  assert.match(runtimeSource, /limit: 3/);\n  assert.match(runtimeSource, /provider\\.discover\\(\\{ location, limit: NEARBY_DISCOVERY_LIMIT \\}\\)/);"
);

replaceOnce(
  "test/world-atlas-nearby-density.test.js",
  "const runtimeSource = fs.readFileSync(path.join(__dirname, \"../src/location-discovery-runtime.js\"), \"utf8\");",
  "const runtimeSource = fs.readFileSync(path.join(__dirname, \"../src/location-discovery-runtime.js\"), \"utf8\");\nconst atlasSource = fs.readFileSync(path.join(__dirname, \"../src/world-atlas.js\"), \"utf8\");\nconst geographySource = fs.readFileSync(path.join(__dirname, \"../src/geography-api-provider.js\"), \"utf8\");"
);
replaceOnce(
  "test/world-atlas-nearby-density.test.js",
  "  const model = Atlas.nearbyViewModel(runtime, { discoveries: {} });\n  assert.equal(Atlas.NEARBY_LIMIT, 6);",
  "  const model = Atlas.nearbyViewModel(runtime, { discoveries: {} }, undefined, Atlas.NEARBY_DISPLAY_LIMIT);\n  assert.equal(Atlas.NEARBY_LIMIT, 3);\n  assert.equal(Atlas.NEARBY_DISPLAY_LIMIT, 6);"
);
replaceOnce(
  "test/world-atlas-nearby-density.test.js",
  "  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider\\(\\{ limit: 6, radius: 650/);\n  assert.match(runtimeSource, /return \\[watchtower, \\.\\.\\.source\\]\\.slice\\(0, 6\\)/);",
  "  assert.match(runtimeSource, /NEARBY_DISCOVERY_LIMIT = 6/);\n  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider\\(\\{ limit: 3, radius: 650/);\n  assert.match(runtimeSource, /provider\\.discover\\(\\{ location, limit: NEARBY_DISCOVERY_LIMIT \\}\\)/);\n  assert.match(runtimeSource, /return \\[watchtower, \\.\\.\\.source\\]\\.slice\\(0, 6\\)/);\n  assert.match(atlasSource, /nearbyViewModel\\(runtime, safe && safe\\.worldKnowledge, root && root\\.CrownlessExplorationMap, NEARBY_DISPLAY_LIMIT\\)/);\n  assert.match(geographySource, /const defaultLimit = Math\\.max\\(1, Number\\(settings\\.limit\\) \\|\\| 3\\)/);\n  assert.match(geographySource, /Number\\(context && context\\.limit\\) \\|\\| defaultLimit/);"
);

for (const relativePath of ["scripts/apply-issue-361-compat.js", ".github/workflows/issue-361-compat.yml"]) {
  const filePath = path.join(root, relativePath);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
}
