(() => {
  "use strict";
  const Core = window.CrownlessCore;
  const Discovery = window.CrownlessDiscovery;
  const GeographyApi = window.CrownlessGeographyApi;
  if (!Core || !Discovery || !GeographyApi) return;

  const originalCreateInitialState = typeof Core.createInitialState === "function" ? Core.createInitialState.bind(Core) : null;
  const originalDiscoverLocation = Core.discoverLocation.bind(Core);
  const originalBeginExpedition = typeof Core.beginExpedition === "function" ? Core.beginExpedition.bind(Core) : null;
  const originalContinueExpedition = typeof Core.continueExpedition === "function" ? Core.continueExpedition.bind(Core) : null;
  const GEOLOCATION_OPTIONS = Object.freeze({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  const TERRAIN_LABELS = Object.freeze({ water: "水辺", crossing: "渡り場", sacred: "聖域", woods: "森", road_hub: "街道の結節", height: "高地", coast: "海辺", settlement: "集落" });
  const QA_WATCHTOWER_MODE = (() => {
    try { return new URLSearchParams(window.location.search).get("qa") === "watchtower"; }
    catch (_) { return false; }
  })();
  let geographicDiscoveries = [], locationState = "idle", locationPromise = null, knowledgeToastTimer = null;

  function emptyDiagnostics(gps = "idle") { return { gps, gpsCode: null, gpsName: "", gpsMessage: "", gpsElapsedMs: null, gpsOptions: Object.assign({}, GEOLOCATION_OPTIONS), osm: "idle", endpoint: "-", attempt: 0, total: 0, httpStatus: null, discoveries: 0, features: [], names: [], error: "" }; }
  let diagnostics = emptyDiagnostics();

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cleanText(value, fallback = "") { const result = String(value == null ? "" : value).trim(); return result || fallback; }
  function escapeHtml(value) { return cleanText(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  function safeTerrain(value) { return Array.isArray(value) ? [...new Set(value.map((item) => cleanText(item)).filter(Boolean))].slice(0, 8) : []; }

  function ensureWorldKnowledge(state) {
    if (!state || typeof state !== "object") return state;
    if (Core.sanitizeWorldKnowledge) state.worldKnowledge = Core.sanitizeWorldKnowledge(state.worldKnowledge);
    else if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
    if (!state.worldKnowledge.discoveries || typeof state.worldKnowledge.discoveries !== "object" || Array.isArray(state.worldKnowledge.discoveries)) state.worldKnowledge.discoveries = {};
    return state;
  }

  function geographicIdentity(discovery) {
    if (!discovery || typeof discovery !== "object") return null;
    if (discovery.geographicDiscovery && typeof discovery.geographicDiscovery === "object") return discovery.geographicDiscovery;
    if (discovery.sourceRef) return discovery;
    return null;
  }

  function geographicRuleSignature(discovery) {
    const features = safeTerrain(discovery && discovery.features).sort();
    const kind = cleanText(discovery && discovery.contentKind, "unknown");
    return `${kind}:${features.length ? features.join("+") : "unknown"}`;
  }

  function worldKnowledgeKey(discovery) {
    const geographic = geographicIdentity(discovery);
    if (geographic) {
      const sourceRef = cleanText(geographic.sourceRef);
      if (!sourceRef) return null;
      return `geo:${sourceRef}:${geographicRuleSignature(geographic)}`;
    }
    const locationId = cleanText(discovery && discovery.locationId);
    return locationId ? `sim:${locationId}` : null;
  }

  function worldKnowledgeEntry(discovery, key, now) {
    const geographic = geographicIdentity(discovery) || {};
    const timestamp = Number(now);
    return {
      key,
      name: cleanText(discovery && discovery.name, cleanText(geographic.title, "名もない発見")),
      baseTitle: cleanText(geographic.baseTitle),
      terrain: safeTerrain(geographic.features),
      contentKind: cleanText(geographic.contentKind, cleanText(discovery && discovery.eventKind, "unknown")),
      state: "discovered",
      firstDiscoveredAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      visits: 1
    };
  }

  function getKnowledgeData(state) {
    ensureWorldKnowledge(state);
    const discoveries = Object.values(state && state.worldKnowledge ? state.worldKnowledge.discoveries : {})
      .map((entry) => clone(entry))
      .sort((left, right) => (right.firstDiscoveredAt || 0) - (left.firstDiscoveredAt || 0));
    return { count: discoveries.length, discoveries };
  }

  function injectKnowledgeStyles() {
    if (document.getElementById("world-knowledge-styles")) return;
    const style = document.createElement("style");
    style.id = "world-knowledge-styles";
    style.textContent = `
      .world-knowledge-panel { margin:16px 0 0; padding:16px 18px; }
      .world-knowledge-head { display:flex; justify-content:space-between; gap:16px; align-items:end; margin-bottom:10px; }
      .world-knowledge-head h2 { margin:0; }
      .world-knowledge-count { text-align:right; }
      .world-knowledge-count small { display:block; color:var(--dim); font-size:8px; letter-spacing:.12em; }
      .world-knowledge-count strong { color:var(--gold-2); font:34px/1 Georgia,serif; font-weight:400; }
      .world-knowledge-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      .world-knowledge-entry { padding:9px 10px; border-left:1px solid rgba(185,154,85,.42); background:rgba(185,154,85,.035); min-width:0; }
      .world-knowledge-entry small { display:block; color:var(--dim); font-size:8px; letter-spacing:.08em; }
      .world-knowledge-entry strong { display:block; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:14px/1.35 Georgia,serif; font-weight:500; }
      .world-knowledge-empty { color:var(--muted); font-size:10px; line-height:1.5; }
      .lead-knowledge-badge { display:inline-flex; align-items:center; margin-left:7px; padding:2px 5px; border:1px solid rgba(185,154,85,.38); color:#b9a26d; background:rgba(185,154,85,.04); font-size:8px; letter-spacing:.08em; vertical-align:middle; }
      .lead-card.discovery-known { border-color:rgba(185,154,85,.28); }
      .world-knowledge-toast { position:fixed; z-index:1200; left:50%; bottom:max(24px,env(safe-area-inset-bottom)); width:min(88vw,360px); transform:translate(-50%,18px); padding:11px 14px; border:1px solid rgba(185,154,85,.55); background:rgba(24,20,14,.96); box-shadow:0 12px 36px rgba(0,0,0,.35); opacity:0; pointer-events:none; transition:opacity .18s ease,transform .18s ease; }
      .world-knowledge-toast.show { opacity:1; transform:translate(-50%,0); }
      .world-knowledge-toast small,.world-knowledge-toast span { display:block; color:#a99b7d; font-size:8px; line-height:1.4; }
      .world-knowledge-toast strong { display:block; margin:3px 0; color:#e3cf9a; font:16px/1.3 Georgia,serif; font-weight:500; }
      @media (max-width:560px) { .world-knowledge-list { grid-template-columns:1fr; } .world-knowledge-panel { padding:14px; } }
      @media (prefers-reduced-motion:reduce) { .world-knowledge-toast { transition:none; } }
    `;
    document.head.appendChild(style);
  }

  function ensureKnowledgePanel() {
    injectKnowledgeStyles();
    let panel = document.getElementById("world-knowledge-panel");
    if (panel) return panel;
    const hub = document.getElementById("hub-screen");
    const grid = hub && hub.querySelector(".hub-grid");
    if (!hub || !grid) return null;
    panel = document.createElement("section");
    panel.id = "world-knowledge-panel";
    panel.className = "panel world-knowledge-panel";
    hub.insertBefore(panel, grid);
    return panel;
  }

  function renderWorldKnowledge(state) {
    if (!state) return;
    const panel = ensureKnowledgePanel();
    if (!panel) return;
    const data = getKnowledgeData(state);
    const recent = data.discoveries.slice(0, 4);
    panel.innerHTML = `
      <div class="world-knowledge-head">
        <div><p class="eyebrow">DISCOVERY JOURNAL / WORLD KNOWLEDGE</p><h2>探索録</h2></div>
        <div class="world-knowledge-count"><small>DISCOVERED</small><strong id="world-knowledge-count">${data.count}</strong></div>
      </div>
      ${recent.length
        ? `<div class="world-knowledge-list">${recent.map((entry) => `<div class="world-knowledge-entry"><small>${escapeHtml(entry.state).toUpperCase()} · VISIT ${entry.visits}</small><strong>${escapeHtml(entry.name)}</strong></div>`).join("")}</div>`
        : `<div class="world-knowledge-empty">まだ白紙だ。現実の周囲から何かを見つけると、ここに墨印が残る。</div>`}
    `;
  }

  function showNewDiscovery(entry) {
    if (!entry) return;
    let toast = document.getElementById("world-knowledge-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "world-knowledge-toast";
      toast.className = "world-knowledge-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<small>NEW DISCOVERY / 探索録</small><strong>${escapeHtml(entry.name)}</strong><span>羊皮紙に新しい墨印が残った。</span>`;
    toast.classList.add("show");
    clearTimeout(knowledgeToastTimer);
    knowledgeToastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function recordWorldKnowledge(next, now = Date.now()) {
    const last = next && next.expedition && next.expedition.lastDiscovery;
    if (!last) return next;
    ensureWorldKnowledge(next);
    const key = worldKnowledgeKey(last);
    if (!key) return next;

    const previous = next.worldKnowledge.discoveries[key] || null;
    const incoming = worldKnowledgeEntry(last, key, now);
    const entry = previous
      ? {
          ...previous,
          name: incoming.name,
          baseTitle: incoming.baseTitle || previous.baseTitle,
          terrain: incoming.terrain.length ? incoming.terrain : previous.terrain,
          contentKind: incoming.contentKind !== "unknown" ? incoming.contentKind : previous.contentKind,
          visits: Math.max(1, Number(previous.visits) || 1) + 1
        }
      : incoming;

    next.worldKnowledge.discoveries[key] = entry;
    last.discoveryKey = key;
    last.isNewDiscovery = !previous;
    if (Array.isArray(next.expedition.discoveries)) {
      const history = next.expedition.discoveries.find((item) => item && item.id === last.id);
      if (history) {
        history.discoveryKey = key;
        history.isNewDiscovery = !previous;
      }
    }
    if (Core.saveWorldKnowledge) Core.saveWorldKnowledge(next);
    renderWorldKnowledge(next);
    if (!previous) showNewDiscovery(entry);
    return next;
  }

  function knownKnowledgeKeys() {
    if (!Core.loadSafeState) return new Set();
    const safe = Core.loadSafeState();
    ensureWorldKnowledge(safe);
    return new Set(Object.keys(safe && safe.worldKnowledge ? safe.worldKnowledge.discoveries : {}));
  }

  function classifyGeolocationError(error) { const code = Number(error && error.code) || 0; if (code === 1) return { code, name: "PERMISSION_DENIED", state: "denied" }; if (code === 2) return { code, name: "POSITION_UNAVAILABLE", state: "unavailable" }; if (code === 3) return { code, name: "TIMEOUT", state: "timeout" }; return { code, name: "UNKNOWN", state: "error" }; }
  function createQaWatchtowerDiscovery() {
    return {
      id: "qa-ruined-watchtower",
      title: "QA固定候補の崩れた物見台",
      baseTitle: "崩れた物見台",
      realPlaceName: "QA固定候補",
      signal: "高みの輪郭に、崩れた石組みが空を切っている。",
      risk: 3,
      palette: "road",
      contentKind: "dungeon",
      revealState: "signal",
      features: ["height"],
      sourceRef: "qa:ruined-watchtower",
      representativeCoordinate: null,
      mapOrigin: null,
      qaInjected: true
    };
  }
  function ensureQaWatchtowerDiscoveries(discoveries) {
    const source = Array.isArray(discoveries) ? discoveries.slice() : [];
    if (!QA_WATCHTOWER_MODE) return source;
    const existingIndex = source.findIndex((item) => item && item.baseTitle === "崩れた物見台");
    const watchtower = existingIndex >= 0 ? source.splice(existingIndex, 1)[0] : createQaWatchtowerDiscovery();
    return [watchtower, ...source].slice(0, 3);
  }
  function applyQaDiagnostics(error) {
    diagnostics.discoveries = geographicDiscoveries.length;
    diagnostics.features = ["height"];
    diagnostics.names = ["QA固定候補"];
    if (error) diagnostics.error = `QA override: ${error && error.message ? error.message : String(error)}`;
  }
  function statusText() { if (QA_WATCHTOWER_MODE && locationState === "loading") return "QAモード：崩れた物見台を候補に固定する。実地データの照合も並行している。"; if (QA_WATCHTOWER_MODE && locationState === "ready") return "QAモード：崩れた物見台を先頭候補に固定中。出現率とは別のE2E確認用。"; if (locationState === "loading") return "現在地の周囲に、道と水辺の痕跡を探している。通常の探索はそのまま始められる。"; if (locationState === "ready") return "現実で見つけた場所から、次の探索先を選べる。"; if (locationState === "denied") return "位置情報を使えないため、通常の探索候補を表示する。"; if (locationState === "failed") return "地理情報を読めなかったため、通常の探索候補を表示する。"; return ""; }
  function endpointLabel(endpoint) { if (!endpoint || endpoint === "-") return "-"; try { return new URL(endpoint).host; } catch (_) { return endpoint; } }
  function diagnosticText() { const osmDetail = diagnostics.endpoint && diagnostics.endpoint !== "-" ? `${diagnostics.osm}@${endpointLabel(diagnostics.endpoint)}` : diagnostics.osm || "-"; const gpsDetail = diagnostics.gpsCode ? `${diagnostics.gps}(${diagnostics.gpsCode}:${diagnostics.gpsName})` : diagnostics.gps; const parts = [`GPS:${gpsDetail}`, `OSM:${osmDetail}`, `発見:${diagnostics.discoveries}`]; if (QA_WATCHTOWER_MODE) parts.unshift("QA:watchtower"); if (diagnostics.gpsElapsedMs !== null) parts.push(`GPS時間:${diagnostics.gpsElapsedMs}ms`); if (diagnostics.gpsOptions) parts.push(`GPS設定:high=${diagnostics.gpsOptions.enableHighAccuracy},timeout=${diagnostics.gpsOptions.timeout},age=${diagnostics.gpsOptions.maximumAge}`); if (diagnostics.gpsMessage) parts.push(`GPS詳細:${diagnostics.gpsMessage}`); if (diagnostics.attempt && diagnostics.total) parts.push(`試行:${diagnostics.attempt}/${diagnostics.total}`); if (diagnostics.httpStatus) parts.push(`HTTP:${diagnostics.httpStatus}`); if (diagnostics.features.length) parts.push(`地形:${diagnostics.features.join("/")}`); if (diagnostics.names.length) parts.push(`地名:${diagnostics.names.join("/")}`); if (diagnostics.error) parts.push(`ERROR:${diagnostics.error}`); return parts.join(" ｜ "); }
  function terrainLabel(discovery) { const features = Array.isArray(discovery && discovery.features) ? discovery.features : []; const labels = features.map((feature) => TERRAIN_LABELS[feature] || feature); return labels.length ? labels.join(" / ") : "街道周辺"; }
  function contentKindLabel(discovery) { if (!discovery) return "気配"; if (discovery.contentKind === "dungeon") return "遺構"; if (discovery.contentKind === "encounter") return "遭遇"; return "異変"; }
  function ensureSearchPresentation(marker) { let search = document.getElementById("location-discovery-search"); if (search) return search; search = document.createElement("div"); search.id = "location-discovery-search"; search.className = "location-discovery-search"; search.setAttribute("role", "status"); search.setAttribute("aria-live", "polite"); search.innerHTML = `<div class="location-discovery-ink" aria-hidden="true"><i></i><i></i><i></i><b></b></div><div class="location-discovery-search-copy"><small>READING THE NEARBY WORLD</small><strong>現実の痕跡を照合中</strong><span>水辺、古い道、集落の気配を羊皮紙へ写している。</span></div>`; marker.insertAdjacentElement("beforebegin", search); return search; }
  function showLocationStatus() { const exploreScreen = document.getElementById("explore-screen"); if (!exploreScreen) return; let marker = document.getElementById("location-discovery-status"); if (!marker) { marker = document.createElement("div"); marker.id = "location-discovery-status"; marker.className = "location-discovery-status"; const warning = document.getElementById("carried-warning"); if (warning && warning.parentNode) warning.parentNode.insertBefore(marker, warning.nextSibling); else exploreScreen.prepend(marker); } const search = ensureSearchPresentation(marker); const searching = locationState === "loading"; search.hidden = !searching; search.setAttribute("aria-hidden", String(!searching)); marker.textContent = statusText(); marker.style.display = marker.textContent ? "block" : "none"; marker.style.margin = "6px 0 10px"; marker.style.padding = "5px 8px"; marker.style.borderLeft = "1px solid rgba(185,154,85,.55)"; marker.style.background = "rgba(185,154,85,0.035)"; marker.style.fontSize = "10px"; marker.style.lineHeight = "1.45"; marker.style.opacity = "0.68"; let details = document.getElementById("location-discovery-diagnostics"); if (!details) { details = document.createElement("details"); details.id = "location-discovery-diagnostics"; details.className = "location-discovery-diagnostics"; const summary = document.createElement("summary"); summary.textContent = "位置情報の診断"; const body = document.createElement("div"); body.className = "location-discovery-diagnostics-body"; details.append(summary, body); marker.insertAdjacentElement("afterend", details); } const body = details.querySelector(".location-discovery-diagnostics-body"); if (body) body.textContent = diagnosticText(); details.style.margin = "-6px 0 10px"; details.style.fontSize = "9px"; details.style.lineHeight = "1.45"; details.style.opacity = "0.55"; details.style.overflowWrap = "anywhere"; }
  function syncExplorationSource() { const presentation = window.CrownlessExplorationMap; if (!presentation || typeof presentation.setDiscoverySource !== "function") return; presentation.setDiscoverySource(document, QA_WATCHTOWER_MODE ? "simulated" : (locationState === "ready" && geographicDiscoveries.length ? "geographic" : "simulated")); }
  function setPendingUi() { const leadList = document.getElementById("lead-list"); if (leadList) { leadList.style.display = ""; leadList.setAttribute("aria-busy", String(locationState === "loading")); } syncExplorationSource(); showLocationStatus(); }
  function setRiskPips(card, risk) { const pips = card ? Array.from(card.querySelectorAll(".pips.risk i")) : []; pips.forEach((pip, index) => pip.classList.toggle("on", index < Math.max(1, Math.min(5, Number(risk) || 1)))); }

  function markKnowledge(card, discovery, knownKeys) {
    if (!card) return;
    const key = discovery ? worldKnowledgeKey(discovery) : null;
    const known = Boolean(key && knownKeys.has(key));
    card.dataset.knowledgeState = known ? "known" : "new";
    card.classList.toggle("discovery-known", known);
    const title = card.querySelector("h3");
    let badge = card.querySelector(".lead-knowledge-badge");
    if (!known) { if (badge) badge.remove(); return; }
    if (!badge && title) {
      badge = document.createElement("span");
      badge.className = "lead-knowledge-badge";
      title.appendChild(badge);
    }
    if (badge) badge.textContent = "既知";
  }

  function refreshLeadCards() { const leadList = document.getElementById("lead-list"); if (!leadList) return; const cards = Array.from(leadList.querySelectorAll(".lead-card")); const hasGeographicChoices = locationState === "ready" && geographicDiscoveries.length > 0; const knownKeys = knownKnowledgeKeys(); cards.forEach((card, index) => { const discovery = geographicDiscoveries[index] || null; card.style.display = hasGeographicChoices && !discovery ? "none" : ""; card.dataset.discoverySource = discovery ? (discovery.qaInjected ? "qa" : "geographic") : "simulated"; if (!discovery) { markKnowledge(card, null, knownKeys); return; } const title = card.querySelector("h3"), description = card.querySelector("p"), omen = card.querySelector(".lead-omen"), signal = card.querySelector(".lead-signals label strong"); if (title) title.textContent = discovery.title; if (description) description.textContent = discovery.signal; if (omen) omen.textContent = `地形：${terrainLabel(discovery)}`; if (signal) signal.textContent = contentKindLabel(discovery); setRiskPips(card, discovery.risk); card.className = `lead-card palette-${discovery.palette === "water" ? "marsh" : discovery.palette} discovery-ready`; markKnowledge(card, discovery, knownKeys); }); }
  function choiceSlot(state, choiceId) {
    try {
      const choices = Core.generateExplorationChoices(state);
      const index = Array.isArray(choices) ? choices.findIndex((choice) => choice && choice.choiceId === choiceId) : -1;
      if (index >= 0) return index;
    } catch (_) {}
    const parts = String(choiceId || "").split(":");
    const slot = Number(parts[parts.length - 1]);
    return Number.isInteger(slot) && slot >= 0 ? slot : 0;
  }
  function enrichDiscovery(target, geographic) { if (!target || !geographic) return target; target.name = geographic.title; target.flavor = geographic.signal; target.omen = `地形：${terrainLabel(geographic)}`; target.risk = Math.max(Number(target.risk) || 1, Number(geographic.risk) || 1); target.palette = geographic.palette === "water" ? "marsh" : geographic.palette; target.signal = contentKindLabel(geographic); target.geographicDiscovery = JSON.parse(JSON.stringify(geographic)); target.geographicTerrain = terrainLabel(geographic); target.realPlaceName = geographic.realPlaceName || ""; return target; }
  function applySelectedGeographicDiscovery(next, slot) { if (!next || !next.expedition || !geographicDiscoveries.length) return next; const geographic = geographicDiscoveries[slot]; if (!geographic) return next; const exp = next.expedition, last = exp.lastDiscovery; enrichDiscovery(last, geographic); if (last && Array.isArray(exp.discoveries)) { const history = exp.discoveries.find((item) => item && item.id === last.id); if (history && history !== last) enrichDiscovery(history, geographic); } if (exp.encounter && exp.encounter.discovery) enrichDiscovery(exp.encounter.discovery, geographic); if (exp.pendingEvent && exp.pendingEvent.discovery) enrichDiscovery(exp.pendingEvent.discovery, geographic); return next; }
  Core.discoverLocation = function discoverLocationWithGeography(state, choiceId) { const slot = choiceSlot(state, choiceId); return recordWorldKnowledge(applySelectedGeographicDiscovery(originalDiscoverLocation(state, choiceId), slot)); };

  function getCurrentLocation() { if (!navigator.geolocation) return Promise.reject(new Error("geolocation unavailable")); diagnostics.gps = "requesting"; diagnostics.gpsOptions = Object.assign({}, GEOLOCATION_OPTIONS); const startedAt = performance.now(); showLocationStatus(); return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => { diagnostics.gps = "ok"; diagnostics.gpsElapsedMs = Math.round(performance.now() - startedAt); showLocationStatus(); resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }); }, (error) => { const classified = classifyGeolocationError(error); diagnostics.gps = classified.state; diagnostics.gpsCode = classified.code; diagnostics.gpsName = classified.name; diagnostics.gpsMessage = error && error.message ? error.message : ""; diagnostics.gpsElapsedMs = Math.round(performance.now() - startedAt); showLocationStatus(); reject(error); }, GEOLOCATION_OPTIONS)); }
  function applyProviderStatus(status) { diagnostics.osm = status && status.state ? status.state : diagnostics.osm; diagnostics.endpoint = status && status.endpoint ? status.endpoint : diagnostics.endpoint; diagnostics.attempt = Number(status && status.attempt) || 0; diagnostics.total = Number(status && status.total) || diagnostics.total || 0; diagnostics.httpStatus = status && status.httpStatus ? status.httpStatus : null; diagnostics.error = status && status.state === "failed" ? (status.error || (status.timedOut ? "timeout" : "failed")) : ""; if (status && status.state === "success") { diagnostics.discoveries = Number(status.discoveries) || 0; diagnostics.features = Array.isArray(status.features) ? status.features.slice() : []; diagnostics.names = Array.isArray(status.names) ? status.names.slice() : []; } showLocationStatus(); }
  async function performGeographicDiscovery() { let provider = null; try { const location = await getCurrentLocation(); provider = GeographyApi.createProxyLocationDiscoveryProvider({ limit: 3, radius: 650, timeoutMs: 22000, endpoint: window.CROWNLESS_GEOGRAPHY_API || GeographyApi.DEFAULT_PROXY_ENDPOINT, onStatus: applyProviderStatus }); const discovered = await provider.discover({ location }); geographicDiscoveries = ensureQaWatchtowerDiscoveries(discovered); diagnostics.endpoint = provider.endpoint || diagnostics.endpoint || "unknown"; diagnostics.discoveries = geographicDiscoveries.length; diagnostics.features = [...new Set(geographicDiscoveries.flatMap((item) => item.features || []))]; diagnostics.names = [...new Set(geographicDiscoveries.map((item) => item.realPlaceName).filter(Boolean))]; locationState = geographicDiscoveries.length ? "ready" : "failed"; if (!geographicDiscoveries.length) diagnostics.error = "no matching discoveries"; } catch (error) { if (QA_WATCHTOWER_MODE) { geographicDiscoveries = ensureQaWatchtowerDiscoveries([]); locationState = "ready"; diagnostics.endpoint = provider && provider.endpoint ? provider.endpoint : diagnostics.endpoint || "-"; applyQaDiagnostics(error); } else { geographicDiscoveries = []; locationState = error && error.code === 1 ? "denied" : "failed"; diagnostics.endpoint = provider && provider.endpoint ? provider.endpoint : diagnostics.endpoint || "-"; diagnostics.error = provider && provider.error ? provider.error : (error && error.message ? error.message : "unknown error"); if (diagnostics.gps === "ok" && diagnostics.osm === "idle") diagnostics.osm = "failed"; } } return geographicDiscoveries; }
  function beginGeographicDiscoveryAfterPaint() { return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))).then(performGeographicDiscovery); }
  function loadGeographicDiscoveries() { if (locationPromise) return locationPromise; locationState = "loading"; diagnostics = emptyDiagnostics("requesting"); setPendingUi(); locationPromise = beginGeographicDiscoveryAfterPaint(); return locationPromise; }
  function reloadGeographicDiscoveries() { locationPromise = null; geographicDiscoveries = []; const discovery = loadGeographicDiscoveries(); discovery.finally(() => { if (!document.getElementById("explore-screen")?.classList.contains("active")) return; refreshLeadCards(); setPendingUi(); }); return discovery; }
  function restoreGeographicPresentationAfterRender() { if (locationState !== "ready" || !geographicDiscoveries.length) return; Promise.resolve().then(() => { if (!document.getElementById("explore-screen")?.classList.contains("active")) return; refreshLeadCards(); setPendingUi(); }); }

  if (originalCreateInitialState) { Core.createInitialState = function createInitialStateWithWorldKnowledge(...args) { const next = originalCreateInitialState(...args); ensureWorldKnowledge(next); Promise.resolve().then(() => renderWorldKnowledge(next)); return next; }; }
  if (originalBeginExpedition) { Core.beginExpedition = function beginExpeditionWithLocationDiscovery(...args) { const next = originalBeginExpedition(...args); ensureWorldKnowledge(next); reloadGeographicDiscoveries(); return next; }; }
  if (originalContinueExpedition) { Core.continueExpedition = function continueExpeditionWithLocationDiscovery(...args) { const next = originalContinueExpedition(...args); ensureWorldKnowledge(next); restoreGeographicPresentationAfterRender(); return next; }; }

  window.CrownlessLocationDiscoveryRuntime = {
    get state() { return locationState; },
    get discoveries() { return geographicDiscoveries.slice(); },
    get diagnostics() { return Object.assign({}, diagnostics, { gpsOptions: Object.assign({}, diagnostics.gpsOptions), features: diagnostics.features.slice(), names: diagnostics.names.slice() }); },
    get qaMode() { return QA_WATCHTOWER_MODE ? "watchtower" : ""; },
    classifyGeolocationError,
    terrainLabel,
    choiceSlot,
    worldKnowledgeKey,
    getKnowledgeData,
    recordWorldKnowledge,
    applySelectedGeographicDiscovery,
    createQaWatchtowerDiscovery,
    ensureQaWatchtowerDiscoveries,
    reload: reloadGeographicDiscoveries
  };
})();