(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationMap = api;
  if (root && root.document) api.install(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExplorationMapPresentation() {
  "use strict";

  const GRID_RADIUS = 4;
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
    if (text.includes("ダンジョン") || text.includes("坑道")) return "深い影";
    if (text.includes("隠し荷") || text.includes("物資")) return "荷の跡";
    if (text.includes("祠") || text.includes("異様")) return "石の輪郭";
    if (text.includes("人物") || text.includes("人影")) return "人影";
    if (text.includes("戦闘") || text.includes("敵影") || text.includes("待ち伏せ")) return "動く影";
    return "気配";
  }

  function install(document) {
    if (!document || document.getElementById("exploration-map-panel")) return;

    const leadList = document.getElementById("lead-list");
    const exploreScreen = document.getElementById("explore-screen");
    if (!leadList || !exploreScreen) return;

    const model = {
      cells: new Map(),
      current: { x: 0, y: 0 },
      selectedKey: null,
      stepKey: null,
      step: 0,
      scheduled: false
    };

    function reset() {
      model.cells.clear();
      model.current = { x: 0, y: 0 };
      model.selectedKey = null;
      model.stepKey = null;
      model.step = 0;
      model.cells.set(coordKey(0, 0), {
        key: coordKey(0, 0),
        x: 0,
        y: 0,
        state: "hearth",
        name: "灰炉",
        signal: "SAFE",
        glyph: "⌂"
      });
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
      .exploration-map-board-wrap::after { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 50% 50%,transparent 0 26%,rgba(6,6,5,.26) 58%,rgba(3,3,3,.72) 100%); }
      .exploration-map-board { position:relative; z-index:1; width:min(100%,590px); aspect-ratio:1; margin:auto; display:grid; grid-template-columns:repeat(9,1fr); grid-template-rows:repeat(9,1fr); gap:5px; }
      .exploration-map-cell { min-width:0; min-height:0; padding:0; border:1px solid rgba(232,214,181,.08); background:rgba(255,255,255,.018); color:var(--paper); display:grid; place-items:center; position:relative; overflow:hidden; }
      button.exploration-map-cell { cursor:pointer; touch-action:manipulation; }
      .exploration-map-cell.hearth { border-color:rgba(131,154,121,.45); background:rgba(91,116,79,.16); }
      .exploration-map-cell.visited { border-color:rgba(201,163,93,.28); background:rgba(124,95,49,.11); }
      .exploration-map-cell.current { box-shadow:inset 0 0 0 2px rgba(240,199,114,.7),0 0 22px rgba(240,199,114,.12); }
      .exploration-map-cell.frontier { border-color:rgba(157,149,132,.22); background:linear-gradient(145deg,rgba(86,82,72,.12),rgba(8,8,7,.72)); animation:frontierBreath 2.7s ease-in-out infinite; }
      .exploration-map-cell.frontier::after { content:""; position:absolute; inset:-40%; background:radial-gradient(circle,rgba(217,199,165,.11),transparent 55%); transform:translate(-18%,-18%); }
      .exploration-map-cell.revealed { border-color:rgba(240,199,114,.62); background:rgba(137,98,45,.17); animation:none; }
      .exploration-map-cell .map-glyph { position:relative; z-index:1; font-family:Georgia,serif; font-size:22px; color:#d9c79e; }
      .exploration-map-cell.frontier:not(.revealed) .map-glyph { color:rgba(234,220,194,.62); }
      .exploration-map-cell .map-signal { position:absolute; z-index:1; left:3px; right:3px; bottom:3px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:rgba(212,199,176,.58); font-size:7px; letter-spacing:.04em; text-align:center; }
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
      .map-investigate { width:100%; margin-top:auto; padding:15px 18px; border:0; color:#120f0b; background:linear-gradient(180deg,var(--gold-2),#a57b37); font-weight:900; cursor:pointer; }
      .map-legend { position:absolute; z-index:2; left:18px; bottom:14px; display:flex; gap:12px; color:rgba(215,204,184,.45); font-size:8px; letter-spacing:.05em; }
      @keyframes frontierBreath { 0%,100% { opacity:.6; } 50% { opacity:1; } }
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
        <span>場所を見つけることと、入ることは別の判断。</span>
      </div>
      <div class="exploration-map-layout">
        <div class="exploration-map-board-wrap">
          <div id="exploration-map-board" class="exploration-map-board" aria-label="探索地図"></div>
          <div class="map-legend"><span>⌂ 灰炉</span><span>◆ 踏破</span><span>? 未知</span></div>
        </div>
        <aside id="exploration-map-details" class="exploration-map-details" aria-live="polite"></aside>
      </div>`;
    leadList.parentNode.insertBefore(panel, leadList);

    const board = panel.querySelector("#exploration-map-board");
    const details = panel.querySelector("#exploration-map-details");

    function paletteGlyph(data) {
      if (String(data.signal || "").includes("標的")) return "⚔";
      if (String(data.signal || "").includes("坑道") || String(data.signal || "").includes("地下")) return "◆";
      const glyphs = { chapel: "†", woods: "♠", road: "━", marsh: "≈", hill: "▲", cut: "⌇" };
      return glyphs[data.palette] || "◆";
    }

    function extractLead(card, index) {
      const signalNode = card.querySelector(".lead-signals label strong");
      const risk = card.querySelectorAll(".pips.risk i.on").length;
      const reward = card.querySelectorAll(".pips.reward i.on").length;
      const paletteMatch = Array.from(card.classList).find((name) => name.startsWith("palette-"));
      const data = {
        index,
        name: card.querySelector("h3")?.textContent?.trim() || "名もない場所",
        kicker: card.querySelector(".lead-topline span")?.textContent?.trim() || "霧の向こうで何かが動いた。",
        description: card.querySelector(".lead-content > p")?.textContent?.trim() || "まだ何があるか分からない。",
        omen: (card.querySelector(".lead-omen")?.textContent || "").replace(/^噂：/, "").trim(),
        signal: signalNode?.textContent?.trim() || "気配",
        frontierHint: frontierHint(signalNode?.textContent?.trim()),
        risk,
        reward,
        palette: paletteMatch ? paletteMatch.replace("palette-", "") : "road",
        leadButton: card
      };
      data.glyph = paletteGlyph(data);
      return data;
    }

    function clearFrontiers() {
      Array.from(model.cells.entries()).forEach(([key, cell]) => {
        if (cell.state === "frontier") model.cells.delete(key);
      });
      model.selectedKey = null;
    }

    function makeStep(cards) {
      const depth = Number(document.getElementById("explore-depth")?.textContent) || 1;
      const leads = cards.map(extractLead);
      const stepKey = `${depth}:${leads.map((lead) => lead.name).join("|")}`;
      if (stepKey === model.stepKey) return;

      clearFrontiers();
      const occupied = new Set(model.cells.keys());
      const coords = chooseFrontierCells(model.current, occupied, model.step, leads.length);
      leads.forEach((lead, index) => {
        const coord = coords[index];
        if (!coord) return;
        model.cells.set(coord.key, {
          ...lead,
          ...coord,
          state: "frontier",
          revealed: false
        });
      });
      model.stepKey = stepKey;
      model.step += 1;
    }

    function revealCell(key) {
      const cell = model.cells.get(key);
      if (!cell || cell.state !== "frontier") return;
      model.selectedKey = key;
      cell.revealed = true;
      render();
    }

    function investigateSelected() {
      const cell = model.cells.get(model.selectedKey);
      if (!cell || cell.state !== "frontier" || !cell.revealed || !cell.leadButton) return;
      cell.state = "visited";
      cell.name = cell.name || "踏破地点";
      model.current = { x: cell.x, y: cell.y };
      model.selectedKey = null;
      render();
      cell.leadButton.click();
    }

    function renderDetails() {
      const cell = model.selectedKey ? model.cells.get(model.selectedKey) : null;
      if (!cell || !cell.revealed) {
        const visited = Array.from(model.cells.values()).filter((item) => item.state === "visited").length;
        details.innerHTML = `
          <p class="eyebrow">UNKNOWN FRONTIER</p>
          <h3>まだ、名前はない。</h3>
          <p class="map-hint-copy">光、煙、足跡、壊れた輪郭。まず霧の縁を選んで、何があるかだけ確かめる。</p>
          <p class="map-hint-copy">場所が分かっても、すぐ戦う必要はない。入るかどうかは、その後で決める。</p>
          <div class="map-discovery-signals"><span>今回の踏破 <strong>${visited}</strong></span><span>現在地 <strong>${model.current.x}, ${model.current.y}</strong></span></div>`;
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

      Array.from(model.cells.values())
        .filter((cell) => cell.x >= minX && cell.x <= maxX && cell.y >= minY && cell.y <= maxY)
        .forEach((cell) => {
          const isFrontier = cell.state === "frontier";
          const node = document.createElement(isFrontier ? "button" : "div");
          if (isFrontier) node.type = "button";
          const current = cell.x === model.current.x && cell.y === model.current.y;
          const revealed = isFrontier && cell.revealed;
          node.className = `exploration-map-cell ${cell.state}${current ? " current" : ""}${revealed ? " revealed" : ""}`;
          node.style.gridColumn = String(cell.x - minX + 1);
          node.style.gridRow = String(cell.y - minY + 1);
          node.title = revealed || !isFrontier ? cell.name : `${cell.frontierHint || "気配"} — 霧を払う`;
          const glyph = isFrontier && !revealed ? "?" : (cell.glyph || "◆");
          node.innerHTML = `<span class="map-glyph">${glyph}</span><small class="map-signal">${isFrontier && !revealed ? (cell.frontierHint || "未知") : (cell.name || "踏破")}</small>`;
          if (isFrontier) node.addEventListener("click", () => revealCell(cell.key));
          board.appendChild(node);
        });

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

    document.getElementById("start-expedition")?.addEventListener("click", reset, true);
    document.getElementById("return-again")?.addEventListener("click", reset, true);

    reset();
    scheduleRefresh();
  }

  return {
    GRID_RADIUS,
    coordKey,
    frontierOffsets,
    chooseFrontierCells,
    frontierHint,
    install
  };
});
