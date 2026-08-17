const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ProxyCore = require("../src/geography-proxy.js");
const GeographyApi = require("../src/geography-api-provider.js");

test("server geography proxy retries Overpass endpoints and returns the successful payload", async () => {
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

  assert.deepEqual(calls.map((call) => call.url), ["https://first.test/api", "https://second.test/api"]);
  assert.equal(result.endpoint, "https://second.test/api");
  assert.equal(result.timeoutMs, ProxyCore.DEFAULT_TIMEOUT_MS);
  assert.equal(result.attempts[0].state, "failed");
  assert.equal(result.attempts[0].httpStatus, 503);
  assert.equal(result.attempts[0].failureKind, "http");
  assert.ok(result.attempts[0].durationMs >= 0);
  assert.equal(result.attempts[1].state, "success");
  assert.equal(result.attempts[1].failureKind, "");
  assert.ok(result.attempts[1].durationMs >= 0);
  assert.equal(result.elements[0].tags["name:ja"], "中川");
  assert.match(calls[0].options.body, /around%3A650%2C35.69%2C139.78/);
  assert.equal(calls[0].options.headers.Accept, "application/json");
  assert.equal(calls[0].options.headers["User-Agent"], "Crownless/0.1 (+https://crownless-iota.vercel.app/)");
});

test("server geography proxy classifies timeout and network failures", () => {
  assert.equal(ProxyCore.classifyUpstreamFailure({ code: "OVERPASS_TIMEOUT" }), "timeout");
  assert.equal(ProxyCore.classifyUpstreamFailure({ httpStatus: 429 }), "http");
  assert.equal(ProxyCore.classifyUpstreamFailure({ name: "AbortError" }), "aborted");
  assert.equal(ProxyCore.classifyUpstreamFailure(new Error("fetch failed")), "network");
});

test("server geography proxy keeps all sequential fallbacks inside the browser timeout budget", () => {
  assert.ok(ProxyCore.DEFAULT_TIMEOUT_MS <= 6000);
  assert.ok(ProxyCore.DEFAULT_TIMEOUT_MS * 3 < 22000);
});

test("timeout paths preserve an explicit reason before aborting fetch", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "../src/geography-proxy.js"), "utf8");
  const browserSource = fs.readFileSync(path.join(__dirname, "../src/geography-api-provider.js"), "utf8");
  assert.ok(serverSource.indexOf("reject(error);") < serverSource.indexOf("controller.abort(error);"));
  assert.ok(browserSource.indexOf("reject(error);") < browserSource.indexOf("controller.abort(error);"));
});

test("server geography proxy validates coordinates and clamps radius", async () => {
  await assert.rejects(
    ProxyCore.requestGeography({ latitude: 999, longitude: 139, fetch: async () => ({ ok: true }) }),
    /Invalid latitude/
  );
  assert.equal(ProxyCore.normalizeRadius(5000), 1500);
  assert.equal(ProxyCore.normalizeRadius(10), 100);
});

test("server geography handler logs structured fallback state", async () => {
  const warnings = [];
  const handler = ProxyCore.createGeographyHandler({
    endpoints: ["https://first.test/api", "https://second.test/api"],
    logger: { warn: (message) => warnings.push(JSON.parse(message)), error() {} },
    fetch: async (url) => {
      if (url.includes("first")) return { ok: false, status: 503, async json() { return {}; } };
      return { ok: true, status: 200, async json() { return { elements: [] }; } };
    }
  });
  let body = null;
  const response = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { body = JSON.parse(value); }
  };

  await handler({ method: "GET", query: { lat: "35.69", lng: "139.78", radius: "650" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(body.endpoint, "https://second.test/api");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].event, "geography_upstream_state");
  assert.equal(warnings[0].state, "fallback_success");
  assert.equal(warnings[0].attempts[0].failureKind, "http");
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
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            endpoint: "https://overpass-api.de/api/interpreter",
            total: 3,
            timeoutMs: 6000,
            attempts: [
              { endpoint: "https://first.test/api", state: "failed", httpStatus: 503, error: "HTTP 503", timedOut: false, failureKind: "http", durationMs: 123 },
              { endpoint: "https://overpass-api.de/api/interpreter", state: "success", httpStatus: 200, error: "", timedOut: false, failureKind: "", durationMs: 456 }
            ],
            elements: [
              { id: 1, tags: { waterway: "river", "name:ja": "中川" } },
              { id: 2, tags: { bridge: "yes" } }
            ]
          };
        }
      };
    }
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.match(requestedUrl, /^https:\/\/crownless\.test\/api\/geography\?/);
  assert.match(requestedUrl, /lat=35\.69/);
  assert.match(requestedUrl, /lng=139\.78/);
  assert.match(requestedUrl, /radius=650/);
  assert.equal(discoveries[0].title, "中川の血濡れの渡し場");
  assert.equal(provider.endpoint, "https://overpass-api.de/api/interpreter");
  assert.equal(statuses[0].state, "requesting");
  assert.equal(statuses.at(-1).state, "success");
  assert.equal(statuses.at(-1).attempt, 2);
  assert.equal(statuses.at(-1).total, 3);
});
