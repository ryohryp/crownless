const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const NpcLife = require("../src/npc-life.js");
const Signals = require("../src/world-atlas-npc-signals.js");
const DiscoveryActions = require("../src/discovery-actions.js");

const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-npc-signals.js"), "utf8");

test("traveling NPC is visible anonymously before a rumor and upgrades when the route rumor is available", () => {
  const hearth = Signals.travelingSignals(NpcLife, 8);
  const beforeRumor = Signals.travelingSignals(NpcLife, 9);
  const road = Signals.travelingSignals(NpcLife, 11);
  const market = Signals.travelingSignals(NpcLife, 15);

  assert.equal(hearth.length, 0);
  assert.equal(beforeRumor.length, 1);
  assert.equal(beforeRumor[0].residentId, "marco");
  assert.equal(beforeRumor[0].hasRumor, false);
  assert.equal(beforeRumor[0].signalSource, "npc-travel");
  assert.equal(beforeRumor[0].name, "旅人らしき気配");
  assert.equal(beforeRumor[0].shortName, "旅人");
  assert.equal(beforeRumor[0].stateLabel, "未確認 / 人の気配");
  assert.equal(beforeRumor[0].direction, "北寄り");
  assert.equal(beforeRumor[0].movementHint, "移動しているらしい");
  assert.doesNotMatch(JSON.stringify({
    name: beforeRumor[0].name,
    shortName: beforeRumor[0].shortName,
    distanceBand: beforeRumor[0].distanceBand,
    movementHint: beforeRumor[0].movementHint,
    stateLabel: beforeRumor[0].stateLabel
  }), /マルコ|行商人|北の街道|街道/);

  assert.equal(road.length, 1);
  assert.equal(road[0].residentId, "marco");
  assert.equal(road[0].hasRumor, true);
  assert.equal(road[0].signalSource, "npc-rumor");
  assert.equal(road[0].name, "マルコの気配");
  assert.equal(road[0].stateLabel, "未確認 / 噂の足取り");
  assert.equal(road[0].direction, "北寄り");
  assert.equal(road[0].x, 50);
  assert.equal(road[0].y, 19);
  assert.equal(road[0].movementHint, "街道を進んでいる");
  assert.equal(market.length, 0);
});

test("north-road traveler signal advances in coarse time bands without exposing an exact route", () => {
  const early = Signals.travelingSignals(NpcLife, 10)[0];
  const middle = Signals.travelingSignals(NpcLife, 11)[0];
  const late = Signals.travelingSignals(NpcLife, 13)[0];

  assert.deepEqual([early.x, early.y, early.direction, early.movementHint], [44, 28, "北寄り", "街道へ出たばかり"]);
  assert.deepEqual([middle.x, middle.y, middle.direction, middle.movementHint], [50, 19, "北寄り", "街道を進んでいる"]);
  assert.deepEqual([late.x, late.y, late.direction, late.movementHint], [56, 13, "北寄り", "さらに北へ進んだ気配"]);
  assert.notDeepEqual([early.x, early.y], [middle.x, middle.y]);
  assert.notDeepEqual([middle.x, middle.y], [late.x, late.y]);
});

test("roadside anomaly is a deterministic temporary signal and does not reveal the incident", () => {
  assert.equal(Signals.roadsideEventSignals(11).length, 0);
  const signal = Signals.roadsideEventSignals(12)[0];
  assert.ok(signal);
  assert.equal(signal.id, "event-signal:roadside-disturbance");
  assert.equal(signal.signalSource, "roadside-disturbance");
  assert.equal(signal.name, "街道の方から騒がしい気配");
  assert.equal(signal.stateLabel, "未確認 / 異変の気配");
  assert.equal(signal.direction, "北東寄り");
  assert.equal(Signals.roadsideEventSignals(14).length, 1);
  assert.equal(Signals.roadsideEventSignals(15).length, 0);
  assert.doesNotMatch(JSON.stringify(signal), /盗賊|襲撃|マルコ|latitude|longitude|coordinate|mapOrigin|locationLabel|north-road/);
});

