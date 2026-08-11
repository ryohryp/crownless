(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationMap = api;
  if (root && root.document) api.install(root.document, root.CrownlessCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExplorationMapPresentation() {
  "use strict";

  const GRID_RADIUS = 4;
  const STORAGE_KEY = "crownless.map.v1";
  const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ];

  function coordKey(x, y) {
    return `${x},${y}`;
  }

  function frontierOffsets(step) {
    const shift = Math.abs(Number(step) || 0) % 4;
    return DIRECTIONS.slice(shift, shift + 4).concat(DIRECTIONS.slice(0, shift), DIRECTIONS.slice(shift + 4));
  }

  function chooseFrontierCells(current, occupiedKeys, step, count) {
    const occupied = occupiedKeys instanceof Set ? occupiedKeys : new Set(occupiedKeys || []);
    const chosen = [];
    const seen = new Set();
    const offsets = frontierOffsets(step);
    const wanted = Math.max(0, Number(count) || 0);

    for (const offset of offsets) {
      const x = current.x + offset.x;
      const y = current.y + offset.y;
      const key = coordKey(x, y);
      if (occupied.has(key) || seen.has(key)) continue;
      chosen.push({ x, y, key });
      seen.add(key);
      if (chosen.length >= wanted) break;
    }

    return chosen;
  }

  function frontierHint(signal) {
    const text = String(signal || "");
    if (text.includes("標的")) return "強い気配";
    if (text.includes("ダンジョン") || text.includes("坑道") || text.includes("最奥")) return "深い影";
    if (text.includes("隠し荷") || text.includes("物資")) return "荷の跡";
    if (text.includes("祠") || text.includes("異様")) return "石の輪郭";
    if (text.includes("人物") || text.includes("人影")) return "人影";
    if (text.includes("待ち伏せ")) return "囲む影";
    if (text.includes("戦闘") || text.includes("敵影")) return "動く影";
    return "気配";
  }

  function inferEventKind(signal, huntTarget) {
    const text = String(signal || "");
    if (huntTarget || text.includes("標的")) return "hunt";
    if (text.includes("最奥")) return "dungeon-boss";
    if (text.includes("エリート")) return "dungeon-elite";
    if (text.includes("罠")) return "dungeon-trap";
    if (text.includes("坑道") && text.includes("戦闘")) return "dungeon-combat";
    if (text.includes("ダンジョン")) return "dungeon";
    if (text.includes("隠し荷") || text.includes("物資の気配")) return "cache";
    if (text.includes("祠") || text.includes("異様な気配")) return "shrine";
    if (text.includes("人物") || text === "人影") return "traveler";
    if (text.includes("待ち伏せ") || text.includes("不穏な気配")) return "ambush";
    if (text.includes("戦闘") || text.includes("敵影")) return "combat";
    return "combat";
  }

  function persistableCells(cells) {
    const values = cells instanceof Map ? Array.from(cells.values()) : Array.from(cells || []);
    return values
      .filter((cell) => cell && (cell.state === "visited" || cell.state === "hearth"))
      .map((cell) => ({
        key: cell.key || coordKey(cell.x, cell.y),
        x: Number(cell.x) || 0,
        y: Number(cell.y) || 0,
        state: cell.state,
        name: cell.name || (cell.state === "hearth" ? "灰炉" : "踏破地点"),
        signal: cell.signal || "踏破済み",
        glyph: cell.glyph || (cell.state === "hearth" ? "⌂" : "◆"),
        palette: cell.palette || "road"
      }));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function install(document, Core) {
    if (!document || !Core || document.getElementById("exploration-map-panel")) return;

    const leadList = document.getElementById("lead-list");
    const exploreScreen = document.getElementById("explore-screen");
    if (!leadList || !exploreScreen) return;

    const preparedByChoiceId = new Map();
    const baseDiscoverLocation = Core.discoverLocation;
    const storage = (() => {
      try { return document.defaultView && document.defaultView.localStorage; }
      catch (_) { return null; }
    })();

    const model = {
      cells: new Map(),
      current: { x: 0, y: 0 },
      selectedKey: null,
      stepKey: null,
      step: 0,
      scheduled: false,
      latestLeads: []
    };

    function hearthCell() {
      return {
        key: coordKey(0, 0),
        x: 0,
        y: 0,
        state: "hearth",
        name: "灰炉",
        signal: "SAFE",
        glyph: "⌂",
        palette: "hearth"
      };
    }

    function readWorld() {
      if (!storage) return [];
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.cells)) return [];
        return parsed.cells.filter((cell) => cell && Number.isFinite(Number(cell.x)) && Number.isFinite(Number(cell.y)));
      } catch (_) {
        return [];
      }
    }

    function commitWorld() {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cells: persistableCells(model.cells) }));
      } catch (_) {}
    }

    function loadCommittedWorld() {
      model.cells.clear();
      readWorld().forEach((cell) => {
        const key = coordKey(Number(cell.x), Number(cell.y));
        model.cells.set(key, { ...cell, key, state: cell.state === "hearth" ? "hearth" : "visited" });
      });
      model.cells.set(coordKey(0, 0), hearthCell());
    }

    function beginMapRun() {
      loadCommittedWorld();
      preparedByChoiceId.clear();
      model.current = { x: 0, y: 0 };
      model.selectedKey = null;
      model.stepKey = null;
      model.step = 0;
      model.latestLeads = [];
      render();
    }

    const style = document.createElement("style");
    style.id = "exploration-map-styles";
    style.textContent = `
      html.exploration-map-enabled #expedition-route,
      html.exploration-map-enabled #lead-list { display:none !important; }
      .exploration-map-panel { margin-top:16px; border:1px solid var(--line); background:linear-gradient(145deg,rgba(19,18,15,.96),rgba(8,8,7,.98)); overflow:hidden; }
      .exploration-map-heading { display:flex; align-items:end; justify-content:space-between; gap:18px; padding:16px 18px; border-bottom:1px solid var(--line); }
      .exploration-map-heading h2 { margin:2px 0 0; font-size:28px; }
      .exploration-map-heading span { color:var(--dim); font-size:10px; letter-spacing:.08em; }
      .exploration-map-layout { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr); min-height:430px; }
      .exploration-map-board-wrap { position:relative; min-height:430px; padding:24px; overflow:hidden; border-right:1px solid var(--line); background:radial-gradient(circle at 50% 50%,rgba(89,83,67,.09),transparent 40%),linear-gradient(135deg,rgba(255,255,255,.018),transparent 45%); }
      .exploration-map-board-wrap::after { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 50% 50%,transparent 0 26%,rgba(6,6,5,.25) 58%,rgba(3,3,3,.74) 100%); }
      .exploration-map-board { position:relative; z-index:1; width:min(100%,590px); aspect-ratio:1; margin:auto; display:grid; grid-template-columns:repeat(9,1fr); grid-template-rows:repeat(9,1fr); gap:4px; }
      .exploration-map-cell { min-width:0; min-height:0; padding:0; border:1px solid rgba(232,214,181,.08); color:var(--paper); display:grid; place-items:center; position:relative; overflow:hidden; }
      .exploration-map-cell.fog { background:linear-gradient(145deg,rgba(30,30,27,.2),rgba(4,4,4,.62)); border-color:rgba(255,255,255,.025); }
      .exploration-map-cell.fog::after { content:""; position:absolute; inset:-40%; background:radial-gradient(circle at 35% 35%,rgba(210,202,184,.045),transparent 45%); transform:rotate(18deg); }
      button.exploration-map-cell { cursor:pointer; touch-action:manipulation; }
      .exploration-map-cell.hearth { border-color:rgba(131,154,121,.5); background:rgba(91,116,79,.17); }
      .exploration-map-cell.visited { border-color:rgba(201,163,93,.3); background:linear-gradient(145deg,rgba(124,95,49,.14),rgba(25,22,17,.8)); }
      .exploration-map-cell.discovered { border-color:rgba(205,178,123,.55); background:linear-gradient(145deg,rgba(119,88,45,.18),rgba(22,19,15,.82)); }
      .exploration-map-cell.current { box-shadow:inset 0 0 0 2px rgba(240,199,114,.72),0 0 22px rgba(240,199,114,.14); }
      .exploration-map-cell.frontier { border-color:rgba(157,149,132,.24); background:linear-gradient(145deg,rgba(86,82,72,.13),rgba(8,8,7,.78)); animation:frontierBreath 2.7s ease-in-out infinite; }
      .exploration-map-cell.frontier::after { content:""; position:absolute; inset:-40%; background:radial-gradient(circle,rgba(217,199,165,.11),transparent 55%); transform:translate(-18%,-18%); }
      .exploration-map-cell.revealed { border-color:rgba(240,199,114,.65); background:rgba(137,98,45,.18); animation:none; }
      .exploration-map-cell .map-glyph { position:relative; z-index:1; font-family:Georgia,serif; font-size:22px; color:#d9c79e; }
      .exploration-map-cell.frontier:not(.revealed) .map-glyph { color:rgba(234,220,194,.66); }
      .exploration-map-cell .map-signal { position:absolute; z-index:1; left:3px; right:3px; bottom:3px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:rgba(212,199,176,.6); font-size:7px; letter-spacing:.04em; text-align:center; }
      .exploration-map-cell.current .map-glyph { color:var(--gold-2); }
      .exploration-map-details { padding:24px; display:flex; flex-direction:column; justify-content:center; background:linear-gradient(180deg,rgba(255,255,255,.012),rgba(0,0,0,.14)); }
      .exploration-map-details .eyebrow { margin-bottom:8px; }
      .exploration-map-details h3 { margin:0 0 10px; font-size:32px; }
      .exploration-map-details p { font-size:12px; line-height:1.65; }
      .map-hint-copy { color:var(--muted); }
      .map-discovery-kicker { color:var(--gold); font-size:10px !important; letter-spacing:.04em; }
      .map-discovery-omen { padding:10px 12px; border-left:2px solid rgba(201,163,93,.55); background:rgba(201,163,93,.06); color:#d2c2a3; }
      .map-discovery-signals { display:flex; flex-wrap:wrap; gap:8px 14px; margin:2px 0 18px; color:var(--dim); font-size:9px; text-transform:uppercase; letter-spacing:.07em; }
      .map-discovery-signals strong { color:var(--paper); }
      .map-investigate, .map-travel { width:100%; margin-top:auto; padding:15px 18px; font-weight:900; cursor:pointer; }
      .map-investigate { border:0; color:#120f0b; background:linear-gradient(180deg,var(--gold-2),#a57b37); }
      .map-travel { border:1px solid var(--line); color:var(--paper); background:rgba(255,255,255,.025); }
      .map-legend { position:absolute; z-index:2; left:18px; bottom:14px; display:flex; gap:12px; color:rgba(215,204,184,.5); font-size:8px; letter-spacing:.05em; }
      @keyframes frontierBreath { 0%,100% { opacity:.62; } 50% { opacity:1; } }
      @media (max-width:760px) {
        .exploration-map-heading { align-items:flex-start; }
        .exploration-map-heading span { max-width:150px; text-align:right; }
        .exploration-map-layout { grid-template-columns:1fr; }
        .exploration-map-board-wrap { min-height:auto; padding:14px 10px 30px; border-right:0; border-bottom:1px solid var(--line); }
        .exploration-map-board { width:100%; max-width:390px; gap:3px; }
        .exploration-map-cell .map-glyph { font-size:17px; }
        .exploration-map-cell .map-signal { font-size:6px; }
        .exploration-map-details { min-height:250px; padding:18px; }
        .exploration-map-details h3 { font-size:27px; }
        .map-legend { left:12px; bottom:9px; }
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add("exploration-map-enabled");

    const panel = document.createElement("section");
    panel.id = "exploration-map-panel";
    panel.className = "exploration-map-panel";
    panel.innerHTML = `
      <div class="exploration-map-heading">
        <div><p class="eyebrow">FOG MAP / SIMULATED LOCATION</p><h2>霧を、一枚ずつ剥がす。</h2></div>
        <span>発見した場所は地図に残る。踏破した道は次の遠征にも残る。</span>
      </div>
      <div class="exploration-map-layout">
        <div class="exploration-map-board-wrap">
          <div id="exploration-map-board" class="exploration-map-board" aria-label="探索地図"></div>
          <div class="map-legend"><span>⌂ 灰炉</span><span>◆ 踏破</span><span>◇ 発見済</span><span>? 未知</span></div>
        </div>
        <aside id="exploration-map-details" class="exploration-map-details" aria-live="polite"></aside>
      </div>`;
    leadList.parentNode.insertBefore(panel, leadList);

    const board = panel.querySelector("#exploration-map-board");
    const details = panel.querySelector("#exploration-map-details");

    function paletteGlyph(data) {
      if (String(data.signal || "").includes("標的")) return "⚔";
      if (String(data.signal || "").includes("坑道") || String(data.signal || "").includes("地下") || String(data.signal || "").includes("最奥")) return "◆";
      const glyphs = { chapel: "†", woods: "♠", road: "━", marsh: "≈", hill: "▲", cut: "⌇" };
      return glyphs[data.palette] || "◆";
    }

    function identifyChoice(name, signal, index, generatedDepth, card) {
      const huntTarget = card.classList.contains("hunt-target");
      const eventKind = inferEventKind(signal, huntTarget);
      const hunt = Array.isArray(Core.HUNTS)
        ? Core.HUNTS.find((candidate) => candidate && candidate.lair && candidate.lair.name === name)
        : null;
      const dungeon = Array.isArray(Core.DUNGEONS)
        ? Core.DUNGEONS.find((candidate) => candidate && candidate.name === name)
        : null;
      const location = Array.isArray(Core.LOCATIONS)
        ? Core.LOCATIONS.find((candidate) => candidate && candidate.name === name)
        : null;

      if (hunt) {
        return {
          id: hunt.lair.id,
          locationId: hunt.lair.id,
          choiceId: `hunt:${hunt.id}`,
          eventKind: "hunt",
          special: true,
          enemyBias: hunt.enemyKind
        };
      }

      if (dungeon && eventKind === "dungeon") {
        return {
          id: dungeon.id,
          locationId: dungeon.id,
          choiceId: `dungeon:${dungeon.id}:entrance`,
          eventKind: "dungeon",
          special: true
        };
      }

      if (location) {
        return {
          ...clone(location),
          id: location.id,
          locationId: location.id,
          choiceId: `${location.id}:${generatedDepth}:${index}`,
          eventKind,
          special: false
        };
      }

      return {
        id: null,
        locationId: null,
        choiceId: null,
        eventKind,
        special: eventKind.startsWith("dungeon")
      };
    }

    function extractLead(card, index) {
      const signalNode = card.querySelector(".lead-signals label strong");
      const risk = card.querySelectorAll(".pips.risk i.on").length;
      const reward = card.querySelectorAll(".pips.reward i.on").length;
      const paletteMatch = Array.from(card.classList).find((name) => name.startsWith("palette-"));
      const name = card.querySelector("h3")?.textContent?.trim() || "名もない場所";
      const signal = signalNode?.textContent?.trim() || "気配";
      const generatedDepth = Math.max(0, (Number(document.getElementById("explore-depth")?.textContent) || 1) - 1);
      const identity = identifyChoice(name, signal, index, generatedDepth, card);
      const data = {
        ...identity,
        index,
        slot: index,
        generatedDepth,
        name,
        kicker: card.querySelector(".lead-topline span")?.textContent?.trim() || "霧の向こうで何かが動いた。",
        description: card.querySelector(".lead-content > p")?.textContent?.trim() || "まだ何があるか分からない。",
        omen: (card.querySelector(".lead-omen")?.textContent || "").replace(/^噂：/, "").trim(),
        signal,
        frontierHint: frontierHint(signal),
        risk,
        reward,
        palette: paletteMatch ? paletteMatch.replace("palette-", "") : "road",
        leadButton: card
      };
      data.glyph = paletteGlyph(data);
      if (data.choiceId) {
        const prepared = { ...data };
        delete prepared.leadButton;
        preparedByChoiceId.set(data.choiceId, prepared);
      }
      return data;
    }

    function addLoot(next, count, rewardBias, salt) {
      const startIndex = next.expedition.unsecuredLoot.length;
      const ids = [];
      for (let i = 0; i < count; i += 1) {
        const item = Core.rollLoot(next.expedition.seed + salt, next.expedition.depth, startIndex + i, rewardBias);
        next.expedition.unsecuredLoot.push(item);
        ids.push(item.id);
      }
      next.expedition.lastLootIds = ids;
    }

    function preparedSeed(exp, choice) {
      let hash = 0;
      const id = String(choice.id || choice.locationId || choice.name || "prepared");
      for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
      return exp.seed + exp.depth * 733 + exp.discoveries.length * 191 + hash + (choice.slot || 0) * 53;
    }

    function advanceImmediateHuntClue(next, discovery) {
      if (!Core.getActiveHunt || !next.hunts || !Array.isArray(next.hunts.entries)) return;
      const hunt = Core.getActiveHunt(next);
      if (!hunt || !Array.isArray(hunt.territories) || !hunt.territories.includes(discovery.locationId)) return;
      const entry = next.hunts.entries.find((candidate) => candidate.id === hunt.id);
      if (!entry || entry.completed || entry.clues >= hunt.clueGoal) return;
      entry.clues += 1;
      next.stats.huntClues = (next.stats.huntClues || 0) + 1;
      const found = entry.clues >= hunt.clueGoal
        ? `痕跡が繋がった。${hunt.name}の居場所を突き止めた。`
        : `${hunt.name}の痕跡を掴んだ。あと${hunt.clueGoal - entry.clues}つで追える。`;
      next.expedition.lastEventSummary = next.expedition.lastEventSummary
        ? `${next.expedition.lastEventSummary} ${found}`
        : found;
    }

    function resolvePreparedGeneric(state, choice) {
      if (!state.expedition || state.phase !== "explore") return baseDiscoverLocation(state, choice.choiceId);
      const next = clone(state);
      const exp = next.expedition;
      const discovery = {
        id: `${choice.id}-${exp.depth}-${exp.discoveries.length}`,
        locationId: choice.locationId || choice.id,
        name: choice.name,
        kicker: choice.kicker,
        flavor: choice.description,
        omen: choice.omen,
        risk: choice.risk,
        reward: choice.reward,
        palette: choice.palette,
        depth: exp.depth + 1,
        signal: choice.signal,
        eventKind: choice.eventKind
      };

      exp.discoveries.push(discovery);
      exp.lastDiscovery = discovery;
      if (exp.scouting > 0) exp.scouting -= 1;
      const kind = choice.eventKind;
      const rng = Core.createRng(preparedSeed(exp, choice));

      if (kind === "cache") {
        addLoot(next, choice.reward >= 4 ? 2 : 1, choice.reward + 1, 401);
        exp.lastEventSummary = "隠された荷を見つけた。戦わずに済んだことが、かえって不気味だ。";
        exp.encounter = null;
        next.stats.eventsResolved += 1;
        next.phase = "decision";
        advanceImmediateHuntClue(next, discovery);
        return next;
      }

      if (kind === "shrine") {
        exp.pendingEvent = {
          kind: "shrine",
          title: "煤けた小祠",
          text: "石皿には新しい血が乾いている。祈れば何かを得られそうだが、代価を求められる気配がある。",
          options: [
            { id: "offer-blood", label: "血を捧げる", detail: "HPを失い、強い戦利品を得る" },
            { id: "rest-by-shrine", label: "火のそばで休む", detail: "戦利品を諦め、傷を少し癒す" }
          ],
          discovery
        };
        next.phase = "event";
        return next;
      }

      if (kind === "traveler") {
        exp.pendingEvent = {
          kind: "traveler",
          title: "傷ついた伝令",
          text: "泥だらけの伝令が道端に座り込んでいる。追手の足音を聞いたと言い、破れた地図を握っている。",
          options: [
            { id: "take-rumor", label: "情報を聞く", detail: "次の探索の危険を読みやすくする" },
            { id: "follow-tracks", label: "追手を逆に追う", detail: "危険な戦闘になるが、戦利品の期待が高い" }
          ],
          discovery
        };
        next.phase = "event";
        return next;
      }

      const ambush = kind === "ambush";
      exp.encounter = {
        kind: ambush ? "ambush" : "combat",
        discovery,
        enemies: Core.buildEnemies(exp.depth, rng, choice, ambush ? 1 : 0),
        rewardBonus: ambush ? 2 : 0
      };
      next.phase = "combat";
      return next;
    }

    Core.discoverLocation = function discoverLocationFromPersistentMap(state, choiceId) {
      const prepared = preparedByChoiceId.get(choiceId);
      if (!prepared || prepared.special || !state || !state.expedition) return baseDiscoverLocation(state, choiceId);
      if (state.expedition.depth === prepared.generatedDepth) return baseDiscoverLocation(state, choiceId);
      return resolvePreparedGeneric(state, prepared);
    };

    function retireFrontiers() {
      Array.from(model.cells.entries()).forEach(([key, cell]) => {
        if (cell.state !== "frontier") return;
        if (cell.revealed && cell.choiceId) {
          cell.state = "discovered";
          cell.revealed = true;
        } else {
          model.cells.delete(key);
        }
      });
      model.selectedKey = null;
    }

    function projectFrontiers(leads) {
      retireFrontiers();
      const existingChoiceIds = new Set(
        Array.from(model.cells.values()).map((cell) => cell.choiceId).filter(Boolean)
      );
      const available = leads.filter((lead) => !lead.choiceId || !existingChoiceIds.has(lead.choiceId));
      const occupied = new Set(model.cells.keys());
      const coords = chooseFrontierCells(model.current, occupied, model.step, available.length);
      available.forEach((lead, index) => {
        const coord = coords[index];
        if (!coord) return;
        model.cells.set(coord.key, {
          ...lead,
          ...coord,
          state: "frontier",
          revealed: false
        });
      });
    }

    function makeStep(cards) {
      const depth = Number(document.getElementById("explore-depth")?.textContent) || 1;
      const leads = cards.map(extractLead);
      const stepKey = `${depth}:${leads.map((lead) => lead.name).join("|")}`;
      if (stepKey === model.stepKey) return;
      model.latestLeads = leads;
      projectFrontiers(leads);
      model.stepKey = stepKey;
      model.step += 1;
    }

    function revealOrSelectCell(key) {
      const cell = model.cells.get(key);
      if (!cell) return;
      model.selectedKey = key;
      if (cell.state === "frontier") cell.revealed = true;
      render();
    }

    function investigateSelected() {
      const cell = model.cells.get(model.selectedKey);
      if (!cell || !["frontier", "discovered"].includes(cell.state) || !cell.revealed || !cell.leadButton) return;
      cell.state = "visited";
      cell.name = cell.name || "踏破地点";
      model.current = { x: cell.x, y: cell.y };
      model.selectedKey = null;
      render();
      cell.leadButton.click();
    }

    function travelToSelected() {
      const cell = model.cells.get(model.selectedKey);
      if (!cell || !["visited", "hearth"].includes(cell.state)) return;
      model.current = { x: cell.x, y: cell.y };
      model.selectedKey = null;
      if (model.latestLeads.length) projectFrontiers(model.latestLeads);
      render();
    }

    function renderDetails() {
      const cell = model.selectedKey ? model.cells.get(model.selectedKey) : null;
      if (!cell) {
        const visited = Array.from(model.cells.values()).filter((item) => item.state === "visited").length;
        const discovered = Array.from(model.cells.values()).filter((item) => item.state === "discovered" || (item.state === "frontier" && item.revealed)).length;
        details.innerHTML = `
          <p class="eyebrow">UNKNOWN FRONTIER</p>
          <h3>地図は、まだ途切れている。</h3>
          <p class="map-hint-copy">霧の縁を選ぶと、その場所の正体だけが分かる。調べずに残した場所は、この遠征中なら後から戻れる。</p>
          <p class="map-hint-copy">踏破した場所は灰炉へ戻ったあと地図に残る。次の遠征では、そこまで既知の道として移動できる。</p>
          <div class="map-discovery-signals"><span>踏破済 <strong>${visited}</strong></span><span>未調査 <strong>${discovered}</strong></span><span>現在地 <strong>${model.current.x}, ${model.current.y}</strong></span></div>`;
        return;
      }

      if (["visited", "hearth"].includes(cell.state)) {
        const current = cell.x === model.current.x && cell.y === model.current.y;
        details.innerHTML = `
          <p class="eyebrow">${cell.state === "hearth" ? "SAFE HAVEN" : "KNOWN ROAD"}</p>
          <h3>${cell.name}</h3>
          <p class="map-hint-copy">${cell.state === "hearth" ? "火のある場所。ここから未知へ出る。" : "一度踏破した場所。道筋はもう霧に戻らない。"}</p>
          <div class="map-discovery-signals"><span>状態 <strong>${current ? "現在地" : "踏破済"}</strong></span></div>
          ${current ? "" : '<button id="map-travel" class="map-travel" type="button">既知の道をここまで辿る <span>→</span></button>'}`;
        details.querySelector("#map-travel")?.addEventListener("click", travelToSelected);
        return;
      }

      if (!cell.revealed) {
        details.innerHTML = `
          <p class="eyebrow">FRONTIER HINT</p>
          <h3>${cell.frontierHint || "何かがある。"}</h3>
          <p class="map-hint-copy">輪郭だけが見える。霧を払えば場所は分かるが、まだ中へ入る必要はない。</p>`;
        return;
      }

      details.innerHTML = `
        <p class="eyebrow">DISCOVERED / NOT INVESTIGATED</p>
        <p class="map-discovery-kicker">${cell.kicker}</p>
        <h3>${cell.name}</h3>
        <p>${cell.description}</p>
        <p class="map-discovery-omen">噂：${cell.omen || "何があるかは、まだ分からない。"}</p>
        <div class="map-discovery-signals">
          <span>気配 <strong>${cell.signal}</strong></span>
          <span>危険 <strong>${cell.risk}/5</strong></span>
          <span>期待 <strong>${cell.reward}/5</strong></span>
        </div>
        <button id="map-investigate" class="map-investigate" type="button">ここを調べる <span>→</span></button>`;
      details.querySelector("#map-investigate")?.addEventListener("click", investigateSelected);
    }

    function render() {
      if (!board || !details) return;
      const minX = model.current.x - GRID_RADIUS;
      const minY = model.current.y - GRID_RADIUS;
      const maxX = model.current.x + GRID_RADIUS;
      const maxY = model.current.y + GRID_RADIUS;
      board.innerHTML = "";

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const key = coordKey(x, y);
          const cell = model.cells.get(key);
          if (!cell) {
            const fog = document.createElement("div");
            fog.className = "exploration-map-cell fog";
            fog.style.gridColumn = String(x - minX + 1);
            fog.style.gridRow = String(y - minY + 1);
            board.appendChild(fog);
            continue;
          }

          const interactive = ["frontier", "discovered", "visited", "hearth"].includes(cell.state);
          const node = document.createElement(interactive ? "button" : "div");
          if (interactive) node.type = "button";
          const current = cell.x === model.current.x && cell.y === model.current.y;
          const revealed = cell.state === "discovered" || (cell.state === "frontier" && cell.revealed);
          node.className = `exploration-map-cell ${cell.state}${current ? " current" : ""}${revealed ? " revealed" : ""}`;
          node.style.gridColumn = String(cell.x - minX + 1);
          node.style.gridRow = String(cell.y - minY + 1);
          node.title = revealed || !["frontier"].includes(cell.state) ? cell.name : `${cell.frontierHint || "気配"} — 霧を払う`;
          const glyph = cell.state === "frontier" && !cell.revealed ? "?" : (cell.state === "discovered" ? "◇" : (cell.glyph || "◆"));
          const label = cell.state === "frontier" && !cell.revealed
            ? (cell.frontierHint || "未知")
            : cell.state === "discovered"
              ? cell.name
              : (cell.name || "踏破");
          node.innerHTML = `<span class="map-glyph">${glyph}</span><small class="map-signal">${label}</small>`;
          node.addEventListener("click", () => revealOrSelectCell(cell.key));
          board.appendChild(node);
        }
      }

      renderDetails();
    }

    function refreshFromLeads() {
      model.scheduled = false;
      if (!exploreScreen.classList.contains("active")) return;
      const cards = Array.from(leadList.querySelectorAll(".lead-card"));
      if (!cards.length) return;
      makeStep(cards);
      render();
    }

    function scheduleRefresh() {
      if (model.scheduled) return;
      model.scheduled = true;
      queueMicrotask(refreshFromLeads);
    }

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(leadList, { childList: true });

    document.getElementById("start-expedition")?.addEventListener("click", beginMapRun, true);
    document.getElementById("return-to-hub")?.addEventListener("click", commitWorld, true);
    document.getElementById("return-again")?.addEventListener("click", () => {
      commitWorld();
      beginMapRun();
    }, true);

    beginMapRun();
    scheduleRefresh();
  }

  return {
    GRID_RADIUS,
    STORAGE_KEY,
    coordKey,
    frontierOffsets,
    chooseFrontierCells,
    frontierHint,
    inferEventKind,
    persistableCells,
    install
  };
});