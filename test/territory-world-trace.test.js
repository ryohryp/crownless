const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TerritoryTrace = require("../src/territory-world-trace.js");
const source = fs.readFileSync(path.join(__dirname, "../src/territory-world-trace.js"), "utf8");

function fakeElement(tagName) {
  const children = [];
  const listeners = new Map();
  return {
    tagName: String(tagName || "div").toUpperCase(),
    className: "",
    textContent: "",
    type: "",
    hidden: false,
    dataset: {},
    children,
    appendChild(child) { children.push(child); return child; },
    append(...nodes) { nodes.forEach((node) => children.push(node)); },
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    click() { (listeners.get("click") || []).forEach((handler) => handler({ target: this })); },
    querySelector(selector) {
      if (String(selector).includes(":not(")) return null;
      if (selector && selector.startsWith(".")) {
        const wanted = selector.slice(1);
        const own = String(this.className || "").split(/\s+/).filter(Boolean);
        if (own.includes(wanted)) return this;
      }
      for (const child of children) {
        if (child && typeof child.querySelector === "function") {
          const found = child.querySelector(selector);
          if (found) return found;
        }
      }
      return null;
    }
  };
}

function fakeDocument() {
  return { createElement: fakeElement };
}

function territoryModels() {
  return [
    { key: "geo:fort", role: "foothold", owner: "player", scouted: true, entry: { name: "丘の物見台" } },
    { key: "geo:route", role: "route", owner: "npc", scouted: true, entry: { name: "街道の露店" } },
    { key: "geo:resource", role: "resource", owner: "npc", scouted: false, entry: { name: "森の古砦" } }
  ];
}

function rootFor(role) {
  return {
    CrownlessTerritoryRewardSurface: {
      loadState: () => ({ developments: role ? { "geo:fort": role } : {} }),
      developmentFor: (state, key) => state.developments[key] || null,
      nextMeaningfulTarget: (models) => models.find((item) => item.owner !== "player") || null,
      supplyEffect: () => ({ combinedPercent: 55 })
    }
  };
}

function operationRoot(role = "supply") {
  const models = territoryModels();
  return {
    CrownlessTerritoryPhase1: {
      territories: () => models,
      discoveryKeyFromDestinationId: (id) => String(id || "").replace(/^world:/, ""),
      dangerTags: () => ["街道荒らし", "待ち伏せ"]
    },
    CrownlessTerritoryRewardSurface: {
      DEVELOPMENT_META: {
        scout: { label: "斥候所" },
        supply: { label: "補給所" }
      },
      loadState: () => ({ developments: role ? { "geo:fort": role } : {} }),
      developmentFor: (state, key) => state.developments[key] || null,
      representativeTerritory: () => models[0],
      nextMeaningfulTarget: () => models[1],
      supplyEffect: () => ({ combinedPercent: 55 })
    },
    CrownlessExpeditionSystem: {
      policies: { standard: { name: "通常" } }
    }
  };
}

function operationState() {
  return {
    activeExpedition: {
      inputs: {
        destinationId: "world:geo:route",
        companionIds: ["ed"],
        equipmentIds: ["old-knife", "shortbow"],
        policyId: "standard"
      },
      expectedReturnAt: Date.UTC(2026, 8, 7, 12, 34)
    },
    destinations: [{ id: "world:geo:route", name: "街道の露店" }],
    companions: [{ id: "ed", name: "エド", traits: ["strong", "brave"] }],
    equipment: [
      { id: "old-knife", name: "古い短刀", tags: ["cut"] },
      { id: "shortbow", name: "狩り弓", tags: ["ranged"] }
    ]
  };
}

test("scout and supply territory roles create different player-discoverable World Traces", () => {
  const scout = TerritoryTrace.traceForRole("scout", { targetName: "街道の露店" });
  const supply = TerritoryTrace.traceForRole("supply", { targetName: "街道の露店", combinedPercent: 55 });

  assert.equal(scout.kind, "scout-mark");
  assert.match(scout.heading, /斥候印/);
  assert.match(scout.investigatedCopy, /街道の露店.*危険と備え/);
  assert.equal(supply.kind, "supply-ruts");
  assert.match(supply.heading, /荷車の轍/);
  assert.match(supply.investigatedCopy, /街道の露店.*通常比約55%/);
  assert.notEqual(scout.id, supply.id);
});

