from pathlib import Path

signals_path = Path("src/world-atlas-npc-signals.js")
text = signals_path.read_text()
if "function renderNextActions(" in text:
    raise SystemExit("Phase 2 next-action code already exists")

anchor = '''  function inject(document, root, input = new Date(), options = {}) {'''
helpers = r'''  function preferredStableAction(entry, actionsApi) {
    if (!entry || !actionsApi || typeof actionsApi.buildDiscoveryActions !== "function") return null;
    const actions = actionsApi.buildDiscoveryActions(entry);
    if (!Array.isArray(actions) || !actions.length) return null;
    const contentKind = cleanText(entry.contentKind, "unknown");
    const priority = contentKind === "event" || contentKind === "encounter"
      ? ["event", "expedition", "facility"]
      : contentKind === "facility"
        ? ["facility", "event", "expedition"]
        : ["expedition", "event", "facility"];
    return priority.map((kind) => actions.find((action) => action && action.kind === kind)).find(Boolean) || actions[0];
  }

  function stableOpportunity(entry, actionsApi) {
    const action = preferredStableAction(entry, actionsApi);
    if (!action) return null;
    const name = cleanText(entry && entry.name, "発見地点");
    const key = cleanText(entry && entry.key, name);
    return Object.freeze({
      id: `place:${key}:${cleanText(action.kind, "action")}`,
      source: "place",
      actionKind: cleanText(action.kind, "action"),
      title: `${cleanText(action.label, "地点を調べる")} · ${name}`,
      note: cleanText(action.note, "探索録に残した地点を開く。"),
      discoveryKey: cleanText(entry && entry.key)
    });
  }

  function signalOpportunity(signal, kind = "event") {
    if (!signal) return null;
    const signalKind = kind === "npc" ? "npc" : "event";
    const stage = cleanText(signal.stage, "sensed");
    let verb = "気配を追う";
    if (stage === "contact") verb = signalKind === "npc" ? "声をかける" : "現地で対処する";
    else if (signalKind === "npc") verb = signal.hasRumor ? "足取りを追う" : "人影を確かめる";
    else if (stage === "discovered") verb = "異変を確かめる";
    const target = cleanText(signal.shortName, cleanText(signal.name, "気配"));
    return Object.freeze({
      id: cleanText(signal.id, `signal:${cleanText(signal.signalSource, target)}`),
      source: "signal",
      signalKind,
      signalSource: cleanText(signal.signalSource),
      title: `${verb} · ${target}`,
      note: `${cleanText(signal.direction, "方角不明")} · ${cleanText(signal.distanceBand, "少し先の気配")}`
    });
  }

  function chooseNextActionOpportunities(signalOptions, stableOptions, limit = 2) {
    const cap = Math.max(1, Number(limit) || 2);
    const signals = (Array.isArray(signalOptions) ? signalOptions : []).filter(Boolean);
    const stable = (Array.isArray(stableOptions) ? stableOptions : []).filter(Boolean);
    const chosen = [];
    if (signals.length && stable.length) {
      chosen.push(signals[0], stable[0]);
    } else {
      chosen.push(...signals.slice(0, cap), ...stable.slice(0, cap));
    }
    if (chosen.length < cap) {
      [...signals.slice(1), ...stable.slice(1)].forEach((option) => {
        if (chosen.length < cap && !chosen.includes(option)) chosen.push(option);
      });
    }
    return chosen.slice(0, cap);
  }

  function entryForStableMarker(root, marker) {
    const preview = root && root.CrownlessWorldAtlasPreview;
    if (preview && typeof preview.entryForTarget === "function") {
      const entry = preview.entryForTarget(root, marker);
      if (entry) return entry;
    }
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;
    const aria = cleanText(marker && marker.getAttribute && marker.getAttribute("aria-label"));
    const name = cleanText(aria.split("。")[0]);
    return Object.values(discoveries).find((entry) => cleanText(entry && entry.name) === name) || null;
  }

  function signalRecordPriority(record) {
    if (!record || !record.signal) return 0;
    if (record.signal.stage === "contact") return 4;
    if (record.kind === "event") return 3;
    if (record.signal.hasRumor) return 2;
    return 1;
  }

  function renderNextActions(document, root, map, signalRecords = []) {
    if (!document || !map) return 0;
    map.querySelector(".world-atlas-next-actions")?.remove();
    const actionsApi = root && root.CrownlessDiscoveryActions;
    const stableRecords = Array.from(map.querySelectorAll(".world-atlas-nearby-marker:not(.world-atlas-nearby-marker--npc-signal):not(.world-atlas-nearby-marker--event-signal)"))
      .map((marker) => {
        const entry = entryForStableMarker(root, marker);
        const opportunity = stableOpportunity(entry, actionsApi);
        return opportunity ? { ...opportunity, marker } : null;
      })
      .filter(Boolean);
    const transientRecords = (Array.isArray(signalRecords) ? signalRecords : [])
      .slice()
      .sort((a, b) => signalRecordPriority(b) - signalRecordPriority(a))
      .map((record) => {
        const opportunity = signalOpportunity(record.signal, record.kind);
        return opportunity ? { ...opportunity, marker: record.marker } : null;
      })
      .filter(Boolean);
    const choices = chooseNextActionOpportunities(transientRecords, stableRecords, 2);
    if (!choices.length) return 0;

    const panel = document.createElement("section");
    panel.className = "world-atlas-next-actions";
    panel.setAttribute("aria-label", "次にやること");
    const kicker = document.createElement("small");
    kicker.textContent = "NEXT MOVES / 次にやること";
    const list = document.createElement("div");
    list.className = "world-atlas-next-actions__list";
    choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-atlas-next-action";
      button.dataset.nextActionSource = choice.source;
      if (choice.actionKind) button.dataset.nextActionKind = choice.actionKind;
      if (choice.signalSource) button.dataset.atlasSignalSource = choice.signalSource;
      button.setAttribute("aria-label", `${choice.title}。${choice.note}`);
      const title = document.createElement("strong");
      title.textContent = choice.title;
      const note = document.createElement("span");
      note.textContent = choice.note;
      button.append(title, note);
      button.addEventListener("click", () => {
        if (choice.marker && typeof choice.marker.click === "function") choice.marker.click();
      });
      list.appendChild(button);
    });
    panel.append(kicker, list);
    map.appendChild(panel);
    return choices.length;
  }

'''
if text.count(anchor) != 1:
    raise SystemExit("inject anchor not found exactly once")
