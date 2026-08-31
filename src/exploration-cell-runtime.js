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
  const DAILY_RADIUS_CELLS = 4;
  const NEARBY_RADIUS_CELLS = 28;
  const EXPEDITION_PROFILES = Object.freeze({
    daily: Object.freeze({ tier: "daily", label: "生活圏", unknownChance: 0 }),
    nearby: Object.freeze({ tier: "nearby", label: "近郊遠征", unknownChance: 0.45 }),
    long: Object.freeze({ tier: "long", label: "長距離遠征", unknownChance: 1 })
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function parseCellId(value) {
    const candidate = value && value.id ? value.id : value;
    const match = /^cell:(\d{1,2}):(\d+):(\d+)$/.exec(String(candidate || "").trim());
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

  function cellDistance(left, right) {
    const a = parseCellId(left);
    const b = parseCellId(right);
    if (!a || !b || a.zoom !== b.zoom) return null;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function nearestKnownDistance(currentCell, knownCellIds) {
    const current = parseCellId(currentCell);
    if (!current) return null;
    let nearest = Infinity;
    Array.from(knownCellIds || []).forEach((value) => {
      const known = parseCellId(value);
      if (!known || known.zoom !== current.zoom || known.id === current.id) return;
      const distance = cellDistance(current, known);
      if (distance !== null && distance < nearest) nearest = distance;
    });
    return nearest;
  }

  function expeditionScore(distance) {
    if (!Number.isFinite(distance) || distance <= 0) return 0;
    if (distance <= DAILY_RADIUS_CELLS) return Math.min(24, Math.round((distance / DAILY_RADIUS_CELLS) * 24));
    if (distance <= NEARBY_RADIUS_CELLS) {
      const progress = (distance - DAILY_RADIUS_CELLS) / (NEARBY_RADIUS_CELLS - DAILY_RADIUS_CELLS);
      return 25 + Math.round(progress * 44);
    }
    return Math.min(100, 70 + Math.round(Math.log2(1 + distance - NEARBY_RADIUS_CELLS) * 7));
  }

  function expeditionProfile(currentCell, knownCellIds) {
    const current = parseCellId(currentCell);
    const distance = nearestKnownDistance(current, knownCellIds);
    let base = EXPEDITION_PROFILES.daily;
    if (Number.isFinite(distance) && distance > NEARBY_RADIUS_CELLS) base = EXPEDITION_PROFILES.long;
    else if (Number.isFinite(distance) && distance > DAILY_RADIUS_CELLS) base = EXPEDITION_PROFILES.nearby;

    return {
      ...base,
      score: expeditionScore(distance),
      nearestKnownCells: Number.isFinite(distance) ? distance : null,
      currentCellId: current ? current.id : "",
      hasBaseline: Number.isFinite(distance)
    };
  }

  function deterministicRoll(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  }

  function shouldVeilDiscovery(profile, key) {
    if (!profile || profile.unknownChance <= 0) return false;
    if (profile.unknownChance >= 1) return true;
    return deterministicRoll(`${profile.currentCellId}:${key || "unknown"}`) < profile.unknownChance;
  }

  function veilDiscovery(discovery, profile) {
    if (!discovery || typeof discovery !== "object") return discovery;
    if (discovery.mysteryIdentity) return clone(discovery);
    const resolved = clone(discovery);
    return {
      ...clone(discovery),
      title: "？",
      baseTitle: "未知地点",
      realPlaceName: "",
      signal: `${profile && profile.label ? profile.label : "遠征"}。羊皮紙には墨染みだけが残る。踏み込んで調べるまで、何が待つかは分からない。`,
      contentKind: "mystery",
      revealState: "unknown",
      features: [],
      palette: "road",
      mysteryIdentity: resolved,
      expeditionTier: profile && profile.tier ? profile.tier : "daily",
      expeditionLabel: profile && profile.label ? profile.label : "生活圏"
    };
  }

  function resolveDiscovery(discovery) {
    if (!discovery || typeof discovery !== "object") return discovery;
    return discovery.mysteryIdentity && typeof discovery.mysteryIdentity === "object"
      ? clone(discovery.mysteryIdentity)
      : clone(discovery);
  }

  function applyUnknownness(discoveries, profile, isKnown) {
    const source = Array.isArray(discoveries) ? discoveries.map((item) => clone(item)) : [];
    const key = source.map((item) => item && item.sourceRef || "").join("|");
    if (!source.length || !shouldVeilDiscovery(profile, key)) return source;
    const index = source.findIndex((item) => item && !item.qaInjected && !(typeof isKnown === "function" && isKnown(item)));
    if (index < 0) return source;
    source[index] = veilDiscovery(source[index], profile);
    return source;
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
      .lead-card[data-expedition-unknown="true"] h3 { font-size:clamp(30px,5vw,48px); letter-spacing:.08em; }
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
    let lastProfile = expeditionProfile(null, []);

    function knownCellIds() {
      const safe = Core.loadSafeState();
      const cells = safe && safe.worldKnowledge && safe.worldKnowledge.exploredCells;
      return cells && typeof cells === "object" && !Array.isArray(cells) ? Object.keys(cells) : [];
    }

    function knownDiscoveryKeys() {
      const safe = Core.loadSafeState();
      const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
      return new Set(discoveries && typeof discoveries === "object" && !Array.isArray(discoveries) ? Object.keys(discoveries) : []);
    }

    function installExpeditionUnknownBridge() {
      const GeographyApi = root && root.CrownlessGeographyApi;
      const runtime = root && root.CrownlessLocationDiscoveryRuntime;
      if (!GeographyApi || typeof GeographyApi.createProxyLocationDiscoveryProvider !== "function" || !runtime) return false;
      if (GeographyApi.__expeditionUnknownsInstalled) return true;

      const originalCreateProvider = GeographyApi.createProxyLocationDiscoveryProvider.bind(GeographyApi);
      GeographyApi.createProxyLocationDiscoveryProvider = function createProviderWithExpeditionUnknowns(...args) {
        const provider = originalCreateProvider(...args);
        if (!provider || typeof provider.discover !== "function") return provider;
        const originalDiscover = provider.discover.bind(provider);
        provider.discover = async function discoverWithExpeditionUnknowns(input) {
          const discovered = await originalDiscover(input);
          if (runtime.qaMode) return discovered;
          const location = input && input.location;
          const cell = typeof Core.explorationCellFromLocation === "function" ? Core.explorationCellFromLocation(location) : null;
          lastProfile = expeditionProfile(cell, knownCellIds());
          const knownKeys = knownDiscoveryKeys();
          const isKnown = (item) => {
            const key = typeof runtime.worldKnowledgeKey === "function" ? runtime.worldKnowledgeKey(item) : null;
            return Boolean(key && knownKeys.has(key));
          };
          return applyUnknownness(discovered, lastProfile, isKnown);
        };
        return provider;
      };

      if (typeof Core.discoverLocation === "function") {
        const originalDiscoverLocation = Core.discoverLocation.bind(Core);
        Core.discoverLocation = function discoverLocationWithUnknownReveal(state, choiceId) {
          const activeRuntime = root && root.CrownlessLocationDiscoveryRuntime;
          const slot = activeRuntime && typeof activeRuntime.choiceSlot === "function" ? activeRuntime.choiceSlot(state, choiceId) : 0;
          const visible = activeRuntime && Array.isArray(activeRuntime.discoveries) ? activeRuntime.discoveries[slot] : null;
          const wasMystery = Boolean(visible && visible.mysteryIdentity);
          const expeditionTier = visible && visible.expeditionTier || "";
          const expeditionLabel = visible && visible.expeditionLabel || "";

          if (wasMystery) {
            const resolved = resolveDiscovery(visible);
            Object.keys(visible).forEach((key) => { delete visible[key]; });
            Object.assign(visible, resolved);
          }

          const next = originalDiscoverLocation(state, choiceId);
          const last = next && next.expedition && next.expedition.lastDiscovery;
          if (wasMystery && last) {
            last.wasUnknownDiscovery = true;
            last.expeditionTier = expeditionTier;
            last.expeditionLabel = expeditionLabel;
            if (Array.isArray(next.expedition.discoveries)) {
              const history = next.expedition.discoveries.find((item) => item && item.id === last.id);
              if (history) {
                history.wasUnknownDiscovery = true;
                history.expeditionTier = expeditionTier;
                history.expeditionLabel = expeditionLabel;
              }
            }
          }
          return next;
        };
      }

      GeographyApi.__expeditionUnknownsInstalled = true;
      return true;
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

    installExpeditionUnknownBridge();

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
    api.lastExpeditionProfile = () => ({ ...lastProfile });
    api.render = renderCellLayer;
    api.reload = requestCurrentCell;
    return true;
  }

  const api = {
    CELL_WINDOW_RADIUS,
    CELL_GEOLOCATION_OPTIONS,
    DAILY_RADIUS_CELLS,
    NEARBY_RADIUS_CELLS,
    EXPEDITION_PROFILES,
    parseCellId,
    cellWindowModel,
    cellDistance,
    nearestKnownDistance,
    expeditionScore,
    expeditionProfile,
    deterministicRoll,
    shouldVeilDiscovery,
    veilDiscovery,
    resolveDiscovery,
    applyUnknownness,
    install,
    currentCell: () => null,
    lastExpeditionProfile: () => expeditionProfile(null, []),
    render: () => false,
    reload: () => Promise.resolve(null)
  };

  return api;
});