test("territory trace exists only for a controlled representative foothold with a chosen role", () => {
  const models = territoryModels();
  const supply = TerritoryTrace.traceForTerritory(rootFor("supply"), models[0], models);
  assert.ok(supply);
  assert.equal(supply.role, "supply");

  assert.equal(TerritoryTrace.traceForTerritory(rootFor(null), models[0], models), null);
  assert.equal(TerritoryTrace.traceForTerritory(rootFor("scout"), { ...models[0], owner: "npc" }, models), null);
  assert.equal(TerritoryTrace.traceForTerritory(rootFor("scout"), models[1], models), null);
});

test("territory World Trace is interactive but does not create a second progression system", () => {
  const document = fakeDocument();
  const detail = fakeElement("div");
  const trace = TerritoryTrace.traceForRole("supply", { targetName: "街道の露店", combinedPercent: 55 });

  assert.equal(TerritoryTrace.appendTerritoryTracePanel(document, detail, trace), true);
  const panel = detail.querySelector(".world-trace-investigation--territory");
  const inspect = detail.querySelector(".world-trace-investigation__territory-inspect");
  assert.ok(panel);
  assert.ok(inspect);
  assert.equal(panel.dataset.traceState, "visible");

  inspect.click();
  assert.equal(panel.dataset.traceState, "investigated");
  assert.equal(inspect.hidden, true);
  assert.match(panel.children.map((child) => child.textContent).join(" "), /補給路が前線へ伸びている/);
  assert.match(panel.children.map((child) => child.textContent).join(" "), /通常比約55%/);
});

test("active Territory expedition exposes the immutable operation choices while it runs", () => {
  const model = TerritoryTrace.operationModel(operationRoot("supply"), operationState());
  assert.ok(model);
  assert.equal(model.destinationName, "街道の露店");
  assert.equal(model.policyName, "通常");
  assert.deepEqual(model.companionNames, ["エド"]);
  assert.deepEqual(model.equipmentNames, ["古い短刀", "狩り弓"]);
  assert.equal(model.scouted, true);
  assert.deepEqual(model.intel, ["街道荒らし", "待ち伏せ"]);
  assert.equal(model.development.label, "補給所");
  assert.match(model.development.copy, /通常比約55%短縮/);
});

test("causal Report summarizes only effects grounded in territory state and resolver causes", () => {
  const state = operationState();
  state.activeExpedition = null;
  const report = {
    territoryOutcome: { controlled: true },
    destinationId: "world:geo:route",
    companionIds: ["ed"],
    dispatchSummary: { equipment: ["狩り弓"] },
    log: [
      { type: "combat-tactic", text: "狩り弓の初撃で1体を崩した。残り2体。", causes: ["ranged"] }
    ],
    combat: { encounters: [{ causes: ["strong", "brave", "ranged"] }] }
  };

  const effects = TerritoryTrace.reportCausalEffects(operationRoot("supply"), report, state);
  assert.equal(effects.length, 3);
  assert.match(effects[0], /補給所.*通常比約55%短縮/);
  assert.match(effects[1], /狩り弓.*初撃/);
  assert.match(effects[2], /エド.*力強さ.*勇気.*攻防/);
});

test("Phase C + operation glue stays bounded: no idle economy, new timer engine, levels, or GPS", () => {
  assert.match(source, /CrownlessWorldTraces/);
  assert.match(source, /world-trace-investigation--territory/);
  assert.match(source, /WORLD TRACE \/ 支配地の気配/);
  assert.match(source, /OPERATION \/ 作戦実行中/);
  assert.match(source, /CAUSAL REPORT \/ 判断が効いた点/);
  assert.doesNotMatch(source, /buildingLevel|upgradeTimer|productionQueue|offlineGold|offlineXp|stamina|energy|dailyReward|navigator\.geolocation|watchPosition|latitude|longitude/i);
});