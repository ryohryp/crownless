(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationCells = api;
  if (root && root.document) api.install(root.document, root.CrownlessCore, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExplorationCellRuntime() {
  "use strict";

  const CELL_WINDOW_RADIUS = 2;
  const CELL_GEOLOCATION_OPTIONS = Object.freeze({ enableHighAccuracy: false, timeout: 6500, maximumAge: 30000 });

  function parseCellId(value) {
    const match = /^cell:(\d{1,2}):(\d+):(\d+)$/.exec(String(value || "").trim());
    if (!match) return null;
    const zoom = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) return null;
    const size = 2 ** zoom;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return null;
    return { id: `cell:${zoom}:${x}:${y}`, zoom, x, y };
  }

  function cellWindowModel(currentCell, knownCellIds, radius = CELL_WINDOW_RADIUS) {
    const current = typeof currentCell === "string" ? parseCellId(currentCell) : parseCellId(currentCell && currentCell.id);
    if (!current) return [];
    const safeRadius = Math.max(1, Math.min(4, Math.floor(Number(radius) || CELL_WINDOW_RADIUS)));
    const known = new Set(Array.from(knownCellIds || []).map((value) => String(value)));
    const gridSize = safeRadius * 2 + 1;
    const inset = 8;
    const tileSize = (100 - inset * 2) / gridSize;
    const worldSize = 2 ** current.zoom;
    const model = [];

    for (let dy = -safeRadius; dy <= safeRadius; dy += 1) {
      for (let dx = -safeRadius; dx <= safeRadius; dx += 1) {
        const x = current.x + dx;
        const y = current.y + dy;
        if (x < 0 || y < 0 || x >= worldSize || y >= worldSize) continue;
        const id = `cell:${current.zoom}:${x}:${y}`;
        model.push({
          id,
          known: known.has(id),
          current: dx === 0 && dy === 0,
          left: inset + (dx + safeRadius) * tileSize,
          top: inset + (dy + safeRadius) * tileSize,
          size: tileSize
        });
      }
    }
    return model;
  }

  function injectStyles(document) {
    if (!document || document.getElementById("exploration-cell-styles")) return;
    const style = document.createElement("style");
    style.id = "exploration-cell-styles";
    style.textContent = `
      .exploration-cell-layer { position:absolute; inset:0; z-index:1; pointer-events:none; }
      .exploration-cell-tile { position:absolute; box-sizing:border-box; border:1px dashed rgba(169,155,125,.12); background:repeating-linear-gradient(135deg,transparent 0 12px,rgba(169,155,125,.018) 12px 13px); }
      .exploration-cell-tile.known { border-color:rgba(103,137,117,.32); background:linear-gradient(rgba(74,108,91,.14),rgba(74,108,91,.08)),repeating-linear-gradient(20deg,rgba(102,139,117,.035) 0 1px,transparent 1px 8px); box-shadow:inset 0 0 14px rgba(77,111,94,.05); }
      .exploration-cell-tile.current { outline:1px solid rgba(201,163,93,.5); outline-offset:-3px; }
      .exploration-cell-tile.current::after { content:""; position:absolute; left:50%; top:50%; width:4px; height:4px; border-radius:50%; background:rgba(215,182,107,.8); transform:translate(-50%,-50%); }
      .exploration-cell-tile.newly-known { animation:crownless-cell-ink-in .5s ease-out both; }
      .exploration-cell-count { position:absolute; z-index:4; left:8px; bottom:6px; padding:3px 6px; border-left:1px solid rgba(101,137,116,.55); background:rgba(11,10,8,.72); color:#91aa99; font-size:7px; font-weight:800; letter-spacing:.1em; pointer-events:none; }
      .exploration-cells-active .sketch-map-field { background:radial-gradient(circle at 50% 50%,rgba(74,108,91,.1),transparent 38%),radial-gradient(circle at 18% 24%,rgba(201,163,93,.035),transparent 28%); }
      @keyframes crownless-cell-ink-in { from { opacity:.05; transform:scale(.92); } to { opacity:1; transform:scale(1); } }
      @media (prefers-reduced-motion:reduce) { .exploration-cell-tile.newly-known { animation:none; } }
    `;
    document.head.appendChild(style);
  }

  function install(document, Core, root) {
    if (!document || !Core || Core.__explorationCellRuntimeInstalled) return false;
    if (typeof Core.recordExploredCell !== "function" || typeof Core.loadSafeState !== "function") return false;

    injectStyles(document);
    let currentCell = null;
    let lastAddedCellId = "";
    let locationPromise = null;

    function knownCellIds() {
      const safe = Core.loadSafeState();
      const cells = safe && safe.worldKnowledge && safe.worldKnowledge.exploredCells;
      return cells && typeof cells === "object" && !Array.isArray(cells) ? Object.keys(cells) : [];
    }

    function renderCellLayer() {
      if (!currentCell) return false;
      const map = document.getElementById("exploration-sketch-map");
      const field = map && map.querySelector(".sketch-map-field");
      if (!map || !field) return false;

      map.hidden = false;
      map.classList.add("exploration-cells-active");
      let layer = field.querySelector(".exploration-cell-layer");
      if (!layer) {
        layer = document.createElement("div");
        layer.className = "exploration-cell-layer";
        layer.setAttribute("role", "img");
        field.appendChild(layer);
      }

      const knownIds = knownCellIds();
      const model = cellWindowModel(currentCell, knownIds);
      layer.innerHTML = "";
      layer.setAttribute("aria-label", `探索済み領域は${knownIds.length}。現在地周辺の既知領域と未踏領域の境界。`);
      model.forEach((entry) => {
        const tile = document.createElement("span");
        tile.className = `exploration-cell-tile ${entry.known ? "known" : "unknown"}${entry.current ? " current" : ""}${entry.id === lastAddedCellId ? " newly-known" : ""}`;
        tile.setAttribute("aria-hidden", "true");
        tile.style.left = `${entry.left}%`;
        tile.style.top = `${entry.top}%`;
        tile.style.width = `${entry.size}%`;
        tile.style.height = `${entry.size}%`;
        layer.appendChild(tile);
      });

      let count = field.querySelector(".exploration-cell-count");
      if (!count) {
        count = document.createElement("span");
        count.className = "exploration-cell-count";
        field.appendChild(count);
      }
      count.textContent = `KNOWN TERRITORY ${knownIds.length} / 既知領域`;
      lastAddedCellId = "";
      return true;
    }

    function persistLocation(location) {
      const safe = Core.loadSafeState();
      if (!safe) return null;
      const result = Core.recordExploredCell(safe, location);
      if (!result || !result.cell) return result;
      currentCell = result.cell;
      lastAddedCellId = result.added ? result.cell.id : "";
      renderCellLayer();
      return result;
    }

    function requestCurrentCell() {
      const geolocation = root && root.navigator && root.navigator.geolocation;
      if (!geolocation || typeof geolocation.getCurrentPosition !== "function") return Promise.resolve(null);
      if (locationPromise) return locationPromise;

      locationPromise = new Promise((resolve) => {
        geolocation.getCurrentPosition((position) => {
          const coords = position && position.coords;
          const location = coords ? { latitude: coords.latitude, longitude: coords.longitude } : null;
          resolve(location ? persistLocation(location) : null);
        }, () => resolve(null), CELL_GEOLOCATION_OPTIONS);
      }).finally(() => { locationPromise = null; });
      return locationPromise;
    }

    const originalBeginExpedition = typeof Core.beginExpedition === "function" ? Core.beginExpedition.bind(Core) : null;
    const originalContinueExpedition = typeof Core.continueExpedition === "function" ? Core.continueExpedition.bind(Core) : null;

    if (originalBeginExpedition) {
      Core.beginExpedition = function beginExpeditionWithExplorationCell(...args) {
        const next = originalBeginExpedition(...args);
        Promise.resolve().then(requestCurrentCell);
        return next;
      };
    }
    if (originalContinueExpedition) {
      Core.continueExpedition = function continueExpeditionWithExplorationCell(...args) {
        const next = originalContinueExpedition(...args);
        Promise.resolve().then(requestCurrentCell);
        return next;
      };
    }

    Core.__explorationCellRuntimeInstalled = true;
    api.currentCell = () => currentCell ? { ...currentCell } : null;
    api.render = renderCellLayer;
    api.reload = requestCurrentCell;
    return true;
  }

  const api = {
    CELL_WINDOW_RADIUS,
    CELL_GEOLOCATION_OPTIONS,
    parseCellId,
    cellWindowModel,
    install,
    currentCell: () => null,
    render: () => false,
    reload: () => Promise.resolve(null)
  };

  return api;
});
