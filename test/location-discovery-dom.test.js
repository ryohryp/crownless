const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

class FakeClassList {
  constructor(element) { this.element = element; }
  _set() { return new Set(String(this.element.className || "").split(/\s+/).filter(Boolean)); }
  _write(set) { this.element.className = [...set].join(" "); }
  contains(name) { return this._set().has(name); }
  add(name) { const set = this._set(); set.add(name); this._write(set); }
  toggle(name, force) {
    const set = this._set();
    const next = force === undefined ? !set.has(name) : Boolean(force);
    if (next) set.add(name); else set.delete(name);
    this._write(set);
    return next;
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.id = "";
    this.className = "";
    this.hidden = false;
    this.textContent = "";
    this.innerHTML = "";
    this.classList = new FakeClassList(this);
  }
  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return index >= 0 ? this.parentNode.children[index + 1] || null : null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { nodes.forEach((node) => this._insert(node, this.children.length)); }
  prepend(...nodes) { [...nodes].reverse().forEach((node) => this._insert(node, 0)); }
  insertBefore(node, reference) {
    const index = reference ? this.children.indexOf(reference) : -1;
    this._insert(node, index >= 0 ? index : this.children.length);
    return node;
  }
  insertAdjacentElement(position, node) {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    const offset = position === "beforebegin" ? 0 : 1;
    this.parentNode._insert(node, index + offset);
    return node;
  }
  _insert(node, index) {
    if (node.parentNode) {
      const previous = node.parentNode.children.indexOf(node);
      if (previous >= 0) node.parentNode.children.splice(previous, 1);
    }
    node.parentNode = this;
    this.children.splice(index, 0, node);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const results = [];
    const match = (element) => {
      if (selector.startsWith(".")) return element.classList.contains(selector.slice(1));
      if (selector.startsWith("#")) return element.id === selector.slice(1);
      return element.tagName.toLowerCase() === selector.toLowerCase();
    };
    const visit = (element) => {
      element.children.forEach((child) => {
        if (match(child)) results.push(child);
        visit(child);
      });
    };
    visit(this);
    return results;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement("body", this);
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  getElementById(id) {
    if (this.body.id === id) return this.body;
    const stack = [...this.body.children];
    while (stack.length) {
      const element = stack.shift();
      if (element.id === id) return element;
      stack.unshift(...element.children);
    }
    return null;
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function buildHarness({ gps = "success", providerMode = "deferred" } = {}) {
  const document = new FakeDocument();
  const explore = document.createElement("section");
  explore.id = "explore-screen";
  explore.className = "screen active";
  const warning = document.createElement("div");
  warning.id = "carried-warning";
  const leadList = document.createElement("div");
  leadList.id = "lead-list";
  explore.append(warning, leadList);
  document.body.append(explore);

  const providerDeferred = deferred();
  let providerCalls = 0;
  let gpsCalls = 0;
  let clock = 100;

  const Core = {
    discoverLocation(state) { return state; },
    beginExpedition(state) { return Object.assign({}, state, { expedition: { started: true } }); }
  };
  const GeographyApi = {
    DEFAULT_PROXY_ENDPOINT: "/api/geography",
    createProxyLocationDiscoveryProvider() {
      providerCalls += 1;
      return {
        endpoint: "/api/geography",
        discover() {
          if (providerMode === "reject") return Promise.reject(new Error("provider failed"));
          if (providerMode === "resolved") return Promise.resolve([{ title: "川沿いの痕跡", signal: "水音", risk: 1, palette: "water", contentKind: "event", features: ["water"], realPlaceName: "Test River" }]);
          return providerDeferred.promise;
        }
      };
    }
  };
  const navigator = {
    geolocation: {
      getCurrentPosition(success, failure) {
        gpsCalls += 1;
        if (gps === "denied") {
          failure({ code: 1, message: "permission denied" });
          return;
        }
        if (gps === "failed") {
          failure({ code: 2, message: "position unavailable" });
          return;
        }
        success({ coords: { latitude: 35.0, longitude: 139.0 } });
      }
    }
  };
  const window = { CrownlessCore: Core, CrownlessDiscovery: {}, CrownlessGeographyApi: GeographyApi };
  window.window = window;

  const context = {
    window,
    document,
    navigator,
    performance: { now: () => ++clock },
    requestAnimationFrame(callback) { callback(); return 1; },
    URL,
    console
  };
  vm.createContext(context);
  vm.runInContext(runtimeSource, context);
  return {
    context,
    document,
    Core,
    leadList,
    providerDeferred,
    get providerCalls() { return providerCalls; },
    get gpsCalls() { return gpsCalls; }
  };
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test("new expedition shows search DOM immediately and keeps simulated exploration usable", async () => {
  const harness = buildHarness();
  harness.Core.beginExpedition({}, Date.now());

  const search = harness.document.getElementById("location-discovery-search");
  assert.ok(search, "search presentation should be created at expedition start");
  assert.equal(search.hidden, false);
  assert.equal(harness.leadList.style.display, "");
  assert.equal(harness.leadList.getAttribute("aria-busy"), "true");

  await flush();
  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.diagnostics.gps, "ok");
  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "loading");
  assert.equal(search.hidden, false, "GPS completion alone must not end the search presentation");
  assert.equal(harness.providerCalls, 1);
});

test("search DOM stays visible through geography and hides only after ready", async () => {
  const harness = buildHarness();
  harness.Core.beginExpedition({}, Date.now());
  await flush();
  const search = harness.document.getElementById("location-discovery-search");
  assert.equal(search.hidden, false);

  harness.providerDeferred.resolve([{ title: "川沿いの痕跡", signal: "水音", risk: 1, palette: "water", contentKind: "event", features: ["water"], realPlaceName: "Test River" }]);
  await flush();

  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "ready");
  assert.equal(search.hidden, true);
  assert.equal(harness.leadList.getAttribute("aria-busy"), "false");
});

test("denied and failed discovery both end the loading presentation", async (t) => {
  await t.test("permission denied", async () => {
    const harness = buildHarness({ gps: "denied" });
    harness.Core.beginExpedition({}, Date.now());
    const search = harness.document.getElementById("location-discovery-search");
    assert.equal(search.hidden, false);
    await flush();
    assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "denied");
    assert.equal(search.hidden, true);
  });

  await t.test("provider failure", async () => {
    const harness = buildHarness({ providerMode: "reject" });
    harness.Core.beginExpedition({}, Date.now());
    const search = harness.document.getElementById("location-discovery-search");
    assert.equal(search.hidden, false);
    await flush();
    assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "failed");
    assert.equal(search.hidden, true);
  });
});

test("every new expedition re-enters the same location-discovery lifecycle", async () => {
  const harness = buildHarness({ providerMode: "resolved" });

  harness.Core.beginExpedition({}, 1);
  await flush();
  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "ready");
  assert.equal(harness.gpsCalls, 1);

  harness.Core.beginExpedition({}, 2);
  const search = harness.document.getElementById("location-discovery-search");
  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "loading");
  assert.equal(search.hidden, false);
  await flush();
  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "ready");
  assert.equal(harness.gpsCalls, 2);
  assert.equal(harness.providerCalls, 2);
});
