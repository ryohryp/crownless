(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExplorationMap = api;
  if (root && root.document) api.install(root.document, root.CrownlessDiscovery, root.CrownlessLocationDiscoveryRuntime);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExplorationPresentation() {
  "use strict";

  const DESTINATION_LIMIT = 3;
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
    heading.dataset.discoverySource = normalized;
    eyebrow.textContent = DISCOVERY_SOURCE_LABELS[normalized];
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
      @media (max-width:760px) {
        .discovered-destinations-heading { margin-top:12px; }
        .discovered-destinations-heading strong { font-size:19px; }
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
    setDiscoverySource(document, discoverySourceFromRuntime(locationRuntime));

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
    }

    function scheduleRefresh() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(refresh);
    }

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(leadList, { childList: true, subtree: false });
    document.getElementById("start-expedition")?.addEventListener("click", scheduleRefresh, true);
    document.getElementById("continue-expedition")?.addEventListener("click", scheduleRefresh, true);
    document.getElementById("return-again")?.addEventListener("click", scheduleRefresh, true);
    scheduleRefresh();
  }

  return {
    DESTINATION_LIMIT,
    DISCOVERY_SOURCE_LABELS,
    extractDestination,
    selectDestinations,
    setDiscoverySource,
    discoverySourceFromRuntime,
    terrainLabel,
    contentKindLabel,
    applyGeographicDiscoveries,
    install
  };
});