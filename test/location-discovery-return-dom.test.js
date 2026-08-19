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
  toggle(name, force) {
    const set = this._set();
    const enabled = force === undefined ? !set.has(name) : Boolean(force);
    if (enabled) set.add(name); else set.delete(name);
    this._write(set);
    return enabled;
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
    this.parentNode._insert(node, index + (position === "beforebegin" ? 0 : 1));
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
      if (selector.includes(" ")) return false;
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
  constructor() { this.body = new FakeElement("body", this); }
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

function createLeadCard(document) {
  const card = document.createElement("article");
  card.className = "lead-card palette-road";
  const title = document.createElement("h3");
  title.textContent = "通常の探索先";
  const description = document.createElement("p");
  description.textContent = "通常の手がかり";
  const omen = document.createElement("div");
  omen.className = "lead-omen";
  card.append(title, description, omen);
  return { card, title, description, omen };
}

function buildHarness() {
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

  let gpsCalls = 0;
  let providerCalls = 0;
  let clock = 0;
  const Core = {
    discoverLocation(state) { return state; },
    beginExpedition(state) { return { ...state, expedition: { started: true } }; },
    continueExpedition(state) { return { ...state, expedition: { ...(state.expedition || {}), continued: true } }; }
  };
  const GeographyApi = {
    DEFAULT_PROXY_ENDPOINT: "/api/geography",
    createProxyLocationDiscoveryProvider() {
      providerCalls += 1;
      return {
        endpoint: "/api/geography",
        discover() {
          return Promise.resolve([{ title: "川沿いの痕跡", signal: "水音", risk: 2, palette: "water", contentKind: "event", features: ["water"], realPlaceName: "Test River" }]);
        }
      };
    }
  };
  const navigator = {
    geolocation: {
      getCurrentPosition(success) {
        gpsCalls += 1;
        success({ coords: { latitude: 35, longitude: 139 } });
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
    Core,
    document,
    leadList,
    get gpsCalls() { return gpsCalls; },
    get providerCalls() { return providerCalls; }
  };
}

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test("continuing an expedition reapplies cached geographic discoveries after explore DOM is rebuilt", async () => {
  const harness = buildHarness();
  harness.Core.beginExpedition({}, 1);
  await flush();

  assert.equal(harness.context.window.CrownlessLocationDiscoveryRuntime.state, "ready");
  assert.equal(harness.gpsCalls, 1);
  assert.equal(harness.providerCalls, 1);

  harness.Core.continueExpedition({ expedition: { started: true } });

  // app.js synchronously calls renderExplore() after Core.continueExpedition(),
  // replacing the exploration cards. Simulate that DOM rebuild before microtasks run.
  harness.leadList.children = [];
  const rebuilt = createLeadCard(harness.document);
  harness.leadList.append(rebuilt.card);
  await flush();

  assert.equal(rebuilt.card.dataset.discoverySource, "geographic");
  assert.equal(rebuilt.title.textContent, "川沿いの痕跡");
  assert.equal(rebuilt.description.textContent, "水音");
  assert.equal(rebuilt.omen.textContent, "地形：水辺");
  assert.equal(harness.gpsCalls, 1, "continuing must reuse cached GPS results");
  assert.equal(harness.providerCalls, 1, "continuing must not call the geography provider again");
});
