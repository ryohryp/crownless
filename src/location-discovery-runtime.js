(() => {
  "use strict";
  const Core = window.CrownlessCore;
  const Discovery = window.CrownlessDiscovery;
  const GeographyApi = window.CrownlessGeographyApi;
  if (!Core || !Discovery || !GeographyApi) return;
  const originalGenerate = Core.generateExplorationChoices.bind(Core);
  const originalDiscoverLocation = Core.discoverLocation.bind(Core);
  const GEOLOCATION_OPTIONS = Object.freeze({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  const TERRAIN_LABELS = Object.freeze({
    water: "水辺",
    crossing: "渡り場",
    sacred: "聖域",
    woods: "林地",
    road_hub: "街道の結節点",
    height: "高地",
    coast: "沿岸",
    settlement: "集落"
  });
  let geographicDiscoveries = [];
  let geographicChoicesById = new Map();
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
    if (locationState === "loading") return "現在地から周囲の気配を探している…";
    if (locationState === "ready") return "現実の地形が、この遠征の気配に混ざっている。";
    if (locationState === "denied") return "位置情報を使えないため、霧の中を手探りで進む。";
    if (locationState === "failed") return "地理情報を読めなかったため、通常の探索を続ける。";
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
    marker.textContent = `${statusText()} ${diagnosticText()}`.trim();
    marker.style.display = "block";
    marker.style.margin = "8px 0 14px";
    marker.style.padding = "8px 10px";
    marker.style.borderLeft = "3px solid #b99a55";
    marker.style.background = "rgba(185,154,85,0.08)";
    marker.style.fontSize = "12px";
    marker.style.lineHeight = "1.5";
    marker.style.opacity = "0.95";
    marker.style.overflowWrap = "anywhere";
  }

  function syncExplorationSource() {
    const presentation = window.CrownlessExplorationMap;
    if (!presentation || typeof presentation.setDiscoverySource !== "function") return;
    presentation.setDiscoverySource(document, locationState === "ready" && geographicDiscoveries.length ? "geographic" : "simulated");
  }

  function setPendingUi() {
    const leadList = document.getElementById("lead-list");
    if (leadList) {
      leadList.style.display = locationState === "loading" ? "none" : "";
      leadList.setAttribute("aria-busy", String(locationState === "loading"));
    }
    syncExplorationSource();
    showLocationStatus();
  }

  function setRiskPips(card, risk) {
    const pips = Array.from(card.querySelectorAll(".pips.risk i"));
    pips.forEach((pip, index) => pip.classList.toggle("on", index < risk));
  }

  function refreshLeadCards() {
    const leadList = document.getElementById("lead-list");
    if (!leadList) return;
    const choices = Core.generateExplorationChoices(window.CrownlessAppState || null);
    const cards = Array.from(leadList.querySelectorAll(".lead-card"));
    choices.forEach((choice, index) => {
      const card = cards[index];
      if (!card) return;
      const kicker = card.querySelector(".lead-topline span");
      const title = card.querySelector("h3");
      const description = card.querySelector("p");
      const omen = card.querySelector(".lead-omen");
      const signal = card.querySelector(".lead-signals label strong");
      if (kicker) kicker.textContent = choice.kicker;
      if (title) title.textContent = choice.name;
      if (description) description.textContent = choice.description;
      if (omen) omen.textContent = `噂：${choice.omen}`;
      if (signal) signal.textContent = choice.signal;
      setRiskPips(card, choice.risk);
      card.dataset.choiceId = choice.choiceId;
      card.dataset.discoverySource = choice.geographicDiscovery ? "geographic" : "simulated";
      card.className = `lead-card palette-${choice.palette}${choice.eventKind === "hunt" ? " hunt-target" : ""}`;
    });
  }

  function terrainLabel(discovery) {
    const features = Array.isArray(discovery && discovery.features) ? discovery.features : [];
    const labels = features.map((feature) => TERRAIN_LABELS[feature]).filter(Boolean);
    return labels.length ? labels.join("・") : "周辺地形";
  }

  function mergeGeography(choice, discovery) {
    if (!discovery) return choice;
    const identified = Discovery.investigateDiscovery(discovery);
    return Object.assign({}, choice, {
      name: identified.title,
      description: discovery.signal,
      omen: `現実の地形：${discovery.features.join(" + ")}`,
      signal: `地形：${terrainLabel(discovery)}`,
      risk: Math.max(choice.risk || 1, discovery.risk || 1),
      palette: discovery.palette === "water" ? "marsh" : discovery.palette,
      geographicDiscovery: discovery
    });
  }

  function snapshotGeographicDiscovery(discovery) {
    if (!discovery) return null;
    return {
      id: discovery.id,
      title: discovery.title,
      baseTitle: discovery.baseTitle,
      realPlaceName: discovery.realPlaceName || "",
      features: Array.isArray(discovery.features) ? discovery.features.slice() : [],
      contentKind: discovery.contentKind,
      risk: discovery.risk,
      palette: discovery.palette,
      revealState: discovery.revealState
    };
  }

  function applySelectedGeography(result, choice) {
    if (!result || !result.expedition || !choice || !choice.geographicDiscovery) return result;
    const metadata = snapshotGeographicDiscovery(choice.geographicDiscovery);
    const patch = {
      name: choice.name,
      kicker: choice.kicker,
      flavor: choice.description,
      omen: choice.omen,
      risk: choice.risk,
      palette: choice.palette,
      signal: choice.signal,
      geographicDiscovery: metadata
    };
    const expedition = result.expedition;
    if (expedition.lastDiscovery) Object.assign(expedition.lastDiscovery, patch);
    const latest = expedition.discoveries && expedition.discoveries[expedition.discoveries.length - 1];
    if (latest) Object.assign(latest, patch);
    if (expedition.encounter && expedition.encounter.discovery) Object.assign(expedition.encounter.discovery, patch);
    if (expedition.pendingEvent && expedition.pendingEvent.discovery) Object.assign(expedition.pendingEvent.discovery, patch);
    return result;
  }

  Core.generateExplorationChoices = function generateLocationAwareChoices(state) {
    const choices = originalGenerate(state);
    geographicChoicesById = new Map();
    if (!geographicDiscoveries.length) return choices;
    return choices.map((choice, index) => {
      const merged = mergeGeography(choice, geographicDiscoveries[index % geographicDiscoveries.length]);
      geographicChoicesById.set(merged.choiceId, merged);
      return merged;
    });
  };

  Core.discoverLocation = function discoverLocationAware(state, choiceId) {
    const selected = geographicChoicesById.get(choiceId) || null;
    const result = originalDiscoverLocation(state, choiceId);
    return applySelectedGeography(result, selected);
  };

  function getCurrentLocation() {
    if (!navigator.geolocation) return Promise.reject(new Error("geolocation unavailable"));
    diagnostics.gps = "requesting";
    diagnostics.gpsOptions = Object.assign({}, GEOLOCATION_OPTIONS);
    const startedAt = performance.now();
    showLocationStatus();
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => {
      diagnostics.gps = "ok";
      diagnostics.gpsElapsedMs = Math.round(performance.now() - startedAt);
      showLocationStatus();
      resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, (error) => {
      const classified = classifyGeolocationError(error);
      diagnostics.gps = classified.state;
      diagnostics.gpsCode = classified.code;
      diagnostics.gpsName = classified.name;
      diagnostics.gpsMessage = error && error.message ? error.message : "";
      diagnostics.gpsElapsedMs = Math.round(performance.now() - startedAt);
      showLocationStatus();
      reject(error);
    }, GEOLOCATION_OPTIONS));
  }

  function applyProviderStatus(status) {
    diagnostics.osm = status && status.state ? status.state : diagnostics.osm;
    diagnostics.endpoint = status && status.endpoint ? status.endpoint : diagnostics.endpoint;
    diagnostics.attempt = Number(status && status.attempt) || 0;
    diagnostics.total = Number(status && status.total) || diagnostics.total || 0;
    diagnostics.httpStatus = status && status.httpStatus ? status.httpStatus : null;
    diagnostics.error = status && status.state === "failed" ? (status.error || (status.timedOut ? "timeout" : "failed")) : "";
    if (status && status.state === "success") {
      diagnostics.discoveries = Number(status.discoveries) || 0;
      diagnostics.features = Array.isArray(status.features) ? status.features.slice() : [];
      diagnostics.names = Array.isArray(status.names) ? status.names.slice() : [];
    }
    showLocationStatus();
  }

  async function loadGeographicDiscoveries() {
    if (locationPromise) return locationPromise;
    locationState = "loading";
    diagnostics = emptyDiagnostics("requesting");
    locationPromise = (async () => {
      let provider = null;
      try {
        const location = await getCurrentLocation();
        provider = GeographyApi.createProxyLocationDiscoveryProvider({ limit: 3, radius: 650, timeoutMs: 22000, endpoint: window.CROWNLESS_GEOGRAPHY_API || GeographyApi.DEFAULT_PROXY_ENDPOINT, onStatus: applyProviderStatus });
        geographicDiscoveries = await provider.discover({ location });
        diagnostics.endpoint = provider.endpoint || diagnostics.endpoint || "unknown";
        diagnostics.discoveries = geographicDiscoveries.length;
        diagnostics.features = [...new Set(geographicDiscoveries.flatMap((item) => item.features || []))];
        diagnostics.names = [...new Set(geographicDiscoveries.map((item) => item.realPlaceName).filter(Boolean))];
        locationState = geographicDiscoveries.length ? "ready" : "failed";
        if (!geographicDiscoveries.length) diagnostics.error = "no matching discoveries";
      } catch (error) {
        geographicDiscoveries = [];
        geographicChoicesById = new Map();
        locationState = error && error.code === 1 ? "denied" : "failed";
        diagnostics.endpoint = provider && provider.endpoint ? provider.endpoint : diagnostics.endpoint || "-";
        diagnostics.error = provider && provider.error ? provider.error : (error && error.message ? error.message : "unknown error");
        if (diagnostics.gps === "ok" && diagnostics.osm === "idle") diagnostics.osm = "failed";
      }
      return geographicDiscoveries;
    })();
    return locationPromise;
  }

  const startButton = document.getElementById("start-expedition");
  if (startButton) startButton.addEventListener("click", () => {
    locationPromise = null;
    geographicDiscoveries = [];
    geographicChoicesById = new Map();
    const discovery = loadGeographicDiscoveries();
    queueMicrotask(setPendingUi);
    discovery.finally(() => {
      if (!document.getElementById("explore-screen")?.classList.contains("active")) return;
      refreshLeadCards();
      setPendingUi();
    });
  });

  window.CrownlessLocationDiscoveryRuntime = {
    get state() { return locationState; },
    get discoveries() { return geographicDiscoveries.slice(); },
    get diagnostics() { return Object.assign({}, diagnostics, { gpsOptions: Object.assign({}, diagnostics.gpsOptions), features: diagnostics.features.slice(), names: diagnostics.names.slice() }); },
    classifyGeolocationError,
    reload() { locationPromise = null; return loadGeographicDiscoveries(); }
  };
})();
