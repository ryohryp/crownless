(() => {
  "use strict";
  const Core = window.CrownlessCore;
  const Discovery = window.CrownlessDiscovery;
  const GeographyApi = window.CrownlessGeographyApi;
  if (!Core || !Discovery || !GeographyApi) return;

  const originalDiscoverLocation = Core.discoverLocation.bind(Core);
  const GEOLOCATION_OPTIONS = Object.freeze({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  const TERRAIN_LABELS = Object.freeze({ water: "水辺", crossing: "渡り場", sacred: "聖域", woods: "森", road_hub: "街道の結節", height: "高地", coast: "海辺", settlement: "集落" });

  let geographicDiscoveries = [];
  let locationState = "idle";
  let locationPromise = null;

  function emptyDiagnostics(gps = "idle") {
    return { gps, gpsCode: null, gpsName: "", gpsMessage: "", gpsElapsedMs: null, gpsOptions: Object.assign({}, GEOLOCATION_OPTIONS), osm: "idle", endpoint: "-", attempt: 0, total: 0, httpStatus: null, discoveries: 0, features: [], names: [], error: "" };
  }

  let diagnostics = emptyDiagnostics();

  function classifyGeolocationError(error) {
    const code = Number(error && error.code) || 0;
    if (code === 1) return { code, name: "PERMISSION_DENIED", state: "denied" };
    if (code === 2) return { code, name: "POSITION_UNAVAILABLE", state: "unavailable" };
    if (code === 3) return { code, name: "TIMEOUT", state: "timeout" };
    return { code, name: "UNKNOWN", state: "error" };
  }

  function statusText() {
    if (locationState === "loading") return "現在地を照合中。通常の探索はそのまま始められる。";
    if (locationState === "ready") return "現実で見つけた場所から、次の探索先を選べる。";
    if (locationState === "denied") return "位置情報を使えないため、通常の探索候補を表示する。";
    if (locationState === "failed") return "地理情報を読めなかったため、通常の探索候補を表示する。";
    return "";
  }

  function endpointLabel(endpoint) {
    if (!endpoint || endpoint === "-") return "-";
    try { return new URL(endpoint).host; } catch (_) { return endpoint; }
  }

  function diagnosticText() {
    const osmDetail = diagnostics.endpoint && diagnostics.endpoint !== "-" ? `${diagnostics.osm}@${endpointLabel(diagnostics.endpoint)}` : diagnostics.osm || "-";
    const gpsDetail = diagnostics.gpsCode ? `${diagnostics.gps}(${diagnostics.gpsCode}:${diagnostics.gpsName})` : diagnostics.gps;
    const parts = [`GPS:${gpsDetail}`, `OSM:${osmDetail}`, `発見:${diagnostics.discoveries}`];
    if (diagnostics.gpsElapsedMs !== null) parts.push(`GPS時間:${diagnostics.gpsElapsedMs}ms`);
    if (diagnostics.gpsOptions) parts.push(`GPS設定:high=${diagnostics.gpsOptions.enableHighAccuracy},timeout=${diagnostics.gpsOptions.timeout},age=${diagnostics.gpsOptions.maximumAge}`);
    if (diagnostics.gpsMessage) parts.push(`GPS詳細:${diagnostics.gpsMessage}`);
    if (diagnostics.attempt && diagnostics.total) parts.push(`試行:${diagnostics.attempt}/${diagnostics.total}`);
    if (diagnostics.httpStatus) parts.push(`HTTP:${diagnostics.httpStatus}`);
    if (diagnostics.features.length) parts.push(`地形:${diagnostics.features.join("/")}`);
    if (diagnostics.names.length) parts.push(`地名:${diagnostics.names.join("/")}`);
    if (diagnostics.error) parts.push(`ERROR:${diagnostics.error}`);
    return parts.join(" ｜ ");
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

  function showLocationStatus() {
    const exploreScreen = document.getElementById("explore-screen");
    if (!exploreScreen) return;
    let marker = document.getElementById("location-discovery-status");
    if (!marker) {
      marker = document.createElement("div");
      marker.id = "location-discovery-status";
      marker.className = "location-discovery-status";
      const warning = document.getElementById("carried-warning");
      if (warning && warning.parentNode) warning.parentNode.insertBefore(marker, warning.nextSibling);
      else exploreScreen.prepend(marker);
    }
    marker.textContent = statusText();
    marker.style.display = marker.textContent ? "block" : "none";
    marker.style.margin = "6px 0 10px";
    marker.style.padding = "5px 8px";
    marker.style.borderLeft = "1px solid rgba(185,154,85,.55)";
    marker.style.background = "rgba(185,154,85,0.035)";
    marker.style.fontSize = "10px";
    marker.style.lineHeight = "1.45";
    marker.style.opacity = "0.68";

    let details = document.getElementById("location-discovery-diagnostics");
    if (!details) {
      details = document.createElement("details");
      details.id = "location-discovery-diagnostics";
      details.className = "location-discovery-diagnostics";
      const summary = document.createElement("summary");
      summary.textContent = "位置情報の診断";
      const body = document.createElement("div");
      body.className = "location-discovery-diagnostics-body";
      details.append(summary, body);
      marker.insertAdjacentElement("afterend", details);
    }
    const body = details.querySelector(".location-discovery-diagnostics-body");
    if (body) body.textContent = diagnosticText();
    details.style.margin = "-6px 0 10px";
    details.style.fontSize = "9px";
    details.style.lineHeight = "1.45";
    details.style.opacity = "0.55";
    details.style.overflowWrap = "anywhere";
  }

  function syncExplorationSource() {
    const presentation = window.CrownlessExplorationMap;
    if (!presentation || typeof presentation.setDiscoverySource !== "function") return;
    presentation.setDiscoverySource(document, locationState === "ready" && geographicDiscoveries.length ? "geographic" : "simulated");
  }

  function setPendingUi() {
    const leadList = document.getElementById("lead-list");
    if (leadList) { leadList.style.display = ""; leadList.setAttribute("aria-busy", String(locationState === "loading")); }
    syncExplorationSource();
    showLocationStatus();
  }

  function setRiskPips(card, risk) { const pips = card ? Array.from(card.querySelectorAll(".pips.risk i")) : []; pips.forEach((pip, index) => pip.classList.toggle("on", index < Math.max(1, Math.min(5, Number(risk) || 1)))); }

  function refreshLeadCards() {
    const leadList = document.getElementById("lead-list"); if (!leadList) return;
    const cards = Array.from(leadList.querySelectorAll(".lead-card"));
    const hasGeographicChoices = locationState === "ready" && geographicDiscoveries.length > 0;
    cards.forEach((card, index) => {
      const discovery = geographicDiscoveries[index] || null;
      card.style.display = hasGeographicChoices && !discovery ? "none" : "";
      card.dataset.discoverySource = discovery ? "geographic" : "simulated";
      if (!discovery) return;
      const title = card.querySelector("h3"), description = card.querySelector("p"), omen = card.querySelector(".lead-omen"), signal = card.querySelector(".lead-signals label strong");
      if (title) title.textContent = discovery.title; if (description) description.textContent = discovery.signal; if (omen) omen.textContent = `地形：${terrainLabel(discovery)}`; if (signal) signal.textContent = contentKindLabel(discovery);
      setRiskPips(card, discovery.risk); card.className = `lead-card palette-${discovery.palette === "water" ? "marsh" : discovery.palette} discovery-ready`;
    });
  }

  function choiceSlot(choiceId) { const parts = String(choiceId || "").split(":"); const slot = Number(parts[parts.length - 1]); return Number.isInteger(slot) && slot >= 0 ? slot : 0; }
  function enrichDiscovery(target, geographic) { if (!target || !geographic) return target; target.name = geographic.title; target.flavor = geographic.signal; target.omen = `地形：${terrainLabel(geographic)}`; target.risk = Math.max(Number(target.risk) || 1, Number(geographic.risk) || 1); target.palette = geographic.palette === "water" ? "marsh" : geographic.palette; target.signal = contentKindLabel(geographic); target.geographicDiscovery = JSON.parse(JSON.stringify(geographic)); target.geographicTerrain = terrainLabel(geographic); target.realPlaceName = geographic.realPlaceName || ""; return target; }
  function applySelectedGeographicDiscovery(next, choiceId) { if (!next || !next.expedition || !geographicDiscoveries.length) return next; const geographic = geographicDiscoveries[choiceSlot(choiceId)]; if (!geographic) return next; const exp = next.expedition, last = exp.lastDiscovery; enrichDiscovery(last, geographic); if (last && Array.isArray(exp.discoveries)) { const history = exp.discoveries.find((item) => item && item.id === last.id); if (history && history !== last) enrichDiscovery(history, geographic); } if (exp.encounter && exp.encounter.discovery) enrichDiscovery(exp.encounter.discovery, geographic); if (exp.pendingEvent && exp.pendingEvent.discovery) enrichDiscovery(exp.pendingEvent.discovery, geographic); return next; }
  Core.discoverLocation = function discoverLocationWithGeography(state, choiceId) { return applySelectedGeographicDiscovery(originalDiscoverLocation(state, choiceId), choiceId); };

  function getCurrentLocation() {
    if (!navigator.geolocation) return Promise.reject(new Error("geolocation unavailable")); diagnostics.gps = "requesting"; diagnostics.gpsOptions = Object.assign({}, GEOLOCATION_OPTIONS); const startedAt = performance.now(); showLocationStatus();
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => { diagnostics.gps = "ok"; diagnostics.gpsElapsedMs = Math.round(performance.now() - startedAt); showLocationStatus(); resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }); }, (error) => { const classified = classifyGeolocationError(error); diagnostics.gps = classified.state; diagnostics.gpsCode = classified.code; diagnostics.gpsName = classified.name; diagnostics.gpsMessage = error && error.message ? error.message : ""; diagnostics.gpsElapsedMs = Math.round(performance.now() - startedAt); showLocationStatus(); reject(error); }, GEOLOCATION_OPTIONS));
  }

  function applyProviderStatus(status) { diagnostics.osm = status && status.state ? status.state : diagnostics.osm; diagnostics.endpoint = status && status.endpoint ? status.endpoint : diagnostics.endpoint; diagnostics.attempt = Number(status && status.attempt) || 0; diagnostics.total = Number(status && status.total) || diagnostics.total || 0; diagnostics.httpStatus = status && status.httpStatus ? status.httpStatus : null; diagnostics.error = status && status.state === "failed" ? (status.error || (status.timedOut ? "timeout" : "failed")) : ""; if (status && status.state === "success") { diagnostics.discoveries = Number(status.discoveries) || 0; diagnostics.features = Array.isArray(status.features) ? status.features.slice() : []; diagnostics.names = Array.isArray(status.names) ? status.names.slice() : []; } showLocationStatus(); }

  async function loadGeographicDiscoveries() {
    if (locationPromise) return locationPromise; locationState = "loading"; diagnostics = emptyDiagnostics("requesting");
    locationPromise = (async () => { let provider = null; try { const location = await getCurrentLocation(); provider = GeographyApi.createProxyLocationDiscoveryProvider({ limit: 3, radius: 650, timeoutMs: 22000, endpoint: window.CROWNLESS_GEOGRAPHY_API || GeographyApi.DEFAULT_PROXY_ENDPOINT, onStatus: applyProviderStatus }); geographicDiscoveries = await provider.discover({ location }); diagnostics.endpoint = provider.endpoint || diagnostics.endpoint || "unknown"; diagnostics.discoveries = geographicDiscoveries.length; diagnostics.features = [...new Set(geographicDiscoveries.flatMap((item) => item.features || []))]; diagnostics.names = [...new Set(geographicDiscoveries.map((item) => item.realPlaceName).filter(Boolean))]; locationState = geographicDiscoveries.length ? "ready" : "failed"; if (!geographicDiscoveries.length) diagnostics.error = "no matching discoveries"; } catch (error) { geographicDiscoveries = []; locationState = error && error.code === 1 ? "denied" : "failed"; diagnostics.endpoint = provider && provider.endpoint ? provider.endpoint : diagnostics.endpoint || "-"; diagnostics.error = provider && provider.error ? provider.error : (error && error.message ? error.message : "unknown error"); if (diagnostics.gps === "ok" && diagnostics.osm === "idle") diagnostics.osm = "failed"; } return geographicDiscoveries; })(); return locationPromise;
  }

  const startButton = document.getElementById("start-expedition");
  if (startButton) startButton.addEventListener("click", () => { locationPromise = null; geographicDiscoveries = []; const discovery = loadGeographicDiscoveries(); queueMicrotask(setPendingUi); discovery.finally(() => { if (!document.getElementById("explore-screen")?.classList.contains("active")) return; refreshLeadCards(); setPendingUi(); }); });

  window.CrownlessLocationDiscoveryRuntime = { get state() { return locationState; }, get discoveries() { return geographicDiscoveries.slice(); }, get diagnostics() { return Object.assign({}, diagnostics, { gpsOptions: Object.assign({}, diagnostics.gpsOptions), features: diagnostics.features.slice(), names: diagnostics.names.slice() }); }, classifyGeolocationError, terrainLabel, choiceSlot, applySelectedGeographicDiscovery, reload() { locationPromise = null; return loadGeographicDiscoveries(); } };
})();
