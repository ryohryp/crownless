const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ProxyCore = require("../src/geography-proxy.js");
const GeographyApi = require("../src/geography-api-provider.js");

test("server geography proxy races Overpass endpoints and returns the first successful payload", async () => {
  const calls = [];
  const result = await ProxyCore.requestGeography({
    latitude: 35.69,
    longitude: 139.78,
    radius: 650,
    endpoints: ["https://first.test/api", "https://second.test/api"],
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("first")) return { ok: false, status: 503, async json() { return {}; } };
      return { ok: true, status: 200, async json() { return { elements: [{ id: 1, tags: { waterway: "river", "name:ja": "中川" } }] }; } };
    }
  });

  assert.deepEqual(calls.map((call) => call.url).sort(), ["https://first.test/api", "https://second.test/api"]);
  assert.equal(result.endpoint, "https://second.test/api");
  assert.equal(result.timeoutMs, ProxyCore.DEFAULT_TIMEOUT_MS);
  const failed = result.attempts.find((attempt) => attempt.endpoint.includes("first"));
  const success = result.attempts.find((attempt) => attempt.endpoint.includes("second"));
  assert.equal(failed.state, "failed");
  assert.equal(failed.httpStatus, 503);
  assert.equal(failed.failureKind, "http");
  assert.equal(success.state, "success");
  assert.equal(result.elements[0].tags["name:ja"], "中川");
  const sentQuery = decodeURIComponent(calls[0].options.body.slice("data=".length));
  assert.match(sentQuery, /nw\(35\.684161,139\.772811,35\.695839,139\.787189\)\[waterway\]/);
  assert.doesNotMatch(sentQuery, /\.nearby/);
  assert.doesNotMatch(sentQuery, /around:650/);
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.equal(calls[0].options.headers["Accept-Encoding"], "gzip, deflate");
});