test("anonymous traveler signal cannot match a known destination until the rumor is available", () => {
  const knownRoad = { key: "known-north-road", name: "北の街道・古い関所跡", location: NpcLife.LOCATIONS.ROAD, state: "discovered" };
  const safe = { worldKnowledge: { discoveries: { [knownRoad.key]: knownRoad } } };
  const root = { CrownlessCore: { loadSafeState: () => safe } };
  const anonymousSignal = Signals.travelingSignals(NpcLife, 9)[0];
  assert.equal(anonymousSignal.hasRumor, false);
  assert.equal(Signals.knownDestinationForSignal(root, NpcLife, anonymousSignal, 9), null);
});

test("traveler signal can be matched to an already-known reunion destination without creating discovery state", () => {
  const knownRoad = { key: "known-north-road", name: "北の街道・古い関所跡", location: NpcLife.LOCATIONS.ROAD, state: "discovered" };
  const safe = { worldKnowledge: { discoveries: { [knownRoad.key]: knownRoad } } };
  const before = JSON.stringify(safe);
  const root = { CrownlessCore: { loadSafeState: () => safe } };
  const signal = Signals.travelingSignals(NpcLife, 11)[0];
  const match = Signals.knownDestinationForSignal(root, NpcLife, signal, 11);
  assert.equal(match.candidate.targetId, "marco");
  assert.equal(match.candidate.discoveryKey, knownRoad.key);
  assert.equal(match.entry, knownRoad);
  assert.equal(JSON.stringify(safe), before);
});

test("traveler signal stays rumor-only when no known destination matches", () => {
  const root = { CrownlessCore: { loadSafeState: () => ({ worldKnowledge: { discoveries: {} } }) } };
  const signal = Signals.travelingSignals(NpcLife, 11)[0];
  assert.equal(Signals.knownDestinationForSignal(root, NpcLife, signal, 11), null);
});

test("known destination bridge reuses existing atlas detail, actions, and reunion presentations", () => {
  const calls = [];
  const root = {
    CrownlessWorldAtlasPreview: { syncSelection: (_document, _root, entry) => { calls.push(["preview", entry.key]); return true; } },
    CrownlessWorldAtlasActionsPresentation: { syncActions: (_document, _root, entry) => { calls.push(["actions", entry.key]); return true; } },
    CrownlessWorldAtlasReunionPresentation: { syncReunion: (_document, _root, entry) => { calls.push(["reunion", entry.key]); return true; } }
  };
  const match = { entry: { key: "known-north-road" } };
  assert.equal(Signals.openKnownDestination({}, root, match, 11), true);
  assert.deepEqual(calls, [["preview", "known-north-road"], ["actions", "known-north-road"], ["reunion", "known-north-road"]]);
});

test("matched traveler signal can enter the existing expedition preparation flow", () => {
  const signal = Signals.travelingSignals(NpcLife, 11)[0];
  const match = { entry: { key: "known-north-road" } };
  const calls = [];
  const document = {};
  const root = {
    CrownlessWorldAtlasActionsPresentation: {
      openExpedition: (passedDocument, passedRoot, entry, status) => {
        calls.push({ passedDocument, passedRoot, entry, status });
        return true;
      }
    }
  };

  assert.equal(Signals.openSignalExpedition(document, root, signal, match), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].passedDocument, document);
  assert.equal(calls[0].passedRoot, root);
  assert.equal(calls[0].entry, match.entry);
  assert.equal(calls[0].status, null);
});

test("anonymous or unmatched traveler signal cannot start an expedition", () => {
  let calls = 0;
  const root = {
    CrownlessWorldAtlasActionsPresentation: {
      openExpedition: () => { calls += 1; return true; }
    }
  };
  const anonymous = Signals.travelingSignals(NpcLife, 9)[0];
  const rumored = Signals.travelingSignals(NpcLife, 11)[0];

  assert.equal(Signals.openSignalExpedition({}, root, anonymous, { entry: { key: "known-north-road" } }), false);
  assert.equal(Signals.openSignalExpedition({}, root, rumored, null), false);
  assert.equal(calls, 0);
});

test("signal models never contain precise coordinates or persistence fields", () => {
  const signals = [Signals.travelingSignals(NpcLife, 9)[0], Signals.travelingSignals(NpcLife, 11)[0], Signals.roadsideEventSignals(12)[0]];
  for (const signal of signals) {
    const serialized = JSON.stringify(signal);
    assert.doesNotMatch(serialized, /latitude|longitude|coordinate|mapOrigin|locationLabel|north-road/);
  }
  assert.doesNotMatch(source, /localStorage|sessionStorage|saveWorldKnowledge|recordExploredCell/);
  assert.doesNotMatch(source, /SAVE_VERSION/);
});

