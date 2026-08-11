(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationFeel = api;
  if (root && root.document) api.install(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExplorationFeel() {
  "use strict";

  function clampNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function pressureLevel(input) {
    const hp = clampNumber(input && input.hp, 100);
    const loot = clampNumber(input && input.loot, 0);
    const depth = clampNumber(input && input.depth, 1);
    let score = 0;

    if (hp <= 65) score += 1;
    if (hp <= 40) score += 1;
    if (loot >= 1) score += 1;
    if (loot >= 3) score += 1;
    if (depth >= 4) score += 1;
    if (depth >= 6) score += 1;

    if (score >= 5 || hp <= 25) return "critical";
    if (score >= 3) return "danger";
    if (score >= 1) return "wary";
    return "calm";
  }

  function pressureCopy(level) {
    if (level === "critical") return "生還を優先しろ。ここから先は欲張りだ。";
    if (level === "danger") return "失いたくない物が増えた。次の一歩には理由が要る。";
    if (level === "wary") return "まだ進める。ただし、帰る価値も生まれている。";
    return "荷は軽い。未知を開くにはいい状態だ。";
  }

  function scoutHintFromTitle(title) {
    const text = String(title || "").trim();
    if (!text) return "霧の向こうに、何かの気配がある。";
    const hint = text.split("—")[0].trim();
    return hint || "霧の向こうに、何かの気配がある。";
  }

  function approachCopy(hint) {
    const text = String(hint || "");
    if (text.includes("強い")) return "足跡が深い。近づけば、相手にもこちらが知られる。";
    if (text.includes("深い影")) return "地面の先が沈んでいる。入口か、裂け目かはまだ分からない。";
    if (text.includes("荷")) return "何かを引きずった跡が霧へ続いている。人の気配は薄い。";
    if (text.includes("人影")) return "ひとつの影が止まっている。助けを待つ者か、誘い餌か。";
    if (text.includes("囲む")) return "一方向ではない。複数の気配がこちらを測っている。";
    if (text.includes("動く")) return "低い影が横切った。獣か、人かはまだ見えない。";
    if (text.includes("石")) return "霧の切れ目に人工物の輪郭がある。古いものだ。";
    return "輪郭だけが見える。近づけば、場所の正体までは掴めそうだ。";
  }

  function investigateLabel(risk) {
    const value = clampNumber(risk, 0);
    if (value >= 4) return "危険を承知で踏み込む";
    if (value >= 3) return "警戒して踏み込む";
    return "この場所を調べる";
  }

  function install(document) {
    if (!document || document.getElementById("exploration-feel-styles")) return;

    const panel = document.getElementById("exploration-map-panel");
    const board = document.getElementById("exploration-map-board");
    const details = document.getElementById("exploration-map-details");
    const exploreScreen = document.getElementById("explore-screen");
    if (!panel || !board || !details || !exploreScreen) return;

    const style = document.createElement("style");
    style.id = "exploration-feel-styles";
    style.textContent = `
      .map-expedition-pressure { display:grid; grid-template-columns:repeat(3,minmax(74px,auto)) 1fr; align-items:center; gap:10px 16px; padding:10px 18px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.018); }
      .map-expedition-pressure .pressure-stat { display:flex; align-items:baseline; gap:7px; color:var(--dim); font-size:9px; letter-spacing:.06em; text-transform:uppercase; }
      .map-expedition-pressure .pressure-stat strong { color:var(--paper); font-size:15px; }
      .map-expedition-pressure .pressure-message { justify-self:end; color:var(--muted); font-size:10px; letter-spacing:.02em; text-align:right; }
      .exploration-map-panel[data-pressure="wary"] .map-expedition-pressure { box-shadow:inset 3px 0 0 rgba(201,163,93,.55); }
      .exploration-map-panel[data-pressure="danger"] .map-expedition-pressure { box-shadow:inset 3px 0 0 rgba(183,106,62,.78); background:rgba(143,69,36,.05); }
      .exploration-map-panel[data-pressure="critical"] .map-expedition-pressure { box-shadow:inset 3px 0 0 rgba(177,67,49,.92); background:rgba(143,44,32,.08); }
      .exploration-map-board { isolation:isolate; }
      .exploration-map-cell { z-index:1; transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease,opacity .15s ease; }
      .exploration-map-cell.scouted { z-index:2; transform:scale(1.06); border-color:rgba(240,199,114,.92) !important; box-shadow:0 0 0 2px rgba(240,199,114,.15),0 0 28px rgba(240,199,114,.22); animation:none !important; }
      .exploration-map-cell.scouted .map-glyph { color:var(--gold-2) !important; }
      .exploration-map-board.has-scouted .exploration-map-cell.frontier:not(.scouted) { opacity:.48; }
      .map-route-overlay { position:absolute; inset:0; z-index:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
      .map-route-overlay line { stroke:rgba(201,163,93,.36); stroke-width:2; stroke-linecap:round; }
      .map-route-overlay line.route-current { stroke:rgba(240,199,114,.68); stroke-width:2.6; }
      .map-scout-copy { color:var(--muted); }
      .map-scout-omen { margin:6px 0 16px; padding:11px 12px; border-left:2px solid rgba(201,163,93,.6); background:rgba(201,163,93,.06); color:#d6c6a9; font-size:11px; line-height:1.65; }
      .map-approach { width:100%; margin-top:auto; padding:15px 18px; border:1px solid rgba(201,163,93,.5); color:var(--paper); background:linear-gradient(180deg,rgba(201,163,93,.11),rgba(201,163,93,.045)); font-weight:900; cursor:pointer; }
      .map-choice-note { margin:10px 0 0; color:var(--dim); font-size:9px !important; line-height:1.55 !important; }
      .map-risk-note { margin:-6px 0 14px; color:#c9a36a; font-size:10px !important; }
      @media (max-width:760px) {
        .map-expedition-pressure { grid-template-columns:repeat(3,1fr); gap:7px; padding:9px 12px; }
        .map-expedition-pressure .pressure-stat { justify-content:center; }
        .map-expedition-pressure .pressure-message { grid-column:1 / -1; justify-self:stretch; text-align:center; }
      }
    `;
    document.head.appendChild(style);

    const pressure = document.createElement("div");
    pressure.id = "map-expedition-pressure";
    pressure.className = "map-expedition-pressure";
    pressure.innerHTML = `
      <span class="pressure-stat">HP <strong data-pressure-hp>100</strong></span>
      <span class="pressure-stat">未確定 <strong data-pressure-loot>0</strong></span>
      <span class="pressure-stat">深度 <strong data-pressure-depth>1</strong></span>
      <span class="pressure-message" data-pressure-copy>荷は軽い。未知を開くにはいい状態だ。</span>`;
    panel.querySelector(".exploration-map-heading")?.insertAdjacentElement("afterend", pressure);

    function readMetric(id, fallback) {
      return clampNumber(document.getElementById(id)?.textContent, fallback);
    }

    function updatePressure() {
      const state = {
        hp: readMetric("explore-hp", 100),
        loot: readMetric("explore-loot-count", 0),
        depth: readMetric("explore-depth", 1)
      };
      const level = pressureLevel(state);
      panel.dataset.pressure = level;
      pressure.querySelector("[data-pressure-hp]").textContent = String(state.hp);
      pressure.querySelector("[data-pressure-loot]").textContent = String(state.loot);
      pressure.querySelector("[data-pressure-depth]").textContent = String(state.depth);
      pressure.querySelector("[data-pressure-copy]").textContent = pressureCopy(level);
    }

    const bypassScout = new WeakSet();

    function clearScoutVisuals() {
      board.classList.remove("has-scouted");
      board.querySelectorAll(".exploration-map-cell.scouted").forEach((cell) => cell.classList.remove("scouted"));
    }

    function showScout(cell) {
      clearScoutVisuals();
      board.classList.add("has-scouted");
      cell.classList.add("scouted");
      const hint = scoutHintFromTitle(cell.title);
      details.innerHTML = `
        <p class="eyebrow">FRONTIER / NOT YET KNOWN</p>
        <h3>${hint}</h3>
        <p class="map-scout-copy">正体はまだ見えない。ここで分かるのは、近づく理由と引き返す理由だけだ。</p>
        <p class="map-scout-omen">${approachCopy(hint)}</p>
        <button id="map-approach" class="map-approach" type="button">この気配へ近づく <span>→</span></button>
        <p class="map-choice-note">近づいても、発見した危険へ必ず踏み込む必要はない。</p>`;
      details.querySelector("#map-approach")?.addEventListener("click", () => {
        bypassScout.add(cell);
        clearScoutVisuals();
        cell.click();
      });
    }

    board.addEventListener("click", (event) => {
      const cell = event.target.closest && event.target.closest("button.exploration-map-cell.frontier:not(.revealed)");
      if (!cell || !board.contains(cell)) return;
      if (bypassScout.has(cell)) {
        bypassScout.delete(cell);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      showScout(cell);
    }, true);

    function annotateDiscovery() {
      if (details.querySelector("#map-approach")) return;
      const investigate = details.querySelector("#map-investigate");
      if (!investigate) return;
      const match = details.textContent.match(/危険\s*(\d+)\/5/);
      const risk = match ? Number(match[1]) : 0;
      const label = investigateLabel(risk);
      if (investigate.dataset.feelLabel !== label) {
        investigate.dataset.feelLabel = label;
        investigate.innerHTML = `${label} <span>→</span>`;
      }
      if (!details.querySelector(".map-risk-note")) {
        const note = document.createElement("p");
        note.className = "map-risk-note";
        note.textContent = risk >= 4
          ? "ここから先は探索ではなく攻略だ。入るなら戦うつもりで。"
          : risk >= 3
            ? "中へ入れば、傷や未確定戦利品を抱えたまま戻ることになるかもしれない。"
            : "正体は分かった。今は入らず、別の霧を開いてもいい。";
        investigate.insertAdjacentElement("beforebegin", note);
      }
      if (!details.querySelector(".map-choice-note")) {
        const note = document.createElement("p");
        note.className = "map-choice-note";
        note.textContent = "別の地点を選べば、この場所は発見済みのまま残る。";
        investigate.insertAdjacentElement("afterend", note);
      }
    }

    let drawingRoutes = false;
    function drawKnownRoutes() {
      if (drawingRoutes) return;
      drawingRoutes = true;
      board.querySelector(".map-route-overlay")?.remove();

      const cells = Array.from(board.querySelectorAll(".exploration-map-cell.hearth, .exploration-map-cell.visited"));
      if (cells.length >= 2 && board.clientWidth > 0 && board.clientHeight > 0) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "map-route-overlay");
        svg.setAttribute("viewBox", `0 0 ${board.clientWidth} ${board.clientHeight}`);
        svg.setAttribute("aria-hidden", "true");
        const nodes = cells.map((cell) => ({
          cell,
          col: parseInt(cell.style.gridColumn, 10),
          row: parseInt(cell.style.gridRow, 10),
          x: cell.offsetLeft + cell.offsetWidth / 2,
          y: cell.offsetTop + cell.offsetHeight / 2
        })).filter((item) => Number.isFinite(item.col) && Number.isFinite(item.row));

        for (let i = 0; i < nodes.length; i += 1) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            const a = nodes[i];
            const b = nodes[j];
            const adjacent = Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) === 1;
            if (!adjacent) continue;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", String(a.x));
            line.setAttribute("y1", String(a.y));
            line.setAttribute("x2", String(b.x));
            line.setAttribute("y2", String(b.y));
            if (a.cell.classList.contains("current") || b.cell.classList.contains("current")) line.setAttribute("class", "route-current");
            svg.appendChild(line);
          }
        }
        board.prepend(svg);
      }
      drawingRoutes = false;
    }

    let routeQueued = false;
    function queueRouteDraw() {
      if (routeQueued) return;
      routeQueued = true;
      const view = document.defaultView;
      const run = () => {
        routeQueued = false;
        drawKnownRoutes();
      };
      if (view && typeof view.requestAnimationFrame === "function") view.requestAnimationFrame(run);
      else queueMicrotask(run);
    }

    const detailObserver = new MutationObserver(() => {
      annotateDiscovery();
      updatePressure();
    });
    detailObserver.observe(details, { childList: true, subtree: true });

    const boardObserver = new MutationObserver((records) => {
      const onlyOverlay = records.every((record) => {
        const changed = [...record.addedNodes, ...record.removedNodes];
        return changed.length > 0 && changed.every((node) => node.nodeType === 1 && node.classList.contains("map-route-overlay"));
      });
      if (!onlyOverlay) {
        clearScoutVisuals();
        queueRouteDraw();
      }
    });
    boardObserver.observe(board, { childList: true });

    ["explore-hp", "explore-loot-count", "explore-depth"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) new MutationObserver(updatePressure).observe(node, { childList: true, characterData: true, subtree: true });
    });

    document.getElementById("start-expedition")?.addEventListener("click", () => {
      clearScoutVisuals();
      updatePressure();
      queueRouteDraw();
    });

    updatePressure();
    annotateDiscovery();
    queueRouteDraw();
  }

  return {
    pressureLevel,
    pressureCopy,
    scoutHintFromTitle,
    approachCopy,
    investigateLabel,
    install
  };
});