text = text.replace(anchor, helpers + anchor, 1)

old = '''    if (!signals.length) return 0;

    signals.forEach(({ signal, kind }, index) => {'''
new = '''    const signalRecords = [];

    signals.forEach(({ signal, kind }, index) => {'''
if text.count(old) != 1:
    raise SystemExit("signal early-return anchor not found exactly once")
text = text.replace(old, new, 1)

old = '''      map.appendChild(marker);
    });
    return signals.length;'''
new = '''      map.appendChild(marker);
      signalRecords.push({ signal, kind, marker });
    });
    renderNextActions(document, root, map, signalRecords);
    return signals.length;'''
if text.count(old) != 1:
    raise SystemExit("signal append anchor not found exactly once")
text = text.replace(old, new, 1)

old = '''    selectedSignalDetail,
    inject,'''
new = '''    selectedSignalDetail,
    preferredStableAction,
    stableOpportunity,
    signalOpportunity,
    chooseNextActionOpportunities,
    entryForStableMarker,
    renderNextActions,
    inject,'''
if text.count(old) != 1:
    raise SystemExit("exports anchor not found exactly once")
text = text.replace(old, new, 1)
signals_path.write_text(text)

css_path = Path("world-atlas.css")
css = css_path.read_text()
if ".world-atlas-next-actions" in css:
    raise SystemExit("next-action CSS already exists")
