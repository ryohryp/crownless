(() => {
  "use strict";

  const Core = window.CrownlessCore;
  const Discovery = window.CrownlessDiscovery;
  if (!Core || !Discovery) return;

  const originalGenerate = Core.generateExplorationChoices.bind(Core);
  let geographicDiscoveries = [];
  let locationState = "idle";
  let locationPromise = null;

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
    const existing = warning.querySelector(".location-discovery-status");
    if (existing) existing.remove();
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

  function getCurrentLocation() {
    if (!navigator.geolocation) return Promise.reject(new Error("geolocation unavailable"));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        reject,
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  async function loadGeographicDiscoveries() {
    if (locationPromise) return locationPromise;
    locationState = "loading";
    locationPromise = (async () => {
      try {
        const location = await getCurrentLocation();
        const provider = Discovery.createLocationDiscoveryProvider({ limit: 3, radius: 650 });
        geographicDiscoveries = await provider.discover({ location });
        locationState = geographicDiscoveries.length ? "ready" : "failed";
      } catch (error) {
        geographicDiscoveries = [];
        locationState = error && error.code === 1 ? "denied" : "failed";
      }
      return geographicDiscoveries;
    })();
    return locationPromise;
  }

  // Do not intercept the app's expedition click handler. The previous capture-phase
  // interception could consume the click before app.js saw it, leaving the player
  // at the hearth after granting permission. Instead, begin location lookup in the
  // bubble phase after app.js has synchronously started the expedition. Once the
  // geographic snapshot arrives, refresh the already-visible exploration choices.
  const startButton = document.getElementById("start-expedition");
  if (startButton) {
    startButton.addEventListener("click", () => {
      loadGeographicDiscoveries().then(() => {
        showLocationStatus();
        const exploreScreen = document.getElementById("explore-screen");
        if (!exploreScreen || !exploreScreen.classList.contains("active")) return;
        const choices = Core.generateExplorationChoices(window.CrownlessAppState || null);
        const leadList = document.getElementById("lead-list");
        if (!leadList || !choices.length) return;
        const cards = Array.from(leadList.querySelectorAll(".lead-card"));
        choices.forEach((choice, index) => {
          const card = cards[index];
          if (!card) return;
          const title = card.querySelector("h3");
          const description = card.querySelector("p");
          const omen = card.querySelector(".lead-omen");
          if (title) title.textContent = choice.name;
          if (description) description.textContent = choice.description;
          if (omen) omen.textContent = `噂：${choice.omen}`;
          card.className = `lead-card palette-${choice.palette}${choice.eventKind === "hunt" ? " hunt-target" : ""}`;
        });
      });
    });
  }

  window.CrownlessLocationDiscoveryRuntime = {
    get state() { return locationState; },
    get discoveries() { return geographicDiscoveries.slice(); },
    reload() { locationPromise = null; return loadGeographicDiscoveries(); }
  };
})();
