const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

test("player location status stays separate from detailed diagnostics", () => {
  assert.match(source, /id = "location-discovery-status"/);
  assert.match(source, /marker\.textContent = statusText\(\)/);
  assert.doesNotMatch(source, /marker\.textContent = `\$\{statusText\(\)\} \$\{diagnosticText\(\)\}`/);
});

test("detailed location diagnostics are available in a collapsed details element", () => {
  assert.match(source, /createElement\("details"\)/);
  assert.match(source, /id = "location-discovery-diagnostics"/);
  assert.match(source, /summary\.textContent = "位置情報の診断"/);
  assert.match(source, /body\.textContent = diagnosticText\(\)/);
  assert.doesNotMatch(source, /details\.open\s*=\s*true/);
});

test("location diagnostics preserve non-blocking discovery updates", () => {
  assert.match(source, /warning\.parentNode\.insertBefore\(marker, warning\.nextSibling\)/);
  assert.match(source, /queueMicrotask\(setPendingUi\)/);
  assert.match(source, /discovery\.finally/);
  assert.doesNotMatch(source, /warning\.appendChild\(marker\)/);
});

test("diagnostics retain GPS and Geography API failure details", () => {
  assert.match(source, /PERMISSION_DENIED/);
  assert.match(source, /POSITION_UNAVAILABLE/);
  assert.match(source, /TIMEOUT/);
  assert.match(source, /HTTP:/);
  assert.match(source, /ERROR:/);
  assert.match(source, /endpointLabel/);
});