test("presentation distinguishes NPC signals and an unidentified roadside anomaly without confirming discovery", () => {
  assert.match(source, /signalSource: hasRumor \? "npc-rumor" : "npc-travel"/);
  assert.match(source, /signalSource: "roadside-disturbance"/);
  assert.match(source, /dataset\.atlasSignalSource = signal\.signalSource/);
  assert.match(source, /旅人らしき気配/);
  assert.match(source, /街道の方から騒がしい気配/);
  assert.match(source, /正体はまだ分からない/);
  assert.match(source, /まだ確認済み地点ではない/);
  assert.match(source, /正確な位置や経路を示す印ではない/);
  assert.match(source, /既知の探索地点を開く/);
  assert.match(source, /この気配を追って遠征する/);
  assert.match(source, /world-atlas-nearby-marker--npc-signal/);
  assert.match(source, /world-atlas-nearby-marker--event-signal/);
});

test("atlas observer only refreshes when a nearby map is added", () => {
  assert.match(source, /records\.some\(addedNearbyMap\)/);
  assert.doesNotMatch(source, /MutationObserver\(\(\) => refresh\(\)\)/);
});

test("dynamic event templates provide at least 3 distinct event types with deterministic active windows", () => {
  const allEvents = Signals.dynamicEventSignals(null, { all: true });
  assert.equal(allEvents.length, 3);
  const sources = allEvents.map((e) => e.signalSource);
  assert.deepEqual(sources, ["roadside-disturbance", "bandit-ambush", "suspicious-campfire"]);

  // Roadside disturbance (12-14, expires at 15)
  assert.equal(Signals.dynamicEventSignals(11).length, 0);
  assert.equal(Signals.dynamicEventSignals(12)[0].signalSource, "roadside-disturbance");
  assert.equal(Signals.dynamicEventSignals(14)[0].signalSource, "roadside-disturbance");
  assert.equal(Signals.dynamicEventSignals(15)[0].signalSource, "bandit-ambush");

  // Bandit ambush (15-18, expires at 19)
  assert.equal(Signals.dynamicEventSignals(16)[0].signalSource, "bandit-ambush");
  assert.equal(Signals.dynamicEventSignals(18)[0].signalSource, "bandit-ambush");
  assert.equal(Signals.dynamicEventSignals(19)[0].signalSource, "suspicious-campfire");

  // Suspicious campfire (19-03, expires at 04)
  assert.equal(Signals.dynamicEventSignals(22)[0].signalSource, "suspicious-campfire");
  assert.equal(Signals.dynamicEventSignals(2)[0].signalSource, "suspicious-campfire");
  assert.equal(Signals.dynamicEventSignals(5).length, 0);
});

test("signals advance through sensed, discovered, and contact stages according to distance", () => {
  // Event: bandit ambush
  const far = Signals.banditAmbushSignals(16, { distance: 500 })[0];
  assert.equal(far.stage, "sensed");
  assert.equal(far.name, "街道の茂みから不穏な物音");
  assert.equal(far.stateLabel, "未確認 / 不穏な気配");

  const mid = Signals.banditAmbushSignals(16, { distance: 300 })[0];
  assert.equal(mid.stage, "discovered");
  assert.equal(mid.name, "街道を狙う盗賊の待ち伏せ");
  assert.equal(mid.stateLabel, "確認済み / 盗賊の潜伏");

  const near = Signals.banditAmbushSignals(16, { distance: 120 })[0];
  assert.equal(near.stage, "contact");
  assert.equal(near.name, "街道の盗賊団");
  assert.equal(near.stateLabel, "接触可能 / 盗賊と対峙");

  // NPC: Marco
  const marcoNear = Signals.travelingSignals(NpcLife, 11, { distance: 100 })[0];
  assert.equal(marcoNear.stage, "contact");
  assert.equal(marcoNear.name, "マルコ");
  assert.equal(marcoNear.stateLabel, "接触可能 / 足を止めている");
});

