(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessDiscoveryJournal = api;
  if (root && root.document) api.install(root.document, root.CrownlessCore, root.CrownlessLocationVisuals, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createDiscoveryJournalBrowser() {
  "use strict";

  const AREA_ZOOM = 14;
  const AREA_MAP_RADIUS = 2;

  const TERRAIN_LABELS = Object.freeze({
    water: "水辺",
    crossing: "渡り場",
    sacred: "聖域",
    woods: "森",
    road_hub: "街道の結節",
    height: "高地",
    coast: "海辺",
    settlement: "集落"
  });

  const KIND_LABELS = Object.freeze({
    dungeon: "遺構",
    encounter: "遭遇",
    combat: "戦場",
    event: "異変",
    cache: "物資",
    shrine: "聖所",
    traveler: "旅人"
  });

  const STATE_LABELS = Object.freeze({
    discovered: "発見済み",
    investigated: "調査済み",
    cleared: "踏破済み"
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
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

  function areaFromCellId(value, zoom = AREA_ZOOM) {
    const match = /^cell:(\d{1,2}):(\d+):(\d+)$/.exec(cleanText(value));
    if (!match) return null;
    const cellZoom = Number(match[1]);
    const cellX = Number(match[2]);
    const cellY = Number(match[3]);
    const targetZoom = Number(zoom);
    if (!Number.isInteger(cellZoom) || !Number.isInteger(targetZoom) || targetZoom < 1 || cellZoom < targetZoom || cellZoom > 22) return null;
    const cellSize = 2 ** cellZoom;
    if (!Number.isInteger(cellX) || !Number.isInteger(cellY) || cellX < 0 || cellY < 0 || cellX >= cellSize || cellY >= cellSize) return null;
    const factor = 2 ** (cellZoom - targetZoom);
    const x = Math.floor(cellX / factor);
    const y = Math.floor(cellY / factor);
    return { id: `area:${targetZoom}:${x}:${y}`, zoom: targetZoom, x, y };
  }

  function areaGoal(value, resolver) {
    const area = parseAreaId(value && typeof value === "object" ? value.id : value);
    if (!area) return 0;
    if (typeof resolver === "function") {
      const resolved = Number(resolver(area.id));
      if (Number.isInteger(resolved) && resolved > 0) return resolved;
    }
    const hash = ((area.x * 31) + (area.y * 17) + (area.zoom * 13)) >>> 0;
    return 5 + (hash % 3);
  }

  function journalEntries(worldKnowledge) {
    const discoveries = worldKnowledge && worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return [];
    return Object.values(discoveries)
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({ ...entry }))
      .sort((left, right) => (Number(right.firstDiscoveredAt) || 0) - (Number(left.firstDiscoveredAt) || 0));
  }

  function areaSummaries(worldKnowledge, goalResolver) {
    const byId = new Map();

    function ensure(area) {
      if (!area) return null;
      if (!byId.has(area.id)) {
        byId.set(area.id, {
          id: area.id,
          zoom: area.zoom,
          x: area.x,
          y: area.y,
          exploredCells: 0,
          discoveries: 0,
          lastRecordedAt: 0
        });
      }
      return byId.get(area.id);
    }

    const exploredCells = worldKnowledge && worldKnowledge.exploredCells;
    if (exploredCells && typeof exploredCells === "object" && !Array.isArray(exploredCells)) {
      Object.values(exploredCells).forEach((cell) => {
        const area = areaFromCellId(cell && typeof cell === "object" ? cell.id : cell);
        const summary = ensure(area);
        if (!summary) return;
        summary.exploredCells += 1;
        summary.lastRecordedAt = Math.max(summary.lastRecordedAt, Number(cell && cell.firstExploredAt) || 0);
      });
    }

    journalEntries(worldKnowledge).forEach((entry) => {
      const area = parseAreaId(entry.areaId);
      const summary = ensure(area);
      if (!summary) return;
      summary.discoveries += 1;
      summary.lastRecordedAt = Math.max(summary.lastRecordedAt, Number(entry.firstDiscoveredAt) || 0);
    });

    return Array.from(byId.values())
      .map((summary) => {
        const goal = areaGoal(summary.id, goalResolver);
        const progress = Math.min(summary.discoveries, goal);
        return {
          ...summary,
          goal,
          progress,
          complete: goal > 0 && summary.discoveries >= goal,
          known: summary.exploredCells > 0 || summary.discoveries > 0
        };
      })
      .sort((left, right) => right.lastRecordedAt - left.lastRecordedAt || left.y - right.y || left.x - right.x);
  }

  function defaultAreaId(worldKnowledge) {
    const newestMappedDiscovery = journalEntries(worldKnowledge).find((entry) => parseAreaId(entry.areaId));
    if (newestMappedDiscovery) return parseAreaId(newestMappedDiscovery.areaId).id;
    const summaries = areaSummaries(worldKnowledge);
    return summaries.length ? summaries[0].id : "";
  }

  function areaWindowModel(worldKnowledge, centerAreaId, radius = AREA_MAP_RADIUS, goalResolver) {
    const center = parseAreaId(centerAreaId || defaultAreaId(worldKnowledge));
    if (!center) return [];
    const normalizedRadius = Math.max(1, Math.min(4, Math.floor(Number(radius) || AREA_MAP_RADIUS)));
    const summaries = new Map(areaSummaries(worldKnowledge, goalResolver).map((summary) => [summary.id, summary]));
    const size = 2 ** center.zoom;
    const cells = [];
    for (let offsetY = -normalizedRadius; offsetY <= normalizedRadius; offsetY += 1) {
      for (let offsetX = -normalizedRadius; offsetX <= normalizedRadius; offsetX += 1) {
        const x = center.x + offsetX;
        const y = center.y + offsetY;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const id = `area:${center.zoom}:${x}:${y}`;
        const summary = summaries.get(id) || null;
        cells.push({
          id,
          zoom: center.zoom,
          x,
          y,
          offsetX,
          offsetY,
          known: Boolean(summary && summary.known),
          discoveries: summary ? summary.discoveries : 0,
          progress: summary ? summary.progress : 0,
          goal: summary ? summary.goal : areaGoal(id, goalResolver),
          complete: Boolean(summary && summary.complete),
          exploredCells: summary ? summary.exploredCells : 0
        });
      }
    }
    return cells;
  }

  function entriesForArea(entries, areaId) {
    const area = parseAreaId(areaId);
    if (!area) return Array.isArray(entries) ? entries.slice() : [];
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const mapped = parseAreaId(entry && entry.areaId);
      return Boolean(mapped && mapped.id === area.id);
    });
  }

  function entryViewModel(entry, LocationVisuals) {
    const source = entry && typeof entry === "object" ? entry : {};
    const terrain = Array.isArray(source.terrain)
      ? source.terrain.map((item) => cleanText(item)).filter(Boolean)
      : [];
    const visual = LocationVisuals && typeof LocationVisuals.resolveLocationVisual === "function"
      ? LocationVisuals.resolveLocationVisual(source)
      : null;
    const area = parseAreaId(source.areaId);
    return {
      key: cleanText(source.key),
      name: cleanText(source.name, "名もない発見"),
      state: cleanText(source.state, "discovered"),
      stateLabel: STATE_LABELS[cleanText(source.state)] || cleanText(source.state, "発見済み"),
      contentKind: cleanText(source.contentKind, "unknown"),
      kindLabel: KIND_LABELS[cleanText(source.contentKind)] || "不明な気配",
      terrain,
      terrainLabel: terrain.length ? terrain.map((item) => TERRAIN_LABELS[item] || item).join(" / ") : "地形不明",
      visits: Math.max(1, Number(source.visits) || 1),
      firstDiscoveredAt: Math.max(0, Number(source.firstDiscoveredAt) || 0),
      areaId: area ? area.id : "",
      visual
    };
  }

  function formatDiscoveryDate(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return "記録時刻不明";
    try {
      return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
    } catch (_) {
      return "記録時刻不明";
    }
  }

  function ensureStylesheet(document, href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    document.head.appendChild(stylesheet);
  }

  function install(document, Core, LocationVisuals, root) {
    if (!document || !Core || Core.__discoveryJournalBrowserInstalled) return false;
    const map = document.getElementById("hearth-map-focus");
    if (!map || typeof Core.loadSafeState !== "function") return false;

    ensureStylesheet(document, "discovery-journal-browser.css");
    let previousFocus = null;

    function closeBrowser() {
      const viewer = document.getElementById("discovery-journal-browser");
      if (viewer) viewer.remove();
      document.body.classList.remove("discovery-journal-open");
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
      previousFocus = null;
    }

    function renderDetail(detail, entry) {
      const model = entryViewModel(entry, LocationVisuals);
      detail.innerHTML = "";

      const media = document.createElement("div");
      media.className = `discovery-journal-media${model.visual ? " has-visual" : ""}`;
      if (model.visual) {
        const image = document.createElement("img");
        image.src = cleanText(model.visual.assetPath);
        image.alt = cleanText(model.visual.alt, model.name);
        image.decoding = "async";
        image.addEventListener("error", () => {
          media.classList.remove("has-visual");
          image.remove();
        }, { once: true });
        media.appendChild(image);
      }
      const seal = document.createElement("span");
      seal.className = "discovery-journal-seal";
      seal.textContent = model.visual ? "RECORDED VIEW" : "NO ILLUSTRATION";
      media.appendChild(seal);

      const copy = document.createElement("div");
      copy.className = "discovery-journal-detail-copy";
      const eyebrow = document.createElement("p");
      eyebrow.className = "discovery-journal-eyebrow";
      eyebrow.textContent = "DISCOVERED PLACE / 探索録";
      const title = document.createElement("h2");
      title.textContent = model.name;
      const meta = document.createElement("div");
      meta.className = "discovery-journal-meta";
      for (const [label, value] of [
        ["状態", model.stateLabel],
        ["種別", model.kindLabel],
        ["地形", model.terrainLabel],
        ["訪問", `${model.visits}回`],
        ["初回", formatDiscoveryDate(model.firstDiscoveredAt)],
        ["区画", model.areaId ? "探索地図に記録" : "旧記録"]
      ]) {
        const row = document.createElement("div");
        const term = document.createElement("span");
        const data = document.createElement("strong");
        term.textContent = label;
        data.textContent = value;
        row.append(term, data);
        meta.appendChild(row);
      }
      const note = document.createElement("p");
      note.className = "discovery-journal-note";
      note.textContent = model.visits > 1
        ? "一度きりの噂ではない。あなたはここへ戻り、この場所を確かな記憶にした。"
        : "見つけた場所は、敗れても地図から消えない。";
      copy.append(eyebrow, title, meta, note);
      detail.append(media, copy);
    }

    function renderEmptyDetail(detail, selectedAreaId) {
      detail.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "discovery-journal-empty";
      const emptyTitle = document.createElement("strong");
      emptyTitle.textContent = selectedAreaId ? "この区画には、まだ発見がない。" : "探索録はまだ白紙だ。";
      const emptyCopy = document.createElement("p");
      emptyCopy.textContent = selectedAreaId
        ? "歩いて区画を探り、痕跡を見つけると達成度が埋まっていく。"
        : "霧の外へ出て場所を見つけると、ここから過去の発見を読み返せる。";
      empty.append(emptyTitle, emptyCopy);
      detail.appendChild(empty);
    }

    function openBrowser() {
      closeBrowser();
      previousFocus = document.activeElement;
      const safe = Core.loadSafeState();
      const worldKnowledge = safe && safe.worldKnowledge ? safe.worldKnowledge : {};
      const entries = journalEntries(worldKnowledge);
      const areas = areaSummaries(worldKnowledge, Core.explorationAreaGoal);
      const areaById = new Map(areas.map((area) => [area.id, area]));
      const centerAreaId = defaultAreaId(worldKnowledge);
      let selectedAreaId = "";

      const viewer = document.createElement("div");
      viewer.id = "discovery-journal-browser";
      viewer.className = "discovery-journal-browser";
      viewer.setAttribute("role", "dialog");
      viewer.setAttribute("aria-modal", "true");
      viewer.setAttribute("aria-label", "探索録を見る");

      const folio = document.createElement("section");
      folio.className = "discovery-journal-folio";

      const header = document.createElement("header");
      header.className = "discovery-journal-header";
      const heading = document.createElement("div");
      const kicker = document.createElement("small");
      kicker.textContent = "WORLD KNOWLEDGE / DISCOVERY JOURNAL";
      const title = document.createElement("h1");
      title.textContent = "探索録";
      const count = document.createElement("span");
      count.textContent = `${entries.length} PLACES`;
      heading.append(kicker, title);
      header.append(heading, count);

      const close = document.createElement("button");
      close.type = "button";
      close.className = "discovery-journal-close";
      close.textContent = "閉じる ×";
      close.setAttribute("aria-label", "探索録を閉じる");
      close.addEventListener("click", closeBrowser);

      const areaOverview = document.createElement("section");
      areaOverview.className = "discovery-area-overview";
      areaOverview.setAttribute("aria-label", "探索済みエリアの簡易地図");

      const body = document.createElement("div");
      body.className = "discovery-journal-body";
      const list = document.createElement("nav");
      list.className = "discovery-journal-list";
      list.setAttribute("aria-label", "探索済みの場所");
      const detail = document.createElement("article");
      detail.className = "discovery-journal-detail";
      detail.setAttribute("aria-live", "polite");

      function renderList() {
        list.innerHTML = "";
        detail.innerHTML = "";
        const visibleEntries = entriesForArea(entries, selectedAreaId);

        if (!visibleEntries.length) {
          const listEmpty = document.createElement("div");
          listEmpty.className = "discovery-journal-list-empty";
          listEmpty.textContent = selectedAreaId ? "この区画の発見はまだない。" : "まだ発見はない。";
          list.appendChild(listEmpty);
          renderEmptyDetail(detail, selectedAreaId);
          return;
        }

        visibleEntries.forEach((entry, index) => {
          const model = entryViewModel(entry, LocationVisuals);
          const button = document.createElement("button");
          button.type = "button";
          button.className = `discovery-journal-entry${index === 0 ? " selected" : ""}`;
          button.dataset.discoveryKey = model.key;
          const entryTitle = document.createElement("strong");
          entryTitle.textContent = model.name;
          const entryMeta = document.createElement("span");
          entryMeta.textContent = `${model.kindLabel} · ${model.visits}回${model.visual ? " · ◈" : ""}`;
          button.append(entryTitle, entryMeta);
          button.addEventListener("click", () => {
            list.querySelectorAll(".discovery-journal-entry.selected").forEach((node) => node.classList.remove("selected"));
            button.classList.add("selected");
            renderDetail(detail, entry);
          });
          list.appendChild(button);
        });
        renderDetail(detail, visibleEntries[0]);
      }

      function renderAreaOverview() {
        areaOverview.innerHTML = "";
        const copy = document.createElement("div");
        copy.className = "discovery-area-copy";
        const mapKicker = document.createElement("small");
        mapKicker.textContent = "KNOWN AREAS / COARSE MAP";
        const mapTitle = document.createElement("strong");
        mapTitle.textContent = "探索地図";
        const completed = areas.filter((area) => area.complete).length;
        const mapStatus = document.createElement("span");
        mapStatus.textContent = areas.length
          ? `${completed}/${areas.length} 区画踏破 · 発見を埋めると COMPLETE`
          : "歩いた場所が、粗い区画としてここに残る。";
        const all = document.createElement("button");
        all.type = "button";
        all.className = `discovery-area-all${selectedAreaId ? "" : " selected"}`;
        all.textContent = "すべての探索録";
        all.addEventListener("click", () => {
          selectedAreaId = "";
          renderAreaOverview();
          renderList();
        });
        copy.append(mapKicker, mapTitle, mapStatus, all);

        const mapWrap = document.createElement("div");
        mapWrap.className = "discovery-area-map-wrap";
        const grid = document.createElement("div");
        grid.className = "discovery-area-map";
        grid.setAttribute("role", "group");
        grid.setAttribute("aria-label", "探索済み区画。中央付近を基準にした粗い相対地図");
        const mapCells = areaWindowModel(worldKnowledge, centerAreaId, AREA_MAP_RADIUS, Core.explorationAreaGoal);

        if (mapCells.length) {
          mapCells.forEach((area) => {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = `discovery-area-cell${area.known ? " known" : " unknown"}${area.complete ? " complete" : ""}${selectedAreaId === area.id ? " selected" : ""}`;
            cell.disabled = !area.known;
            cell.dataset.areaId = area.id;
            if (area.known) {
              const mark = document.createElement("span");
              mark.textContent = area.complete ? "✓" : "•";
              const progress = document.createElement("strong");
              progress.textContent = `${area.progress}/${area.goal}`;
              const label = document.createElement("small");
              label.textContent = area.complete ? "COMPLETE" : "FOUND";
              cell.append(mark, progress, label);
              cell.setAttribute("aria-label", `探索済み区画。発見 ${area.progress}/${area.goal}${area.complete ? "。踏破済み" : ""}`);
              cell.addEventListener("click", () => {
                selectedAreaId = area.id;
                renderAreaOverview();
                renderList();
              });
            } else {
              cell.textContent = "·";
              cell.setAttribute("aria-label", "未踏の区画");
            }
            grid.appendChild(cell);
          });
        } else {
          const blank = document.createElement("div");
          blank.className = "discovery-area-map-empty";
          blank.textContent = "まだ地図に残る区画がない。";
          grid.appendChild(blank);
        }

        const legend = document.createElement("p");
        legend.className = "discovery-area-legend";
        legend.textContent = "z16探索セルを16枚ずつ束ねた粗い区画。正確な移動経路は保存しない。";
        mapWrap.append(grid, legend);
        areaOverview.append(copy, mapWrap);
      }

      if (!entries.length && !areas.length) body.classList.add("empty");
      renderAreaOverview();
      renderList();

      body.append(list, detail);
      folio.append(header, areaOverview, body, close);
      viewer.appendChild(folio);
      viewer.addEventListener("click", (event) => {
        if (event.target === viewer) closeBrowser();
      });
      viewer.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeBrowser();
      });

      document.body.appendChild(viewer);
      document.body.classList.add("discovery-journal-open");
      requestAnimationFrame(() => viewer.classList.add("show"));
      close.focus();
      return true;
    }

    map.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBrowser();
    }, true);

    Core.__discoveryJournalBrowserInstalled = true;
    api.open = openBrowser;
    api.close = closeBrowser;
    return true;
  }

  const api = {
    AREA_ZOOM,
    AREA_MAP_RADIUS,
    TERRAIN_LABELS,
    KIND_LABELS,
    STATE_LABELS,
    parseAreaId,
    areaFromCellId,
    areaGoal,
    areaSummaries,
    defaultAreaId,
    areaWindowModel,
    entriesForArea,
    journalEntries,
    entryViewModel,
    formatDiscoveryDate,
    install,
    open: () => false,
    close: () => {}
  };

  return api;
});