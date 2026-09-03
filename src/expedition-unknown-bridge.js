(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionUnknownBridge = api;
  if (root && root.document) {
    api.install(
      root.CrownlessCore,
      root.CrownlessExplorationCells,
      root.CrownlessGeographyApi,
      root.CrownlessLocationDiscoveryRuntime,
      root
    );
    api.loadObjectiveChoices(root);
    api.loadEquipmentOpportunities(root);
    api.loadPartyOpportunities(root);
    api.loadRescueLoop(root);
    api.loadCompanionProposals(root);
    api.loadPartySelection(root);
    api.loadLeaderOutcomes(root);
    api.loadFollowupDestinations(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionUnknownBridge() {
  "use strict";

  function loadScript(root, globalName, src) {
    if (!root || !root.document || root[globalName]) return Boolean(root && root.document);
    if (root.document.querySelector(`script[src="${src}"]`)) return true;
    const script = root.document.createElement("script");
    script.src = src;
    script.defer = true;
    root.document.head.appendChild(script);
    return true;
  }

  function loadObjectiveChoices(root) {
    return loadScript(root, "CrownlessExpeditionObjectives", "src/expedition-objectives.js");
  }

  function loadEquipmentOpportunities(root) {
    return loadScript(root, "CrownlessExpeditionEquipmentOpportunities", "src/expedition-equipment-opportunities.js");
  }

  function loadPartyOpportunities(root) {
    return loadScript(root, "CrownlessExpeditionPartyOpportunities", "src/expedition-party-opportunities.js");
  }

  function loadRescueLoop(root) {
    return loadScript(root, "CrownlessExpeditionRescue", "src/expedition-rescue.js");
  }

  function loadCompanionProposals(root) {
    return loadScript(root, "CrownlessExpeditionCompanionProposals", "src/expedition-companion-proposals.js");
  }

  function loadPartySelection(root) {
    return loadScript(root, "CrownlessExpeditionPartySelection", "src/expedition-party-selection.js");
  }

  function loadLeaderOutcomes(root) {
    return loadScript(root, "CrownlessExpeditionLeader", "src/expedition-leader.js");
  }

  function loadFollowupDestinations(root) {
    return loadScript(root, "CrownlessExpeditionFollowupDestinations", "src/expedition-followup-destinations.js");
  }

  function install(Core, Cells, GeographyApi, runtime, root) {
    if (!Core || !Cells || !GeographyApi || !runtime) return false;
    if (typeof Core.loadSafeState !== "function" || typeof Core.explorationCellFromLocation !== "function") return false;
    if (typeof Cells.expeditionProfile !== "function" || typeof Cells.applyUnknownness !== "function") return false;
    if (typeof GeographyApi.createProxyLocationDiscoveryProvider !== "function") return false;
    if (GeographyApi.__expeditionUnknownsInstalled) return true;

    let lastProfile = Cells.expeditionProfile(null, []);

    function knownCellIds() {
      const safe = Core.loadSafeState();
      const cells = safe && safe.worldKnowledge && safe.worldKnowledge.exploredCells;
      return cells && typeof cells === "object" && !Array.isArray(cells) ? Object.keys(cells) : [];
    }

    function knownDiscoveryKeys() {
      const safe = Core.loadSafeState();
      const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
      return new Set(discoveries && typeof discoveries === "object" && !Array.isArray(discoveries) ? Object.keys(discoveries) : []);
    }

    const originalCreateProvider = GeographyApi.createProxyLocationDiscoveryProvider.bind(GeographyApi);
    GeographyApi.createProxyLocationDiscoveryProvider = function createProviderWithExpeditionUnknowns(...args) {
      const provider = originalCreateProvider(...args);
      if (!provider || typeof provider.discover !== "function") return provider;
      const originalDiscover = provider.discover.bind(provider);
      provider.discover = async function discoverWithExpeditionUnknowns(input) {
        const discovered = await originalDiscover(input);
        if (runtime.qaMode) return discovered;

        const location = input && input.location;
        const cell = Core.explorationCellFromLocation(location);
        lastProfile = Cells.expeditionProfile(cell, knownCellIds());
        const knownKeys = knownDiscoveryKeys();
        const isKnown = (item) => {
          const key = typeof runtime.worldKnowledgeKey === "function" ? runtime.worldKnowledgeKey(item) : null;
          return Boolean(key && knownKeys.has(key));
        };
        return Cells.applyUnknownness(discovered, lastProfile, isKnown);
      };
      return provider;
    };

    if (typeof Core.discoverLocation === "function") {
      const originalDiscoverLocation = Core.discoverLocation.bind(Core);
      Core.discoverLocation = function discoverLocationWithUnknownReveal(state, choiceId) {
        const activeRuntime = root && root.CrownlessLocationDiscoveryRuntime || runtime;
        const slot = typeof activeRuntime.choiceSlot === "function" ? activeRuntime.choiceSlot(state, choiceId) : 0;
        const visible = Array.isArray(activeRuntime.discoveries) ? activeRuntime.discoveries[slot] : null;
        const wasMystery = Boolean(visible && visible.mysteryIdentity);
        const expeditionTier = visible && visible.expeditionTier || "";
        const expeditionLabel = visible && visible.expeditionLabel || "";

        if (wasMystery) {
          const resolved = Cells.resolveDiscovery(visible);
          Object.keys(visible).forEach((key) => { delete visible[key]; });
          Object.assign(visible, resolved);
        }

        const next = originalDiscoverLocation(state, choiceId);
        const last = next && next.expedition && next.expedition.lastDiscovery;
        if (wasMystery && last) {
          last.wasUnknownDiscovery = true;
          last.expeditionTier = expeditionTier;
          last.expeditionLabel = expeditionLabel;
          if (Array.isArray(next.expedition.discoveries)) {
            const history = next.expedition.discoveries.find((item) => item && item.id === last.id);
            if (history) {
              history.wasUnknownDiscovery = true;
              history.expeditionTier = expeditionTier;
              history.expeditionLabel = expeditionLabel;
            }
          }
        }
        return next;
      };
    }

    GeographyApi.__expeditionUnknownsInstalled = true;
    api.lastProfile = () => ({ ...lastProfile });
    return true;
  }

  const api = {
    install,
    loadObjectiveChoices,
    loadEquipmentOpportunities,
    loadPartyOpportunities,
    loadRescueLoop,
    loadCompanionProposals,
    loadPartySelection,
    loadLeaderOutcomes,
    loadFollowupDestinations,
    lastProfile: () => null
  };

  return api;
});
