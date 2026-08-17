(() => {
  "use strict";

  const Core = window.CrownlessCore;
  const Discovery = window.CrownlessDiscovery;
  if (!Core || !Discovery) return;

  const originalGenerate = Core.generateExplorationChoices.bind(Core);
  let geographicDiscoveries = [];
  let locationState = "idle";

  function statusText() {
    if (locationState === "loading") return "現在地から周囲の気配を探している…";
    if (locationState === "ready") return "現実の地形が、この遠征の気配に混ざっている。";
    if (locationState === "denied") return "位置情報を使えないため、霧の中を手探りで進む。";
    if (locationState === "failed") return "地理情報を読めなかったため、通常の探索を続ける。";
    return "";
  }

  function showLocationStatus() {
    const warning = document.getElementById("carried-warning");
    if (!warning || !statusText()) return;
    const marker = document.createElement("span");
    marker.className = "location-discovery-status";
    marker.textContent = statusText();
    warning.appendChild(marker);
  }

  function mergeGeography(choice, discovery) {
    if (!discovery) return choice;
    const identified = Discovery.investigateDiscovery(discovery);
    return Object.assign({}, choice, {
      name: identified.title,
      description: discovery.signal,
      omen: `現実の地形：${discovery.features.join(" + ")}`,
      signal: discovery.contentKind === "dungeon" ? "遺構" : discovery.contentKind === "encounter" ? "遭遇" : "異変",
      risk: Math.max(choice.risk || 1, discovery.risk || 1),
      palette: discovery.palette === "water" ? "marsh" : discovery.palette,
      geographicDiscovery: discovery
    });
  }

  Core.generateExplorationChoices = function generateLocationAwareChoices(state) {
    const choices = originalGenerate(state);
    if (!geographicDiscoveries.length) return choices;
    return choices.map((choice, index) => mergeGeography(choice, geographicDiscoveries[index % geographicDiscoveries.length]));
  };

  async function getCurrentLocation() {
    if (!navigator.geolocation) throw new Error("geolocation unavailable");
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        reject,
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  async function loadGeographicDiscoveries() {
    locationState = "loading";
    try {
      const location = await getCurrentLocation();
      const provider = Discovery.createLocationDiscoveryProvider({ limit: 3, radius: 650 });
      geographicDiscoveries = await provider.discover({ location });
      locationState = geographicDiscoveries.length ? "ready" : "failed";
    } catch (error) {
      geographicDiscoveries = [];
      locationState = error && error.code === 1 ? "denied" : "failed";
    }
  }

  const startButton = document.getElementById("start-expedition");
  if (startButton) {
    const interceptFirstExpedition = async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      startButton.disabled = true;
      const originalLabel = startButton.querySelector("strong");
      const previousText = originalLabel ? originalLabel.textContent : "";
      if (originalLabel) originalLabel.textContent = "周囲の気配を探している…";
      await loadGeographicDiscoveries();
      startButton.disabled = false;
      if (originalLabel) originalLabel.textContent = previousText;
      startButton.removeEventListener("click", interceptFirstExpedition, true);
      startButton.click();
    };
    startButton.addEventListener("click", interceptFirstExpedition, true);
  }

  document.addEventListener("click", (event) => {
    if (event.target && (event.target.id === "start-expedition" || event.target.closest?.("#start-expedition"))) {
      window.setTimeout(showLocationStatus, 0);
    }
  });

  window.CrownlessLocationDiscoveryRuntime = {
    get state() { return locationState; },
    get discoveries() { return geographicDiscoveries.slice(); },
    reload: loadGeographicDiscoveries
  };
})();
