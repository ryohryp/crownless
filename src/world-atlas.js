(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlas = api;
  if (root && root.document) api.install(root.document, root.CrownlessCore, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlas() {
  "use strict";

  const CELL_PADDING = 1;
  const MAX_FRINGE_CELLS = 180;
  const SCAN_COOLDOWN_MS = 30000;
  const NEARBY_LIMIT = 3;
  const NEARBY_RADIUS_METRES = 650;
  const MARKER_INSET_PERCENT = 5;
  const TERRAIN_GLYPHS = Object.freeze({
    water: "≈",
    crossing: "×",
    sacred: "✣",
    woods: "♧",
    road_hub: "⌘",
    height: "⌃",
    coast: "≋",
    settlement: "▦"
  });
  let lastScanAt = 0;
  let lastScanResult = null;

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parseCellId(value) {
    const match = /^cell:(\d{1,2}):(\d+):(\d+)$/.exec(cleanText(value));
    if (!match) return null;
    const zoom = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) return null;
    const size = 2 ** zoom;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return null;
    return { id: `cell:${zoom}:${x}:${y}`, zoom, x, y };
  }

  function parseAreaId(value) {
    const match = /^area:(\d{1,2}):(\d+):(\d+)$/.exec(cleanText(value));
    if (!match) return null;
    const zoom = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) return null;
    const size = 2 ** zoom;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return null;
    return { id: `area:${zoom}:${x}:${y}`, zoom, x, y };
  }

  function validCoordinate(point) {
    const latitude = Number(point && point.latitude);
    const longitude = Number(point && point.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
      ? { latitude, longitude }
      : null;
  }

  function terrainGlyph(entry) {
    const terrain = Array.isArray(entry && (entry.terrain || entry.features)) ? (entry.terrain || entry.features) : [];
    const key = terrain.find((item) => TERRAIN_GLYPHS[item]);
    if (key) return TERRAIN_GLYPHS[key];
    if (entry && entry.contentKind === "dungeon") return "◇";
    if (entry && entry.contentKind === "encounter") return "†";
    return "·";
  }

  function discoveryStateLabel(entry) {
    if (!entry) return "探索録";
    if (entry.state === "cleared") return "踏破済み";
    if (entry.state === "investigated") return "調査済み / 遠征候補";
    return "発見済み / 遠征候補";
  }

  function areaCenterInCellSpace(area, cellZoom) {
    const parsed = typeof area === "string" ? parseAreaId(area) : area;
    const zoom = Number(cellZoom);
    if (!parsed || !Number.isInteger(zoom) || zoom < parsed.zoom || zoom > 22) return null;
    const factor = 2 ** (zoom - parsed.zoom);
    return { x: parsed.x * factor + factor / 2, y: parsed.y * factor + factor / 2 };
  }

  function fringeCells(explored, current) {
    const cells = new Map();
    explored.forEach((cell) => cells.set(cell.id, { ...cell, known: true, current: false }));
    if (current && (!cells.size || current.zoom === explored[0]?.zoom)) {
      const existing = cells.get(current.id);
      cells.set(current.id, { ...(existing || current), known: Boolean(existing), current: true });
    }

    const anchors = [...cells.values()].filter((cell) => cell.known || cell.current);
    let fringeCount = 0;
    for (const anchor of anchors) {
      if (fringeCount >= MAX_FRINGE_CELLS) break;
      const size = 2 ** anchor.zoom;
      for (let dy = -CELL_PADDING; dy <= CELL_PADDING; dy += 1) {
        for (let dx = -CELL_PADDING; dx <= CELL_PADDING; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const x = anchor.x + dx;
          const y = anchor.y + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const id = `cell:${anchor.zoom}:${x}:${y}`;
          if (cells.has(id)) continue;
          cells.set(id, { id, zoom: anchor.zoom, x, y, known: false, current: false });
          fringeCount += 1;
          if (fringeCount >= MAX_FRINGE_CELLS) break;
        }
        if (fringeCount >= MAX_FRINGE_CELLS) break;
      }
    }
    return [...cells.values()];
  }

  function atlasViewModel(worldKnowledge, currentCell) {
    const knowledge = worldKnowledge && typeof worldKnowledge === "object" ? worldKnowledge : {};
    const exploredSource = knowledge.exploredCells && typeof knowledge.exploredCells === "object" && !Array.isArray(knowledge.exploredCells) ? knowledge.exploredCells : {};
    const explored = Object.keys(exploredSource).map(parseCellId).filter(Boolean);
    const current = typeof currentCell === "string" ? parseCellId(currentCell) : parseCellId(currentCell && currentCell.id);
    const cellZoom = explored[0]?.zoom || current?.zoom || 16;
    const sameZoomExplored = explored.filter((cell) => cell.zoom === cellZoom);
    const sameZoomCurrent = current && current.zoom === cellZoom ? current : null;
    const rawCells = fringeCells(sameZoomExplored, sameZoomCurrent);
    const discoveriesSource = knowledge.discoveries && typeof knowledge.discoveries === "object" && !Array.isArray(knowledge.discoveries) ? knowledge.discoveries : {};
    const discoveries = [];
    const unplacedDiscoveries = [];

    Object.values(discoveriesSource).forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return;
      const entry = {
        key: cleanText(raw.key, `discovery-${index + 1}`),
        name: cleanText(raw.name, "名もない発見"),
        state: cleanText(raw.state, "discovered"),
        contentKind: cleanText(raw.contentKind, "unknown"),
        terrain: Array.isArray(raw.terrain) ? raw.terrain.map((item) => cleanText(item)).filter(Boolean).slice(0, 8) : [],
        areaId: cleanText(raw.areaId)
      };
      const point = areaCenterInCellSpace(parseAreaId(entry.areaId), cellZoom);
      const modeled = { ...entry, glyph: terrainGlyph(entry), stateLabel: discoveryStateLabel(entry) };
      if (!point) {
        unplacedDiscoveries.push(modeled);
        return;
      }
      discoveries.push({ ...modeled, mapX: point.x, mapY: point.y });
    });

    const coordinateXs = rawCells.map((cell) => cell.x);
    const coordinateYs = rawCells.map((cell) => cell.y);
    discoveries.forEach((entry) => {
      coordinateXs.push(Math.floor(entry.mapX));
      coordinateYs.push(Math.floor(entry.mapY));
    });

    if (!coordinateXs.length) {
      return { cellZoom, exploredCount: 0, discoveryCount: discoveries.length + unplacedDiscoveries.length, cells: [], discoveries: [], unplacedDiscoveries, bounds: null };
    }

    const minX = Math.min(...coordinateXs);
    const maxX = Math.max(...coordinateXs);
    const minY = Math.min(...coordinateYs);
    const maxY = Math.max(...coordinateYs);
    const width = Math.max(1, maxX - minX + 1);
    const height = Math.max(1, maxY - minY + 1);
    const cells = rawCells.map((cell) => ({
      ...cell,
      left: ((cell.x - minX) / width) * 100,
      top: ((cell.y - minY) / height) * 100,
      width: 100 / width,
      height: 100 / height
    }));
    const placedDiscoveries = discoveries.map((entry) => ({
      ...entry,
      left: clamp(((entry.mapX - minX) / width) * 100, MARKER_INSET_PERCENT, 100 - MARKER_INSET_PERCENT),
      top: clamp(((entry.mapY - minY) / height) * 100, MARKER_INSET_PERCENT, 100 - MARKER_INSET_PERCENT)
    }));

    return {
      cellZoom,
      exploredCount: sameZoomExplored.length,
      discoveryCount: discoveries.length + unplacedDiscoveries.length,
      cells,
      discoveries: placedDiscoveries,
      unplacedDiscoveries,
      bounds: { minX, maxX, minY, maxY, width, height }
    };
  }

  function relativeOffsetMeters(origin, point) {
    const from = validCoordinate(origin);
    const to = validCoordinate(point);
    if (!from || !to) return null;
    const metresPerDegree = 111320;
    const latitudeRadians = from.latitude * Math.PI / 180;
    const north = (to.latitude - from.latitude) * metresPerDegree;
    const east = (to.longitude - from.longitude) * metresPerDegree * Math.cos(latitudeRadians);
    return { east, north, distance: Math.hypot(east, north) };
  }

  function projectNearbyPoint(origin, point, radius = NEARBY_RADIUS_METRES) {
    const offset = relativeOffsetMeters(origin, point);
    if (!offset) return null;
    const scale = Math.max(100, Number(radius) || NEARBY_RADIUS_METRES);
    return {
      x: clamp(50 + (offset.east / scale) * 34, 16, 84),
      y: clamp(50 - (offset.north / scale) * 34, 16, 84),
      east: offset.east,
      north: offset.north,
      distance: offset.distance
    };
  }

  function directionLabel(offset) {
    if (!offset) return "方角不明";
    if (offset.distance < 12) return "現在地付近";
    const angle = Math.atan2(offset.east, offset.north) * 180 / Math.PI;
    const normalized = (angle + 360) % 360;
    const labels = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
    return labels[Math.round(normalized / 45) % 8];
  }

  function distanceBand(distance) {
    const metres = Number(distance);
    if (!Number.isFinite(metres)) return "距離不明";
    if (metres < 180) return "近い気配";
    if (metres < 430) return "少し先";
    return "探索域の外縁";
  }

  function fallbackDiscoveryKey(discovery) {
    const sourceRef = cleanText(discovery && discovery.sourceRef);
    if (!sourceRef) return "";
    const features = Array.isArray(discovery && discovery.features) ? discovery.features.map((item) => cleanText(item)).filter(Boolean).sort() : [];
    const kind = cleanText(discovery && discovery.contentKind, "unknown");
    return `geo:${sourceRef}:${kind}:${features.length ? features.join("+") : "unknown"}`;
  }

  function nearbyViewModel(runtime, worldKnowledge, projectionApi) {
    if (!runtime || runtime.state !== "ready" || !Array.isArray(runtime.discoveries)) return [];
    const knowledge = worldKnowledge && worldKnowledge.discoveries && typeof worldKnowledge.discoveries === "object" ? worldKnowledge.discoveries : {};
    return runtime.discoveries.slice(0, NEARBY_LIMIT).map((discovery) => {
      const origin = validCoordinate(discovery && discovery.mapOrigin);
      const point = validCoordinate(discovery && discovery.representativeCoordinate);
      const projected = projectionApi && typeof projectionApi.projectDiscoveryPoint === "function"
        ? projectionApi.projectDiscoveryPoint(origin, point, NEARBY_RADIUS_METRES)
        : projectNearbyPoint(origin, point, NEARBY_RADIUS_METRES);
      if (!projected) return null;
      const key = typeof runtime.worldKnowledgeKey === "function" ? cleanText(runtime.worldKnowledgeKey(discovery)) : fallbackDiscoveryKey(discovery);
      const remembered = key ? knowledge[key] : null;
      const terrain = remembered && Array.isArray(remembered.terrain)
        ? remembered.terrain.slice()
        : Array.isArray(discovery.features) ? discovery.features.slice() : [];
      const entry = {
        key,
        name: cleanText(remembered && remembered.name, cleanText(discovery.title, "名もない発見")),
        shortName: cleanText(discovery.realPlaceName, cleanText(discovery.baseTitle, cleanText(discovery.title, "発見地点"))),
        state: cleanText(remembered && remembered.state, "discovered"),
        contentKind: cleanText(remembered && remembered.contentKind, cleanText(discovery.contentKind, "unknown")),
        terrain,
        glyph: terrainGlyph({ terrain, contentKind: discovery.contentKind }),
        stateLabel: discoveryStateLabel(remembered || { state: "discovered" }),
        x: projected.x,
        y: projected.y,
        direction: projectionApi && typeof projectionApi.directionLabel === "function" ? projectionApi.directionLabel(projected) : directionLabel(projected),
        distanceBand: projectionApi && typeof projectionApi.distanceBand === "function" ? projectionApi.distanceBand(projected.distance) : distanceBand(projected.distance),
        distance: projected.distance
      };
      entry.labelHorizontal = entry.x <= 28 ? "inset-left" : entry.x >= 72 ? "inset-right" : "center";
      entry.labelVertical = entry.y >= 66 ? "above" : "below";
      return entry;
    }).filter(Boolean);
  }

  function initialAtlasView(scanResult, nearbyModel, requested) {
    const hasNearby = Array.isArray(nearbyModel) && nearbyModel.length > 0;
    if (requested === "world") return "world";
    if (requested === "nearby") return hasNearby ? "nearby" : "world";
    return scanResult && scanResult.state === "ready" && hasNearby ? "nearby" : "world";
  }

  function coarseAreaForDiscovery(Core, runtime, discovery) {
    const coordinate = discovery && (discovery.representativeCoordinate || discovery.mapOrigin);
    if (coordinate && Core && typeof Core.explorationAreaFromLocation === "function") {
      const area = Core.explorationAreaFromLocation(coordinate);
      if (area && area.id) return area.id;
    }
    return cleanText(runtime && runtime.currentAreaId);
  }

  function rememberScannedDiscoveries(Core, runtime, now = Date.now()) {
    const empty = { state: null, newCount: 0, rememberedCount: 0, currentCell: null };
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function" || !runtime) return empty;
    const safe = Core.loadSafeState();
    if (!safe) return empty;
    if (typeof Core.sanitizeWorldKnowledge === "function") safe.worldKnowledge = Core.sanitizeWorldKnowledge(safe.worldKnowledge);
    if (!safe.worldKnowledge || typeof safe.worldKnowledge !== "object") safe.worldKnowledge = { discoveries: {} };
    if (!safe.worldKnowledge.discoveries || typeof safe.worldKnowledge.discoveries !== "object") safe.worldKnowledge.discoveries = {};

    const discoveries = Array.isArray(runtime.discoveries) ? runtime.discoveries : [];
    let currentCell = null;
    const mapOrigin = discoveries.find((entry) => entry && entry.mapOrigin)?.mapOrigin || null;
    if (mapOrigin && typeof Core.recordExploredCell === "function") {
      const explored = Core.recordExploredCell(safe, mapOrigin, now);
      currentCell = explored && explored.cell ? explored.cell : null;
    }

    let newCount = 0;
    discoveries.forEach((discovery, index) => {
      if (!discovery || typeof discovery !== "object") return;
      const key = typeof runtime.worldKnowledgeKey === "function" ? cleanText(runtime.worldKnowledgeKey(discovery)) : fallbackDiscoveryKey(discovery);
      if (!key) return;
      const previous = safe.worldKnowledge.discoveries[key] || null;
      const terrain = Array.isArray(discovery.features) ? [...new Set(discovery.features.map((item) => cleanText(item)).filter(Boolean))].slice(0, 8) : [];
      const areaId = coarseAreaForDiscovery(Core, runtime, discovery);
      const next = previous ? { ...previous } : {
        key,
        name: cleanText(discovery.title, `発見地点 ${index + 1}`),
        baseTitle: cleanText(discovery.baseTitle),
        terrain,
        contentKind: cleanText(discovery.contentKind, "unknown"),
        state: "discovered",
        firstDiscoveredAt: Number(now) > 0 ? Number(now) : Date.now(),
        visits: 1
      };
      next.name = cleanText(discovery.title, next.name || `発見地点 ${index + 1}`);
      if (cleanText(discovery.baseTitle)) next.baseTitle = cleanText(discovery.baseTitle);
      if (terrain.length) next.terrain = terrain;
      if (cleanText(discovery.contentKind)) next.contentKind = cleanText(discovery.contentKind);
      if (areaId) next.areaId = areaId;
      safe.worldKnowledge.discoveries[key] = next;
      if (!previous) newCount += 1;
    });

    Core.saveWorldKnowledge(safe);
    return { state: safe, newCount, rememberedCount: discoveries.length, currentCell };
  }

  async function scanNearby(Core, root, options = {}) {
    const runtime = root && root.CrownlessLocationDiscoveryRuntime;
    const now = Date.now();
    if (!runtime || typeof runtime.reload !== "function") return { state: "unavailable", foundCount: 0, newCount: 0, rememberedCount: 0, currentCell: null, cached: false };
    if (!options.force && lastScanResult && now - lastScanAt < SCAN_COOLDOWN_MS) return { ...lastScanResult, cached: true };

    try {
      const found = await runtime.reload();
      const remembered = rememberScannedDiscoveries(Core, runtime, now);
      const result = {
        state: runtime.state === "ready" ? "ready" : runtime.state === "denied" ? "denied" : "failed",
        foundCount: Array.isArray(found) ? found.length : 0,
        newCount: remembered.newCount,
        rememberedCount: remembered.rememberedCount,
        currentCell: remembered.currentCell,
        cached: false
      };
      lastScanAt = now;
      lastScanResult = result;
      if (root && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
        root.dispatchEvent(new root.CustomEvent("crownless:world-knowledge-updated", { detail: { source: "atlas-scan", ...result } }));
      }
      return result;
    } catch (_) {
      const result = { state: "failed", foundCount: 0, newCount: 0, rememberedCount: 0, currentCell: null, cached: false };
      lastScanAt = now;
      lastScanResult = result;
      return result;
    }
  }

  function scanResultText(result, scanning) {
    if (scanning) return "現在地を読み取り、周囲の地形と施設を照合している…";
    if (!result) return "地図を開くと現在地の周囲を調べ、新しい遠征候補を探索録へ残す。";
    if (result.state === "ready") {
      if (!result.foundCount) return "周囲を調べたが、今は遠征候補になる痕跡を見つけられなかった。";
      if (result.newCount) return `周囲から ${result.foundCount} 件を照合。新しく ${result.newCount} 件を探索録へ書き足した。`;
      return `周囲の ${result.foundCount} 件を照合。すべて既知の探索候補だった。`;
    }
    if (result.state === "denied") return "位置情報を使えない。記憶済みの地図はそのまま閲覧できる。";
    if (result.state === "unavailable") return "周辺調査を利用できない。記憶済みの地図を表示している。";
    return "周辺情報を読み取れなかった。記憶済みの地図は失われない。";
  }

  function ensureStylesheet(document) {
    if (!document || document.querySelector('link[href="world-atlas.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "world-atlas.css";
    document.head.appendChild(link);
  }

  function closeAtlas(document) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    if (viewer) viewer.remove();
    if (document && document.body) document.body.classList.remove("world-atlas-open");
  }

  function createDetail(document, entry) {
    const detail = document.createElement("div");
    detail.className = "world-atlas-detail";
    const kicker = document.createElement("small");
    kicker.textContent = "MAP NOTE / 探索録";
    const title = document.createElement("strong");
    title.textContent = entry ? entry.name : "墨印を選ぶ";
    const state = document.createElement("span");
    state.textContent = entry ? entry.stateLabel : "地図上の墨印を選ぶと、既知情報をここに開く。";
    const terrain = document.createElement("em");
    terrain.textContent = entry && entry.terrain && entry.terrain.length ? entry.terrain.join(" / ") : "粗い地勢だけが記録されている。";
    detail.append(kicker, title, state, terrain);
    return detail;
  }

  function appendLatestVisual(document, side, root, worldKnowledge) {
    const locationVisuals = root && root.CrownlessLocationVisuals;
    const resolved = locationVisuals && typeof locationVisuals.resolveLatestDiscoveredVisual === "function" ? locationVisuals.resolveLatestDiscoveredVisual(worldKnowledge) : null;
    const assetPath = resolved && resolved.visual ? cleanText(resolved.visual.assetPath) : "";
    if (!assetPath) return;
    const figure = document.createElement("figure");
    figure.className = "world-atlas-latest-visual";
    const image = document.createElement("img");
    image.src = assetPath;
    image.alt = cleanText(resolved.visual.alt, cleanText(resolved.entry && resolved.entry.name, "最新の発見地点"));
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.textContent = `最新の墨絵 · ${cleanText(resolved.entry && resolved.entry.name, "発見地点")}`;
    figure.append(image, caption);
    side.appendChild(figure);
  }

  function renderNearbySurface(document, body, model, root, worldKnowledge) {
    const map = document.createElement("div");
    map.className = "world-atlas-map world-atlas-map--nearby";
    map.setAttribute("role", "region");
    map.setAttribute("aria-label", `現在地を中心にした周辺探索図。発見地点 ${model.length} 件。`);

    const caption = document.createElement("div");
    caption.className = "world-atlas-nearby-caption";
    caption.innerHTML = "<small>NEARBY MANUSCRIPT</small><strong>現在地周辺</strong><span>約650m / 相対配置 / 線は経路ではない</span>";
    map.appendChild(caption);

    const ink = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ink.setAttribute("class", "world-atlas-nearby-ink");
    ink.setAttribute("viewBox", "0 0 100 100");
    ink.setAttribute("preserveAspectRatio", "none");
    ink.setAttribute("aria-hidden", "true");
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", "50");
    ring.setAttribute("cy", "50");
    ring.setAttribute("r", "34");
    ink.appendChild(ring);
    model.forEach((entry) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "50");
      line.setAttribute("y1", "50");
      line.setAttribute("x2", String(entry.x));
      line.setAttribute("y2", String(entry.y));
      ink.appendChild(line);
    });
    map.appendChild(ink);

    const current = document.createElement("span");
    current.className = "world-atlas-nearby-current";
    current.setAttribute("aria-label", "現在地");
    current.innerHTML = "<i></i><b>現在地</b>";
    map.appendChild(current);

    let detail = createDetail(document, model[0] || null);
    model.forEach((entry, index) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "world-atlas-nearby-marker";
      marker.style.left = `${entry.x}%`;
      marker.style.top = `${entry.y}%`;
      marker.dataset.labelHorizontal = entry.labelHorizontal;
      marker.dataset.labelVertical = entry.labelVertical;
      marker.setAttribute("aria-label", `${entry.name}。${entry.direction}、${entry.distanceBand}。${entry.stateLabel}。`);
      const glyph = document.createElement("i");
      glyph.textContent = entry.glyph;
      const number = document.createElement("small");
      number.textContent = String(index + 1).padStart(2, "0");
      const label = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = entry.shortName;
      const em = document.createElement("em");
      em.textContent = `${entry.direction} · ${entry.distanceBand}`;
      label.append(strong, em);
      marker.append(glyph, number, label);
      marker.addEventListener("click", () => {
        const next = createDetail(document, entry);
        detail.replaceWith(next);
        detail = next;
        Array.from(map.querySelectorAll(".world-atlas-nearby-marker")).forEach((node) => node.classList.toggle("active", node === marker));
      });
      map.appendChild(marker);
    });

    const side = document.createElement("aside");
    side.className = "world-atlas-side";
    side.appendChild(detail);
    appendLatestVisual(document, side, root, worldKnowledge);
    body.replaceChildren(map, side);
  }

  function renderWorldSurface(document, body, model, root, worldKnowledge) {
    const map = document.createElement("div");
    map.className = "world-atlas-map world-atlas-map--world";
    map.setAttribute("role", "region");
    map.setAttribute("aria-label", `探索済み領域 ${model.exploredCount}。未踏領域との境界と発見地点を示す粗い羊皮紙地図。`);

    if (!model.cells.length) {
      const blank = document.createElement("div");
      blank.className = "world-atlas-blank";
      blank.innerHTML = "<strong>まだ世界は書かれていない。</strong><span>現在地の周囲を調べたり、現実を歩いたりすると、ここに墨が増えていく。</span>";
      map.appendChild(blank);
    } else {
      model.cells.slice().sort((a, b) => Number(a.known) - Number(b.known)).forEach((entry) => {
        const cell = document.createElement("span");
        cell.className = `world-atlas-cell ${entry.known ? "known" : "unknown"}${entry.current ? " current" : ""}`;
        cell.style.left = `${entry.left}%`;
        cell.style.top = `${entry.top}%`;
        cell.style.width = `${entry.width}%`;
        cell.style.height = `${entry.height}%`;
        cell.setAttribute("aria-hidden", "true");
        map.appendChild(cell);
        if (entry.current) {
          const current = document.createElement("span");
          current.className = "world-atlas-current-cell-label";
          current.style.left = `${clamp(entry.left + entry.width / 2, 8, 92)}%`;
          current.style.top = `${clamp(entry.top + entry.height / 2, 8, 92)}%`;
          current.innerHTML = "<i></i><b>現在地の領域</b>";
          map.appendChild(current);
        }
      });
    }

    let detail = createDetail(document, model.discoveries[0] || model.unplacedDiscoveries[0] || null);
    model.discoveries.forEach((entry, index) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "world-atlas-marker";
      marker.style.left = `${entry.left}%`;
      marker.style.top = `${entry.top}%`;
      marker.dataset.state = entry.state;
      marker.setAttribute("aria-label", `${entry.name}。${entry.stateLabel}。`);
      const glyph = document.createElement("i");
      glyph.textContent = entry.glyph;
      const number = document.createElement("small");
      number.textContent = String(index + 1).padStart(2, "0");
      marker.append(glyph, number);
      marker.addEventListener("click", () => {
        const next = createDetail(document, entry);
        detail.replaceWith(next);
        detail = next;
        Array.from(map.querySelectorAll(".world-atlas-marker")).forEach((node) => node.classList.toggle("active", node === marker));
      });
      map.appendChild(marker);
    });

    const side = document.createElement("aside");
    side.className = "world-atlas-side";
    side.appendChild(detail);
    if (model.unplacedDiscoveries.length) {
      const unplaced = document.createElement("div");
      unplaced.className = "world-atlas-unplaced";
      const label = document.createElement("small");
      label.textContent = "UNANCHORED NOTES / 所在未確定";
      unplaced.appendChild(label);
      model.unplacedDiscoveries.slice(0, 6).forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = entry.name;
        button.addEventListener("click", () => {
          const next = createDetail(document, entry);
          detail.replaceWith(next);
          detail = next;
        });
        unplaced.appendChild(button);
      });
      side.appendChild(unplaced);
    }
    appendLatestVisual(document, side, root, worldKnowledge);
    body.replaceChildren(map, side);
  }

  function openAtlas(document, Core, root, options = {}) {
    if (!document || !Core || typeof Core.loadSafeState !== "function") return false;
    closeAtlas(document);
    ensureStylesheet(document);

    const safe = Core.loadSafeState();
    const runtimeCurrent = root && root.CrownlessExplorationCells && typeof root.CrownlessExplorationCells.currentCell === "function" ? root.CrownlessExplorationCells.currentCell() : null;
    const currentCell = options.scanResult && options.scanResult.currentCell ? options.scanResult.currentCell : runtimeCurrent;
    const worldModel = atlasViewModel(safe && safe.worldKnowledge, currentCell);
    const runtime = root && root.CrownlessLocationDiscoveryRuntime;
    const nearbyModel = nearbyViewModel(runtime, safe && safe.worldKnowledge, root && root.CrownlessExplorationMap);
    let selectedView = initialAtlasView(options.scanResult || lastScanResult, nearbyModel, options.view);
    let viewTouched = Boolean(options.view);

    const viewer = document.createElement("div");
    viewer.id = "world-atlas-viewer";
    viewer.className = "world-atlas-viewer";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Crownless 世界地図");

    const folio = document.createElement("section");
    folio.className = "world-atlas-folio";
    const header = document.createElement("header");
    header.className = "world-atlas-header";
    const heading = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "THE WRITTEN WORLD / WORLD ATLAS";
    const title = document.createElement("h2");
    title.textContent = "歩いて書いた世界";
    const summary = document.createElement("span");
    summary.textContent = `既知領域 ${worldModel.exploredCount} · 探索録 ${worldModel.discoveryCount}`;
    heading.append(eyebrow, title, summary);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "world-atlas-close";
    close.textContent = "閉じる ×";
    close.setAttribute("aria-label", "世界地図を閉じる");
    close.addEventListener("click", () => closeAtlas(document));
    header.append(heading, close);

    const scan = document.createElement("div");
    scan.className = `world-atlas-scan${options.scanning ? " scanning" : ""}`;
    scan.setAttribute("role", "status");
    scan.setAttribute("aria-live", "polite");
    const scanCopy = document.createElement("div");
    const scanKicker = document.createElement("small");
    scanKicker.textContent = "READING THE NEARBY WORLD / GPS";
    const scanText = document.createElement("span");
    scanText.textContent = scanResultText(options.scanResult, Boolean(options.scanning));
    scanCopy.append(scanKicker, scanText);
    const rescan = document.createElement("button");
    rescan.type = "button";
    rescan.textContent = "周辺を再調査";
    rescan.disabled = Boolean(options.scanning);
    scan.append(scanCopy, rescan);

    const toggle = document.createElement("div");
    toggle.className = "world-atlas-view-toggle";
    toggle.setAttribute("role", "tablist");
    toggle.setAttribute("aria-label", "地図表示を切り替える");
    const nearbyTab = document.createElement("button");
    nearbyTab.type = "button";
    nearbyTab.textContent = "周辺探索図";
    nearbyTab.disabled = nearbyModel.length === 0;
    const worldTab = document.createElement("button");
    worldTab.type = "button";
    worldTab.textContent = "世界Atlas";
    toggle.append(nearbyTab, worldTab);

    const body = document.createElement("div");
    body.className = "world-atlas-body";
    function renderSelectedView() {
      const nearby = selectedView === "nearby" && nearbyModel.length > 0;
      selectedView = nearby ? "nearby" : "world";
      nearbyTab.classList.toggle("active", selectedView === "nearby");
      worldTab.classList.toggle("active", selectedView === "world");
      nearbyTab.setAttribute("aria-selected", String(selectedView === "nearby"));
      worldTab.setAttribute("aria-selected", String(selectedView === "world"));
      if (selectedView === "nearby") renderNearbySurface(document, body, nearbyModel, root, safe && safe.worldKnowledge);
      else renderWorldSurface(document, body, worldModel, root, safe && safe.worldKnowledge);
    }
    nearbyTab.addEventListener("click", () => { viewTouched = true; selectedView = "nearby"; renderSelectedView(); });
    worldTab.addEventListener("click", () => { viewTouched = true; selectedView = "world"; renderSelectedView(); });
    renderSelectedView();

    const note = document.createElement("p");
    note.className = "world-atlas-note";
    note.textContent = "正確な道路図ではない。GPSは周囲の痕跡を見つけるためだけに使い、保存するのは粗い領域と探索録だけだ。";
    folio.append(header, scan, toggle, body, note);
    viewer.appendChild(folio);
    viewer.addEventListener("click", (event) => { if (event.target === viewer) closeAtlas(document); });
    viewer.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAtlas(document); });
    document.body.appendChild(viewer);
    document.body.classList.add("world-atlas-open");
    close.focus();

    function runScan(force) {
      if (!viewer.isConnected) return;
      rescan.disabled = true;
      scan.classList.add("scanning");
      scanText.textContent = scanResultText(null, true);
      Promise.resolve(scanNearby(Core, root, { force })).then((result) => {
        if (!viewer.isConnected || document.getElementById("world-atlas-viewer") !== viewer) return;
        openAtlas(document, Core, root, { autoScan: false, scanResult: result, view: force || viewTouched ? selectedView : undefined });
      });
    }

    rescan.addEventListener("click", () => runScan(true));
    if (options.autoScan !== false && !options.scanning) runScan(false);
    return true;
  }

  function install(document, Core, root) {
    if (!document || !Core || Core.__worldAtlasInstalled) return false;
    const wallMap = document.getElementById("hearth-map-focus");
    if (!wallMap) return false;
    ensureStylesheet(document);
    wallMap.setAttribute("aria-label", "現在地周辺を調べ、これまで歩いて書いた世界地図を開く");
    wallMap.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAtlas(document, Core, root);
    }, true);
    Core.__worldAtlasInstalled = true;
    return true;
  }

  return {
    CELL_PADDING,
    MAX_FRINGE_CELLS,
    SCAN_COOLDOWN_MS,
    NEARBY_LIMIT,
    NEARBY_RADIUS_METRES,
    MARKER_INSET_PERCENT,
    TERRAIN_GLYPHS,
    parseCellId,
    parseAreaId,
    areaCenterInCellSpace,
    terrainGlyph,
    discoveryStateLabel,
    atlasViewModel,
    relativeOffsetMeters,
    projectNearbyPoint,
    directionLabel,
    distanceBand,
    fallbackDiscoveryKey,
    nearbyViewModel,
    initialAtlasView,
    coarseAreaForDiscovery,
    rememberScannedDiscoveries,
    scanNearby,
    scanResultText,
    closeAtlas,
    openAtlas,
    install
  };
});