test("slow endpoint does not delay a faster healthy endpoint and is aborted", async () => {
  let slowAborted = false;
  const startedAt = Date.now();
  const result = await ProxyCore.requestGeography({
    latitude: 35.69,
    longitude: 139.78,
    endpoints: ["https://slow.test/api", "https://fast.test/api"],
    timeoutMs: 1000,
    fetch: (url, options) => new Promise((resolve, reject) => {
      if (url.includes("fast")) {
        setTimeout(() => resolve({ ok: true, status: 200, async json() { return { elements: [{ id: 7 }] }; } }), 20);
        return;
      }
      options.signal.addEventListener("abort", () => {
        slowAborted = true;
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
      setTimeout(() => resolve({ ok: true, status: 200, async json() { return { elements: [] }; } }), 800);
    })
  });

  assert.equal(result.endpoint, "https://fast.test/api");
  assert.equal(result.elements[0].id, 7);
  assert.ok(Date.now() - startedAt < 500);
  assert.equal(result.attempts.length, 2);
  const slowAttempt = result.attempts.find((attempt) => attempt.endpoint.includes("slow"));
  assert.equal(slowAttempt.state, "cancelled");
  assert.equal(slowAttempt.failureKind, "aborted");
  assert.equal(slowAborted, true);
});

test("production endpoint pool excludes the unreachable Japan mirror and keeps three global fallbacks", () => {
  assert.deepEqual(ProxyCore.DEFAULT_OVERPASS_ENDPOINTS, [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ]);
  assert.equal(ProxyCore.DEFAULT_OVERPASS_ENDPOINTS.some((endpoint) => endpoint.includes("openstreetmap.jp")), false);
});

test("server geography query applies selective tags directly to one bbox", () => {
  assert.deepEqual(ProxyCore.buildBoundingBox(35.69, 139.78, 650), [35.684161, 139.772811, 35.695839, 139.787189]);
  const query = ProxyCore.buildOverpassQuery(35.69, 139.78, 650);
  assert.match(query, /^\[out:json\]\[timeout:12\];\(nw\(35\.684161,139\.772811,35\.695839,139\.787189\)\[natural~/);
  assert.match(query, /nw\(35\.684161,139\.772811,35\.695839,139\.787189\)\[waterway\]/);
  assert.match(query, /nw\(35\.684161,139\.772811,35\.695839,139\.787189\)\[place~"\^\(city\|town\|village\|hamlet\|suburb\|neighbourhood\|quarter\|island\)\$"\]/);
  assert.doesNotMatch(query, /\.nearby/);
  assert.doesNotMatch(query, /around:/);
  assert.doesNotMatch(query, /\[natural\];/);
  assert.doesNotMatch(query, /\[place\];/);
  assert.match(query, /\);out tags qt;$/);
  assert.doesNotMatch(query, /relation/);
});

test("server geography query falls back to exact-radius around search near coordinate edges", () => {
  assert.equal(ProxyCore.buildBoundingBox(89.9, 139.78, 650), null);
  assert.match(ProxyCore.buildOverpassQuery(89.9, 139.78, 650), /nw\(around:650,89\.9,139\.78\)\[waterway\]/);
  assert.equal(ProxyCore.buildBoundingBox(35.69, 179.999, 650), null);
  assert.match(ProxyCore.buildOverpassQuery(35.69, 179.999, 650), /nw\(around:650,35\.69,179\.999\)\[waterway\]/);
});

test("server geography proxy classifies timeout and network failures", () => {
  assert.equal(ProxyCore.classifyUpstreamFailure({ code: "OVERPASS_TIMEOUT" }), "timeout");
  assert.equal(ProxyCore.classifyUpstreamFailure({ httpStatus: 429 }), "http");
  assert.equal(ProxyCore.classifyUpstreamFailure({ name: "AbortError" }), "aborted");
  assert.equal(ProxyCore.classifyUpstreamFailure(new Error("fetch failed")), "network");
});

test("background geography gets a longer enrichment window than its Overpass query", () => {
  assert.equal(ProxyCore.DEFAULT_TIMEOUT_MS, 15000);
  assert.equal(ProxyCore.OVERPASS_QUERY_TIMEOUT_SECONDS, 12);
  assert.ok(ProxyCore.OVERPASS_QUERY_TIMEOUT_SECONDS * 1000 < ProxyCore.DEFAULT_TIMEOUT_MS);
});

test("timeout paths preserve an explicit reason before aborting fetch", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../src/geography-proxy.js"), "utf8");
  const browserSource = fs.readFileSync(path.join(__dirname, "../src/geography-api-provider.js"), "utf8");
  assert.ok(serverSource.indexOf("reject(error);") < serverSource.indexOf("controller.abort(error);"));
  assert.ok(browserSource.indexOf("reject(error);") < browserSource.indexOf("controller.abort(error);"));
});

test("server geography proxy validates coordinates and clamps radius", async () => {
  await assert.rejects(ProxyCore.requestGeography({ latitude: 999, longitude: 139, fetch: async () => ({ ok: true }) }), /Invalid latitude/);
  assert.equal(ProxyCore.normalizeRadius(5000), 1500);
  assert.equal(ProxyCore.normalizeRadius(10), 100);
});

test("server geography handler logs structured degraded state", async () => {
  const warnings = [];
  const handler = ProxyCore.createGeographyHandler({
    endpoints: ["https://first.test/api", "https://second.test/api"],
    logger: { warn: (message) => warnings.push(JSON.parse(message)), error() {} },
    fetch: async (url) => {
      if (url.includes("first")) return { ok: false, status: 503, async json() { return {}; } };
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, status: 200, async json() { return { elements: [] }; } };
    }
  });
  let body = null;
  const response = { statusCode: 0, headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { body = JSON.parse(value); } };
  await handler({ method: "GET", query: { lat: "35.69", lng: "139.78", radius: "650" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(body.endpoint, "https://second.test/api");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].event, "geography_upstream_state");
});

test("all failed upstream diagnostics retain endpoint-specific reasons", async () => {
  await assert.rejects(
    ProxyCore.requestGeography({
      latitude: 35.69,
      longitude: 139.78,
      endpoints: ["https://network.test/api", "https://http.test/api"],
      fetch: async (url) => {
        if (url.includes("network")) throw new Error("fetch failed");
        return { ok: false, status: 503, async json() { return {}; } };
      }
    }),
    (error) => {
      assert.equal(error.code, "GEOGRAPHY_UPSTREAM_FAILED");
      assert.equal(error.attempts.length, 2);
      assert.equal(error.attempts[0].failureKind, "network");
      assert.equal(error.attempts[0].error, "fetch failed");
      assert.equal(error.attempts[1].failureKind, "http");
      assert.equal(error.attempts[1].httpStatus, 503);
      return true;
    }
  );
});

test("browser geography provider calls Crownless API instead of Overpass directly", async () => {
  const statuses = [];
  let requestedUrl = "";
  const provider = GeographyApi.createProxyLocationDiscoveryProvider({
    endpoint: "https://crownless.test/api/geography",
    radius: 650,
    onStatus: (status) => statuses.push(status),
    fetch: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.method, "GET");
      return { ok: true, status: 200, async json() { return {
        endpoint: "https://overpass-api.de/api/interpreter", total: 3, timeoutMs: 15000,
        attempts: [{ endpoint: "https://overpass-api.de/api/interpreter", state: "success", httpStatus: 200, error: "", timedOut: false, failureKind: "", durationMs: 456 }],
        elements: [{ id: 1, tags: { waterway: "river", "name:ja": "中川" } }, { id: 2, tags: { bridge: "yes" } }]
      }; } };
    }
  });
  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.match(requestedUrl, /lat=35\.69/);
  assert.equal(discoveries[0].title, "中川の血濡れの渡し場");
  assert.equal(provider.endpoint, "https://overpass-api.de/api/interpreter");
  assert.equal(statuses[0].state, "requesting");
  assert.equal(statuses.at(-1).state, "success");
});