test("direct contact actions are provided when stage is contact", () => {
  function el(tagName) {
    const children = [];
    const listeners = {};
    return {
      tagName: String(tagName).toUpperCase(),
      className: "",
      textContent: "",
      children,
      appendChild(c) { children.push(c); return c; },
      append(...nodes) { nodes.forEach((n) => children.push(n)); },
      addEventListener(evt, fn) { listeners[evt] = fn; },
      click() { if (listeners.click) listeners.click(); },
      querySelector(selector) {
        if (selector.startsWith(".")) {
          const cls = selector.slice(1);
          if (this.className && this.className.includes(cls)) return this;
          for (const c of children) {
            const found = c.querySelector(selector);
            if (found) return found;
          }
        }
        return null;
      }
    };
  }
  const doc = {
    createElement: el,
    createDocumentFragment: () => el("div")
  };

  const contactSignal = Signals.banditAmbushSignals(16, { distance: 100 })[0];
  let contactTriggered = false;
  const fragment = Signals.selectedSignalDetail(doc, contactSignal, null, null, null, null, () => {
    contactTriggered = true;
  });

  const btn = fragment.querySelector(".world-atlas-npc-signal-contact__btn");
  assert.ok(btn, "expected contact button");
  assert.equal(btn.textContent, "その場で盗賊を撃退する");
  btn.click();
  assert.equal(contactTriggered, true);
});

test("resolved dynamic events are excluded from active signals", () => {
  const safe = {
    worldKnowledge: {
      discoveries: {
        "geo:signal:roadside-disturbance": { key: "geo:signal:roadside-disturbance", resolved: true }
      }
    }
  };
  const root = { CrownlessCore: { loadSafeState: () => safe } };
  const signals = Signals.dynamicEventSignals(12, {}, root);
  assert.equal(signals.length, 0);
});




test("Phase 2 next actions keep one transient lead beside one stable-place decision", () => {
  const dungeon = { key: "geo:test-fort:dungeon:woods", name: "森の古砦", state: "discovered", contentKind: "dungeon", terrain: ["woods"] };
  const event = { key: "geo:test-village:event:settlement", name: "空鐘の廃村", state: "discovered", contentKind: "event", terrain: ["settlement"] };
  const stable = [
    Signals.stableOpportunity(dungeon, DiscoveryActions),
    Signals.stableOpportunity(event, DiscoveryActions)
  ];
  const transient = [Signals.signalOpportunity(Signals.banditAmbushSignals(16)[0], "event")];
  const choices = Signals.chooseNextActionOpportunities(transient, stable, 2);

  assert.equal(choices.length, 2);
  assert.deepEqual(choices.map((choice) => choice.source), ["signal", "place"]);
  assert.match(choices[0].title, /気配を追う|異変を確かめる/);
  assert.match(choices[1].title, /遠征隊を送る/);
  assert.match(choices[1].title, /森の古砦/);
  assert.doesNotMatch(JSON.stringify(choices), /latitude|longitude|coordinate|mapOrigin|representativeCoordinate/);
});

test("Phase 2 next actions still expose two decisions when no transient signal is active", () => {
  const dungeon = { key: "geo:test-fort:dungeon:woods", name: "森の古砦", state: "discovered", contentKind: "dungeon", terrain: ["woods"] };
  const event = { key: "geo:test-village:event:settlement", name: "空鐘の廃村", state: "discovered", contentKind: "event", terrain: ["settlement"] };
  const stable = [
    Signals.stableOpportunity(dungeon, DiscoveryActions),
    Signals.stableOpportunity(event, DiscoveryActions)
  ];
  const choices = Signals.chooseNextActionOpportunities([], stable, 2);

  assert.equal(choices.length, 2);
  assert.deepEqual(choices.map((choice) => choice.source), ["place", "place"]);
  assert.match(choices[0].title, /遠征隊を送る/);
  assert.match(choices[1].title, /この地の事件を調べる/);
});

test("Phase 2 presentation renders at most two manuscript-level next-action shortcuts", () => {
  assert.match(source, /className = "world-atlas-next-actions"/);
  assert.match(source, /className = "world-atlas-next-action"/);
  assert.match(source, /dataset\.nextActionSource = choice\.source/);
  assert.match(source, /chooseNextActionOpportunities\(transientRecords, stableRecords, 2\)/);
  assert.match(source, /choice\.marker\.click\(\)/);
});
