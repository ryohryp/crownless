const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");
const Encounter = require("../src/npc-reunion-encounter.js");
const NpcInteraction = require("../src/npc-interaction.js");
const Presentation = require("../src/world-atlas-reunion-presentation.js");

class FakeElement {
  constructor(tagName, documentRef) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = documentRef;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.id = "";
    this.className = "";
    this._textContent = "";
    this._listeners = {};
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((c) => (typeof c === "string" ? c : c.textContent)).join("");
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val);
  }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const type = typeof event === "string" ? event : event.type;
    const handlers = this._listeners[type] || [];
    handlers.forEach((h) => h({ target: this, type, preventDefault() {}, stopPropagation() {} }));
  }

  click() {
    this.dispatchEvent("click");
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  append(...nodes) {
    nodes.forEach((node) => this._insert(node, this.children.length));
  }

  appendChild(node) {
    this._insert(node, this.children.length);
    return node;
  }

  insertBefore(node, reference) {
    const index = reference ? this.children.indexOf(reference) : -1;
    this._insert(node, index >= 0 ? index : this.children.length);
    return node;
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx >= 0) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }

  replaceChildren(...nodes) {
    this.children.forEach((c) => { if (c && typeof c === "object") c.parentNode = null; });
    this.children = [];
    this._textContent = "";
    nodes.forEach((node) => this._insert(node, this.children.length));
  }

  _insert(node, index) {
    if (!node) return;
    if (typeof node === "string") {
      const textNode = new FakeElement("span", this.ownerDocument);
      textNode.textContent = node;
      node = textNode;
    }
    if (node.parentNode) node.remove();
    node.parentNode = this;
    this.children.splice(index, 0, node);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  _findDirectDescendants(step) {
    const results = [];
    const match = (el) => {
      if (typeof el !== "object" || !el.tagName) return false;
      if (step === "*") return true;
      if (step.toLowerCase() === "button") return el.tagName === "BUTTON";
      if (step.toLowerCase() === "select") return el.tagName === "SELECT";
      if (step.startsWith(".")) {
        const cls = step.slice(1);
        return (el.className || "").split(/\s+/).includes(cls);
      }
      if (step.startsWith("#")) return el.id === step.slice(1);
      if (step.startsWith("[") && step.endsWith("]")) {
        const inner = step.slice(1, -1);
        if (inner.includes("=")) {
          const [key, rawVal] = inner.split("=");
          const val = rawVal.replace(/^["']|["']$/g, "");
          const datasetKey = key.replace(/^data-/, "");
          return el.getAttribute(key) === val || el.dataset[datasetKey] === val;
        }
        const datasetKey = inner.replace(/^data-/, "");
        return inner in el.attributes || datasetKey in el.dataset;
      }
      return el.tagName.toLowerCase() === step.toLowerCase();
    };

    const visit = (el) => {
      el.children.forEach((child) => {
        if (typeof child === "object") {
          if (match(child)) results.push(child);
          visit(child);
        }
      });
    };
    visit(this);
    return results;
  }

  querySelectorAll(selector) {
    const raw = String(selector || "").trim();
    if (raw.includes(",")) {
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const set = new Set();
      parts.forEach((p) => { this.querySelectorAll(p).forEach((el) => set.add(el)); });
      return [...set];
    }
    if (raw.includes(" ")) {
      const chain = raw.split(/\s+/).filter(Boolean);
      let current = [this];
      for (const step of chain) {
        const next = [];
        for (const ancestor of current) {
          next.push(...ancestor._findDirectDescendants(step));
        }
        current = next;
      }
      return current;
    }
    return this._findDirectDescendants(raw);
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement("body", this);
    this.head = new FakeElement("head", this);
    this.documentElement = new FakeElement("html", this);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

const knownDestinations = {
  "sim:north-road-ford": {
    key: "sim:north-road-ford",
    name: "北の街道の古い渡し場",
    location: "north-road",
    state: "discovered"
  }
};

function setupEnvironment() {
  const doc = new FakeDocument();

  const folioContent = doc.createElement("div");
  folioContent.id = "expedition-folio-content";

  const summary = doc.createElement("section");
  summary.setAttribute("data-expedition-summary", "");
  folioContent.appendChild(summary);

  doc.body.appendChild(folioContent);

  const report = {
    expeditionId: "exp-test-reunion-1",
    destinationId: "world:sim:north-road-ford",
    destinationName: "北の街道の古い渡し場",
    completedAt: new Date(2026, 8, 1, 11, 0, 0).getTime()
  };

  const safe = {
    worldKnowledge: {
      discoveries: { ...knownDestinations }
    },
    npcLife: { reunions: {} }
  };

  const expeditionState = {
    destinations: [
      {
        id: "world:sim:north-road-ford",
        name: "北の街道の古い渡し場",
        discoveryKey: "sim:north-road-ford"
      }
    ],
    completedReports: [report]
  };

  const root = {
    CrownlessCore: {
      loadSafeState() { return safe; },
      saveSafeState() { return true; }
    },
    CrownlessNpcLife: NpcLife,
    CrownlessNpcReunionEncounter: Encounter,
    CrownlessNpcInteraction: NpcInteraction,
    CrownlessExpeditionSystem: {
      normalizeState(input) { return input || expeditionState; }
    },
    localStorage: {
      getItem(key) { return JSON.stringify(expeditionState); }
    }
  };

  return { doc, root, report, safe, expeditionState, summary };
}

test("expedition report reunion renders interaction UI with 3 actions", () => {
  const { doc, root, report } = setupEnvironment();

  const rendered = Presentation.syncExpeditionReunion(doc, root);
  assert.equal(rendered, true);

  const note = doc.querySelector(".expedition-reunion-note");
  assert.ok(note);
  assert.equal(note.dataset.expeditionId, report.expeditionId);
  assert.equal(note.dataset.npcId, "marco");

  const buttons = note.querySelectorAll(".npc-interaction-btn");
  assert.equal(buttons.length, 3);
  assert.deepEqual(buttons.map((b) => b.dataset.action), ["talk", "ask-info", "part"]);
  assert.deepEqual(buttons.map((b) => b.textContent), ["話す", "情報を聞く", "別れる"]);
});

test("clicking talk displays NPC conversation line in dialogue area", () => {
  const { doc, root } = setupEnvironment();
  Presentation.syncExpeditionReunion(doc, root);

  const note = doc.querySelector(".expedition-reunion-note");
  const talkBtn = note.querySelector('[data-action="talk"]');
  talkBtn.click();

  const dialogue = note.querySelector(".npc-interaction-dialogue");
  assert.ok(dialogue);
  assert.match(dialogue.textContent, /マルコ/);
  assert.match(dialogue.textContent, /街道|荷/);
});

test("clicking ask-info displays intelligence/rumor without creating new discoveries", () => {
  const { doc, root, safe } = setupEnvironment();
  Presentation.syncExpeditionReunion(doc, root);

  const initialKeys = Object.keys(safe.worldKnowledge.discoveries);

  const note = doc.querySelector(".expedition-reunion-note");
  const infoBtn = note.querySelector('[data-action="ask-info"]');
  infoBtn.click();

  const dialogue = note.querySelector(".npc-interaction-dialogue");
  assert.ok(dialogue);
  assert.match(dialogue.textContent, /情報/);
  assert.match(dialogue.textContent, /渡し場|街道|浅瀬|物音/);

  // Discoveries remain unchanged
  assert.deepEqual(Object.keys(safe.worldKnowledge.discoveries), initialKeys);
});

test("clicking part concludes the interaction and disables buttons", () => {
  const { doc, root } = setupEnvironment();
  Presentation.syncExpeditionReunion(doc, root);

  const note = doc.querySelector(".expedition-reunion-note");
  const partBtn = note.querySelector('[data-action="part"]');
  partBtn.click();

  const dialogue = note.querySelector(".npc-interaction-dialogue");
  assert.ok(dialogue);
  assert.match(dialogue.textContent, /気をつけて/);

  const finished = note.querySelector(".npc-interaction-finished");
  assert.ok(finished);
  assert.match(finished.textContent, /会話を終えた/);

  const buttons = note.querySelectorAll(".npc-interaction-btn");
  buttons.forEach((b) => assert.equal(b.disabled, true));
});

test("syncExpeditionReunion is idempotent and does not recreate DOM on redraw", () => {
  const { doc, root } = setupEnvironment();
  Presentation.syncExpeditionReunion(doc, root);

  const note = doc.querySelector(".expedition-reunion-note");
  const talkBtn = note.querySelector('[data-action="talk"]');
  talkBtn.click();

  const dialogueFirst = note.querySelector(".npc-interaction-dialogue");
  assert.ok(dialogueFirst);

  // Re-sync with the same state
  const reSync = Presentation.syncExpeditionReunion(doc, root);
  assert.equal(reSync, true);

  // Existing note and active dialogue remain intact without reset
  const noteSecond = doc.querySelector(".expedition-reunion-note");
  assert.equal(note, noteSecond);
  const dialogueSecond = noteSecond.querySelector(".npc-interaction-dialogue");
  assert.equal(dialogueFirst, dialogueSecond);
});

test("World Atlas candidate view does not expose interaction buttons", () => {
  const { doc, root } = setupEnvironment();

  const viewer = doc.createElement("div");
  viewer.id = "world-atlas-viewer";
  const detail = doc.createElement("div");
  detail.className = "world-atlas-detail";
  viewer.appendChild(detail);
  doc.body.appendChild(viewer);

  const entry = knownDestinations["sim:north-road-ford"];
  const rendered = Presentation.syncReunion(doc, root, entry, new Date(2026, 8, 1, 11, 0, 0));
  assert.equal(rendered, true);

  const atlasNote = detail.querySelector(".world-atlas-reunion-note");
  assert.ok(atlasNote);
  assert.match(atlasNote.textContent, /再会候補/);

  // MUST NOT render interaction buttons in Atlas preview
  const interactionBtns = atlasNote.querySelectorAll(".npc-interaction-btn");
  assert.equal(interactionBtns.length, 0);
  assert.equal(atlasNote.querySelector(".npc-interaction-panel"), null);
});

test("interaction elements and attributes never contain coordinates or GPS values", () => {
  const { doc, root } = setupEnvironment();
  Presentation.syncExpeditionReunion(doc, root);

  const note = doc.querySelector(".expedition-reunion-note");
  assert.equal("latitude" in note.dataset, false);
  assert.equal("longitude" in note.dataset, false);
  assert.equal("coordinates" in note.dataset, false);

  const talkBtn = note.querySelector('[data-action="talk"]');
  talkBtn.click();

  const allElements = note.querySelectorAll("*");
  allElements.forEach((el) => {
    assert.equal("latitude" in el.dataset, false);
    assert.equal("longitude" in el.dataset, false);
    assert.equal("coordinates" in el.dataset, false);
  });
});
