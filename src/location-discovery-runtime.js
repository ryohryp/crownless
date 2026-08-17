(() => {
  "use strict";
  const Core = window.CrownlessCore;
  const Discovery = window.CrownlessDiscovery;
  const GeographyApi = window.CrownlessGeographyApi;
  if (!Core || !Discovery || !GeographyApi) return;
  const originalGenerate = Core.generateExplorationChoices.bind(Core);
  let geographicDiscoveries = [];
  let locationState = "idle";
  let locationPromise = null;
  let replayingStart = false;
  let diagnostics = { gps: "idle", osm: "idle", endpoint: "-", attempt: 0, total: 0, httpStatus: null, discoveries: 0, features: [], names: [], error: "" };

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
    const parts = [`GPS:${diagnostics.gps}`, `OSM:${osmDetail}`, `発見:${diagnostics.discoveries}`];
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

  function mergeGeography(choice, discovery) {
    if (!discovery) return choice;
    const identified = Discovery.investigateDiscovery(discovery);
    return Object.assign({}, choice, { name: identified.title, description: discovery.signal, omen: `現実の地形：${discovery.features.join(" + ")}`, signal: discovery.contentKind === "dungeon" ? "遺構" : discovery.contentKind === "encounter" ? "遭遇" : "異変", risk: Math.max(choice.risk || 1, discovery.risk || 1), palette: discovery.palette === "water" ? "marsh" : discovery.palette, geographicDiscovery: discovery });
  }

  Core.generateExplorationChoices = function generateLocationAwareChoices(state) { const choices = originalGenerate(state); if (!geographicDiscoveries.length) return choices; return choices.map((choice, index) => mergeGeography(choice, geographicDiscoveries[index % geographicDiscoveries.length])); };

  function getCurrentLocation() {
    if (!navigator.geolocation) return Promise.reject(new Error("geolocation unavailable"));
    diagnostics.gps = "requesting";
    showLocationStatus();
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition((position) => { diagnostics.gps = "ok"; showLocationStatus(); resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }); }, (error) => { diagnostics.gps = error && error.code === 1 ? "denied" : "error"; showLocationStatus(); reject(error); }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }));
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
    diagnostics = { gps: "requesting", osm: "idle", endpoint: "-", attempt: 0, total: 0, httpStatus: null, discoveries: 0, features: [], names: [], error: "" };
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
  if (startButton) startButton.addEventListener("click", (event) => {
    if (replayingStart) {
      replayingStart = false;
      queueMicrotask(() => { syncExplorationSource(); showLocationStatus(); });
      return;
    }

    // This listener is registered before app.js. Stop the original expedition
    // handler from rendering simulated choices until location discovery settles.
    event.stopImmediatePropagation();
    locationPromise = null;
    geographicDiscoveries = [];
    locationState = "loading";
    startButton.disabled = true;
    startButton.setAttribute("aria-busy", "true");

    loadGeographicDiscoveries().finally(() => {
      startButton.disabled = false;
      startButton.removeAttribute("aria-busy");
      replayingStart = true;
      startButton.click();
    });
  });

  window.CrownlessLocationDiscoveryRuntime = { get state() { return locationState; }, get discoveries() { return geographicDiscoveries.slice(); }, get diagnostics() { return Object.assign({}, diagnostics, { features: diagnostics.features.slice(), names: diagnostics.names.slice() }); }, reload() { locationPromise = null; return loadGeographicDiscoveries(); } };
})();