css += r'''

/* #361 Phase 2: keep two concrete next moves visible on the manuscript itself. */
.world-atlas-next-actions { position:absolute; z-index:18; left:10px; right:10px; bottom:10px; display:grid; grid-template-columns:auto minmax(0,1fr); align-items:end; gap:9px; padding:7px 8px; border-top:1px solid rgba(201,163,93,.24); background:linear-gradient(90deg,rgba(13,12,9,.94),rgba(13,12,9,.76) 72%,rgba(13,12,9,.58)); box-shadow:0 -8px 24px rgba(0,0,0,.16); }
.world-atlas-next-actions > small { align-self:center; max-width:82px; color:#9b8c68; font-size:7px; line-height:1.35; letter-spacing:.09em; }
.world-atlas-next-actions__list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; min-width:0; }
.world-atlas-next-action { min-width:0; min-height:44px; padding:7px 9px; border:0; border-left:1px solid rgba(201,163,93,.30); background:rgba(224,207,171,.035); color:#d9caa5; text-align:left; cursor:pointer; }
.world-atlas-next-action strong,.world-atlas-next-action span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.world-atlas-next-action strong { color:#e5d5ae; font:600 10px/1.3 Georgia,serif; }
.world-atlas-next-action span { margin-top:3px; color:#8f927f; font-size:8px; line-height:1.35; }
.world-atlas-next-action[data-next-action-source="signal"] { border-left-color:rgba(132,157,139,.58); background:rgba(72,105,89,.09); }
.world-atlas-next-action:hover,.world-atlas-next-action:focus-visible { background:rgba(201,163,93,.09); }

@media (max-width:700px), (max-width:1000px) and (max-height:500px) {
  .world-atlas-next-actions { left:6px; right:6px; bottom:6px; grid-template-columns:1fr; gap:4px; padding:5px 6px; }
  .world-atlas-next-actions > small { max-width:none; font-size:6px; }
  .world-atlas-next-action { padding:6px 7px; }
  .world-atlas-next-action strong { font-size:9px; }
  .world-atlas-next-action span { font-size:7px; }
}
@media (max-height:500px) {
  .world-atlas-next-actions > small,.world-atlas-next-action span { display:none; }
  .world-atlas-next-actions { grid-template-columns:1fr; }
}
'''
css_path.write_text(css)

test_path = Path("test/world-atlas-npc-signals.test.js")
test_text = test_path.read_text()
old = 'const Signals = require("../src/world-atlas-npc-signals.js");\n'
new = old + 'const DiscoveryActions = require("../src/discovery-actions.js");\n'
if test_text.count(old) != 1:
    raise SystemExit("Signals require anchor not found exactly once")
test_text = test_text.replace(old, new, 1)
test_text += r'''

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
'''
test_path.write_text(test_text)

browser_path = Path("scripts/check-atlas-viewport.cjs")
browser = browser_path.read_text()
old = '''      assert.equal(await page.evaluate(() => window.__atlasReloadCount), 1);
      await page.locator(".world-atlas-close").click();'''
new = '''      assert.equal(await page.evaluate(() => window.__atlasReloadCount), 1);
      await page.waitForSelector(".world-atlas-next-actions");
      assert.equal(await page.locator(".world-atlas-next-action").count(), 2, "Nearby Atlas should surface two next moves");
      assert.equal(await page.locator('.world-atlas-next-action[data-next-action-source="signal"]').count(), 1, "One transient lead should stay visible");
      assert.equal(await page.locator('.world-atlas-next-action[data-next-action-source="place"]').count(), 1, "One stable-place action should stay visible");
      await page.locator(".world-atlas-close").click();'''
if browser.count(old) != 1:
    raise SystemExit("browser next-action anchor not found exactly once")
browser = browser.replace(old, new, 1)
browser_path.write_text(browser)
