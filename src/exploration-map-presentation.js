(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationMap = api;
  if (root && root.document) api.install(root.document, root.CrownlessDiscovery, root.CrownlessLocationDiscoveryRuntime);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExplorationPresentation() {
  "use strict";

  const DESTINATION_LIMIT = 3;
  const MAP_RADIUS_METRES = 650;
  const DISCOVERY_SOURCE_LABELS = {
    simulated: "DISCOVERED NEARBY / SIMULATED LOCATION",
    geographic: "DISCOVERED NEARBY / REAL-WORLD DISCOVERY"
  };
  const TERRAIN_LABELS = {
    water: "水辺",
    crossing: "渡り場",
    sacred: "聖域",
    woods: "森",
    road_hub: "街道の結節",
    height: "高地",
    coast: "海辺",
    settlement: "集落"
  };
  const TERRAIN_GLYPHS = {
    water: "≈",
    crossing: "×",
    sacred: "✣",
    woods: "♧",
    road_hub: "⌘",
    height: "⌃",
    coast: "≋",
    settlement: "▦"
  };
  const installedRefreshers = typeof WeakMap === "function" ? new WeakMap() : null;

  function riskFromCard(card) {
    return card ? card.querySelectorAll(".pips.risk i.on").length : 1;
  }

  function extractDestination(card, index) {
    const paletteClass = card ? Array.from(card.classList).find((name) => name.startsWith("palette-")) : null;
    return {
      id: card && card.dataset && card.dataset.choiceId ? card.dataset.choiceId : `lead-${index + 1}`,
      title: card && card.querySelector("h3") ? card.querySelector("h3").textContent.trim() : "名もない気配",
      signal: card && card.querySelector(".lead-signals label strong") ? card.querySelector(".lead-signals label strong").textContent.trim() : "気配",
      risk: Math.max(1, riskFromCard(card)),
      palette: paletteClass ? paletteClass.replace("palette-", "") : "road",
      card
    };
  }

  function selectDestinations(cards, Discovery) {
    const leads = Array.from(cards || []).map(extractDestination);
    if (Discovery && typeof Discovery.createSimulatedDiscoveryProvider === "function") {
      const provider = Discovery.createSimulatedDiscoveryProvider({ limit: DESTINATION_LIMIT });
      return provider.discover({ leads }).map((place) => place.source);
    }
    return leads.slice(0, DESTINATION_LIMIT);
  }

  function setDiscoverySource(document, source) {
    const heading = document && document.getElementById("discovered-destinations-heading");
    const eyebrow = heading && heading.querySelector(".eyebrow");
    if (!heading || !eyebrow) return false;
    const normalized = source === "geographic" ? "geographic" : "simulated";
    const changed = heading.dataset.discoverySource !== normalized;
    heading.dataset.discoverySource = normalized;
    eyebrow.textContent = DISCOVERY_SOURCE_LABELS[normalized];
    if (changed && installedRefreshers && installedRefreshers.has(document)) installedRefreshers.get(document)();
    return true;
  }

  function discoverySourceFromRuntime(runtime) {
    return runtime && runtime.state === "ready" && Array.isArray(runtime.discoveries) && runtime.discoveries.length
      ? "geographic"
      : "simulated";
  }

  function terrainLabel(discovery) {
    const features = Array.isArray(discovery && discovery.features) ? discovery.features : [];
    const labels = features.map((feature) => TERRAIN_LABELS[feature] || feature);
    return labels.length ? labels.join(" / ") : "街道周辺";
  }

  function contentKindLabel(discovery) {
    if (!discovery) return "気配";
    if (discovery.contentKind === "dungeon") return "遺構";
    if (discovery.contentKind === "encounter") return "遭遇";
    return "異変";
  }

  function setRiskPips(card, risk) {
    const pips = card ? Array.from(card.querySelectorAll(".pips.risk i")) : [];
    const level = Math.max(1, Math.min(5, Number(risk) || 1));
    pips.forEach((pip, index) => pip.classList.toggle("on", index < level));
  }

  function applyGeographicDiscoveries(cards, runtime) {
    const discoveries = runtime && runtime.state === "ready" && Array.isArray(runtime.discoveries)
      ? runtime.discoveries
      : [];
    if (!discoveries.length) return false;

    Array.from(cards || []).forEach((card, index) => {
      const discovery = discoveries[index] || null;
      card.style.display = discovery ? "" : "none";
      card.dataset.discoverySource = discovery ? "geographic" : "simulated";
      if (!discovery) return;

      const title = card.querySelector("h3");
      const description = card.querySelector("p");
      const omen = card.querySelector(".lead-omen");
      const signal = card.querySelector(".lead-signals label strong");
      if (title) title.textContent = discovery.title;
      if (description) description.textContent = discovery.signal;
      if (omen) omen.textContent = `地形：${terrainLabel(discovery)}`;
      if (signal) signal.textContent = contentKindLabel(discovery);
      setRiskPips(card, discovery.risk);
      card.className = `lead-card palette-${discovery.palette === "water" ? "marsh" : discovery.palette} discovery-ready`;
    });
    return true;
  }

  function validCoordinate(point) {
    const latitude = Number(point && point.latitude);
    const longitude = Number(point && point.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
      ? { latitude, longitude }
      : null;
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function projectDiscoveryPoint(origin, point, radius = MAP_RADIUS_METRES) {
    const offset = relativeOffsetMeters(origin, point);
    if (!offset) return null;
    const scale = Math.max(100, Number(radius) || MAP_RADIUS_METRES);
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

  function terrainGlyph(discovery) {
    const features = Array.isArray(discovery && discovery.features) ? discovery.features : [];
    const feature = features.find((item) => TERRAIN_GLYPHS[item]);
    return feature ? TERRAIN_GLYPHS[feature] : "·";
  }

  function sketchMapModelFromRuntime(runtime) {
    if (!runtime || runtime.state !== "ready" || !Array.isArray(runtime.discoveries)) return [];
    return runtime.discoveries.slice(0, DESTINATION_LIMIT).map((discovery, index) => {
      const origin = validCoordinate(discovery && discovery.mapOrigin);
      const point = validCoordinate(discovery && discovery.representativeCoordinate);
      const projected = projectDiscoveryPoint(origin, point);
      if (!projected) return null;
      return {
        index,
        id: discovery.id || `geo-${index + 1}`,
        title: String(discovery.realPlaceName || discovery.baseTitle || discovery.title || "名もない地点"),
        glyph: terrainGlyph(discovery),
        terrain: terrainLabel(discovery),
        direction: directionLabel(projected),
        distanceBand: distanceBand(projected.distance),
        x: projected.x,
        y: projected.y
      };
    }).filter(Boolean);
  }

  function sketchMapLabelLayout(model) {
    const entries = Array.from(model || []);
    return entries.map((entry, index) => {
      const x = Number(entry && entry.x);
      const y = Number(entry && entry.y);
      const horizontal = Number.isFinite(x) && x <= 28
        ? "inset-left"
        : Number.isFinite(x) && x >= 72
          ? "inset-right"
          : "center";
      const baseVertical = Number.isFinite(y) && y >= 68 ? "above" : "below";
      const nearbyBefore = entries.slice(0, index).filter((other) => {
        const otherX = Number(other && other.x);
        const otherY = Number(other && other.y);
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(otherX) && Number.isFinite(otherY)
          && Math.abs(otherX - x) < 24
          && Math.abs(otherY - y) < 22;
      }).length;
      const vertical = nearbyBefore % 2 === 1
        ? (baseVertical === "above" ? "below" : "above")
        : baseVertical;
      const labelShiftY = nearbyBefore >= 2 ? (vertical === "above" ? -12 : 12) : 0;
      return { ...entry, labelHorizontal: horizontal, labelVertical: vertical, labelShiftY };
    });
  }

  function ensureSketchMap(document, heading) {
    let map = document.getElementById("exploration-sketch-map");
    if (map) return map;
    map = document.createElement("section");
    map.id = "exploration-sketch-map";
    map.className = "exploration-sketch-map";
    map.hidden = true;
    map.setAttribute("aria-label", "現在地を中心にした周囲の簡易探索図");
    map.innerHTML = `
      <div class="sketch-map-heading">
        <div><p class="eyebrow">NEARBY MANUSCRIPT / RELATIVE DISCOVERY</p><strong>周囲の探索図</strong></div>
        <span>現在地中心 / 相対配置 / 縮尺なし</span>
      </div>
      <div class="sketch-map-field" aria-label="発見地点の相対配置">
        <svg class="sketch-map-ink" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M8 62 C24 50 31 57 45 44 S71 33 92 42" />
          <path d="M19 18 C30 31 31 43 25 79" />
          <path d="M61 12 C56 27 63 41 78 57 S84 79 77 92" />
          <circle cx="50" cy="50" r="33" />
        </svg>
        <span class="sketch-current" aria-label="現在地"><i></i><b>現在地</b></span>
        <div class="sketch-map-points"></div>
      </div>`;
    heading.insertAdjacentElement("afterend", map);
    return map;
  }

  function setActiveSketchPoint(map, index) {
    if (!map) return;
    const normalized = String(index);
    Array.from(map.querySelectorAll(".sketch-map-point")).forEach((point) => point.classList.toggle("active", point.dataset.cardIndex === normalized));
  }

  function bindCardPoint(document, card, index) {
    if (!card || !card.dataset) return;
    card.dataset.sketchPointIndex = String(index);
    if (card.dataset.sketchPointBound === "true" || typeof card.addEventListener !== "function") return;
    card.dataset.sketchPointBound = "true";
    const activate = () => setActiveSketchPoint(document.getElementById("exploration-sketch-map"), card.dataset.sketchPointIndex);
    card.addEventListener("focus", activate);
    card.addEventListener("pointerenter", activate);
  }

  function renderSketchMap(document, runtime, cards, heading) {
    const map = ensureSketchMap(document, heading);
    const model = sketchMapLabelLayout(sketchMapModelFromRuntime(runtime));
    map.hidden = model.length === 0;
    const points = map.querySelector(".sketch-map-points");
    if (!points) return model;
    points.innerHTML = "";
    if (!model.length) return model;

    model.forEach((entry) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "sketch-map-point";
      marker.dataset.cardIndex = String(entry.index);
      marker.dataset.labelHorizontal = entry.labelHorizontal;
      marker.dataset.labelVertical = entry.labelVertical;
      marker.style.left = `${entry.x}%`;
      marker.style.top = `${entry.y}%`;
      marker.style.setProperty("--sketch-label-shift-y", `${entry.labelShiftY}px`);
      marker.setAttribute("aria-label", `${entry.title}。${entry.terrain}。${entry.direction}、${entry.distanceBand}`);

      const glyph = document.createElement("i");
      glyph.className = "sketch-map-glyph";
      glyph.textContent = entry.glyph;
      const number = document.createElement("small");
      number.textContent = `0${entry.index + 1}`;
      const label = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = entry.title;
      const detail = document.createElement("em");
      detail.textContent = entry.direction;
      label.append(title, detail);
      marker.append(glyph, number, label);
      marker.addEventListener("pointerenter", () => setActiveSketchPoint(map, entry.index));
      marker.addEventListener("focus", () => setActiveSketchPoint(map, entry.index));
      marker.addEventListener("click", () => {
        const card = Array.from(cards || [])[entry.index];
        if (!card) return;
        setActiveSketchPoint(map, entry.index);
        if (typeof card.focus === "function") card.focus({ preventScroll: true });
        if (typeof card.scrollIntoView === "function") card.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      points.appendChild(marker);

      const card = Array.from(cards || [])[entry.index];
      bindCardPoint(document, card, entry.index);
    });
    setActiveSketchPoint(map, model[0].index);
    return model;
  }

  function install(document, Discovery, locationRuntime) {
    if (!document || document.getElementById("discovered-destinations-heading")) return;
    const leadList = document.getElementById("lead-list");
    const exploreScreen = document.getElementById("explore-screen");
    if (!leadList || !exploreScreen) return;

    const style = document.createElement("style");
    style.id = "discovered-destinations-styles";
    style.textContent = `
      #expedition-route { display:none !important; }
      .discovered-destinations-heading { margin:18px 0 10px; padding:14px 16px; border-left:2px solid var(--gold); background:rgba(201,163,93,.055); }
      .discovered-destinations-heading .eyebrow { margin:0 0 5px; }
      .discovered-destinations-heading strong { display:block; font-family:Georgia,serif; font-size:21px; }
      .discovered-destinations-heading span { display:block; margin-top:5px; color:var(--muted); font-size:11px; line-height:1.55; }
      .lead-card.discovery-hidden { display:none !important; }
      .lead-card.discovery-ready { box-shadow:inset 0 0 0 1px rgba(201,163,93,.12); }
      .exploration-sketch-map { margin:0 0 12px; padding:10px; border:1px solid rgba(201,163,93,.22); background:linear-gradient(114deg,rgba(224,207,171,.07),transparent 58%),repeating-linear-gradient(3deg,rgba(235,221,190,.018) 0 1px,transparent 1px 9px); }
      .exploration-sketch-map[hidden] { display:none !important; }
      .sketch-map-heading { display:flex; align-items:end; justify-content:space-between; gap:12px; padding:2px 4px 9px; border-bottom:1px solid rgba(201,163,93,.13); }
      .sketch-map-heading .eyebrow { margin:0 0 2px; font-size:8px; }
      .sketch-map-heading strong { font-family:Georgia,serif; font-size:17px; font-weight:500; }
      .sketch-map-heading > span { color:var(--muted); font-size:9px; letter-spacing:.04em; }
      .sketch-map-field { position:relative; height:220px; overflow:hidden; margin-top:7px; background:radial-gradient(circle at 50% 50%,rgba(88,119,102,.08),transparent 34%),radial-gradient(circle at 18% 24%,rgba(201,163,93,.035),transparent 28%); isolation:isolate; }
      .sketch-map-field::before,.sketch-map-field::after { content:""; position:absolute; z-index:-1; opacity:.12; pointer-events:none; }
      .sketch-map-field::before { left:50%; top:8%; bottom:8%; border-left:1px dashed var(--gold); transform:rotate(2deg); }
      .sketch-map-field::after { left:8%; right:8%; top:50%; border-top:1px dashed var(--gold); transform:rotate(-1deg); }
      .sketch-map-ink { position:absolute; inset:0; width:100%; height:100%; opacity:.15; fill:none; stroke:#c9a35d; stroke-width:.55; stroke-dasharray:1.8 2.4; vector-effect:non-scaling-stroke; pointer-events:none; }
      .sketch-map-ink circle { stroke-dasharray:1 4; opacity:.55; }
      .sketch-current { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); display:grid; place-items:center; z-index:2; color:#e8d7ad; font-size:9px; text-align:center; }
      .sketch-current i { width:13px; height:13px; border:2px solid #d7b66b; border-radius:48% 52% 44% 56%; background:#1b1914; box-shadow:0 0 0 5px rgba(201,163,93,.08); }
      .sketch-current b { margin-top:5px; font-weight:600; letter-spacing:.06em; }
      .sketch-map-point { position:absolute; z-index:3; min-width:34px; min-height:34px; padding:0; border:0; background:transparent; color:inherit; transform:translate(-50%,-50%); cursor:pointer; text-align:center; }
      .sketch-map-point .sketch-map-glyph { display:grid; place-items:center; width:31px; height:31px; margin:auto; border:1px solid rgba(201,163,93,.52); border-radius:45% 55% 49% 51%; background:#12110e; color:#d7bd7d; font:normal 18px/1 Georgia,serif; box-shadow:0 0 0 3px rgba(8,8,7,.7); transform:rotate(-3deg); transition:transform .14s ease,border-color .14s ease,background .14s ease; }
      .sketch-map-point small { position:absolute; left:calc(50% + 13px); top:-7px; color:#a98d54; font-size:7px; font-weight:800; letter-spacing:.08em; }
      .sketch-map-point span { position:absolute; left:50%; top:37px; width:max-content; max-width:128px; transform:translate(-50%,var(--sketch-label-shift-y,0)); padding:3px 5px; background:rgba(11,10,8,.78); pointer-events:none; }
      .sketch-map-point[data-label-horizontal="inset-left"] span { left:0; transform:translate(0,var(--sketch-label-shift-y,0)); text-align:left; }
      .sketch-map-point[data-label-horizontal="inset-right"] span { left:auto; right:0; transform:translate(0,var(--sketch-label-shift-y,0)); text-align:right; }
      .sketch-map-point[data-label-vertical="above"] span { top:auto; bottom:37px; }
      .sketch-map-point strong,.sketch-map-point em { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sketch-map-point strong { max-width:118px; color:#e4d6b5; font:600 9px/1.25 Georgia,serif; }
      .sketch-map-point em { margin-top:1px; max-width:118px; color:var(--muted); font:normal 7px/1.3 sans-serif; }
      .sketch-map-point.active .sketch-map-glyph,.sketch-map-point:focus-visible .sketch-map-glyph { border-color:#d5b25f; background:rgba(78,96,77,.62); transform:rotate(2deg) scale(1.13); outline:1px solid rgba(215,178,95,.28); outline-offset:3px; }
      .sketch-map-point.active span { background:rgba(24,25,20,.94); }
      @media (max-width:760px) {
        .discovered-destinations-heading { margin-top:12px; }
        .discovered-destinations-heading strong { font-size:19px; }
        .exploration-sketch-map { padding:8px; }
        .sketch-map-heading { align-items:start; }
        .sketch-map-heading strong { font-size:15px; }
        .sketch-map-heading > span { max-width:105px; text-align:right; font-size:8px; }
        .sketch-map-field { height:190px; }
        .sketch-map-point span { max-width:98px; }
        .sketch-map-point strong,.sketch-map-point em { max-width:90px; }
        .lead-card.discovery-ready h3 { max-width:100%; font-size:15px; line-height:1.35; text-wrap:balance; }
      }
      @media (prefers-reduced-motion:reduce) {
        .sketch-map-point .sketch-map-glyph { transition:none; }
      }
    `;
    document.head.appendChild(style);

    const heading = document.createElement("div");
    heading.id = "discovered-destinations-heading";
    heading.className = "discovered-destinations-heading";
    heading.innerHTML = `
      <p class="eyebrow"></p>
      <strong>歩くのは現実。ここでは、どこへ挑むかを選ぶ。</strong>
      <span>見つかった場所から一つ選べ。地図を一歩ずつ進める必要はない。</span>`;
    leadList.parentNode.insertBefore(heading, leadList);
    ensureSketchMap(document, heading);

    let scheduled = false;
    function refresh() {
      scheduled = false;
      if (!exploreScreen.classList.contains("active")) return;
      setDiscoverySource(document, discoverySourceFromRuntime(locationRuntime));
      const cards = Array.from(leadList.querySelectorAll(".lead-card"));
      if (!cards.length) return;
      applyGeographicDiscoveries(cards, locationRuntime);
      const destinations = selectDestinations(cards, Discovery);
      const visibleCards = new Set(destinations.map((destination) => destination.card).filter(Boolean));
      cards.forEach((card) => {
        const visible = visibleCards.has(card);
        card.classList.toggle("discovery-hidden", !visible);
        card.classList.toggle("discovery-ready", visible);
      });
      renderSketchMap(document, locationRuntime, cards, heading);
    }

    function scheduleRefresh() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(refresh);
    }

    if (installedRefreshers) installedRefreshers.set(document, scheduleRefresh);
    setDiscoverySource(document, discoverySourceFromRuntime(locationRuntime));

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(leadList, { childList: true, subtree: false });
    document.getElementById("start-expedition")?.addEventListener("click", scheduleRefresh, true);
    document.getElementById("continue-expedition")?.addEventListener("click", scheduleRefresh, true);
    document.getElementById("return-again")?.addEventListener("click", scheduleRefresh, true);
    scheduleRefresh();
  }

  return {
    DESTINATION_LIMIT,
    MAP_RADIUS_METRES,
    DISCOVERY_SOURCE_LABELS,
    TERRAIN_GLYPHS,
    extractDestination,
    selectDestinations,
    setDiscoverySource,
    discoverySourceFromRuntime,
    terrainLabel,
    contentKindLabel,
    applyGeographicDiscoveries,
    relativeOffsetMeters,
    projectDiscoveryPoint,
    directionLabel,
    distanceBand,
    terrainGlyph,
    sketchMapModelFromRuntime,
    sketchMapLabelLayout,
    renderSketchMap,
    install
  };
});