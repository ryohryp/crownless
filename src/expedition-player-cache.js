(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionPlayerCache = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionPlayerCache() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const SUPPLY_ID = "abandoned-camp-supplies";
  const CACHE_CHOICE = "cache";
  const CACHE_DESTINATION_PREFIX = "player-cache:";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function readState(root) {
    try {
      const raw = root && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function ownsSupply(state) {
    return Boolean(state && (
      Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === SUPPLY_ID)
      || Array.isArray(state.equipment) && state.equipment.some((item) => item && item.id === SUPPLY_ID)
    ));
  }

  function cacheDestinationId(sourceDestinationId) {
    return `${CACHE_DESTINATION_PREFIX}${String(sourceDestinationId || "unknown")}`;
  }

  function selectedCache(doc) {
    const selected = doc && doc.querySelector('input[name="fieldCareReserve"]:checked');
    return Boolean(selected && selected.value === CACHE_CHOICE);
  }

  function selectedFieldCamp(doc) {
    const selected = doc && doc.querySelector('input[name="stay-plan"]:checked');
    return Boolean(selected && selected.value === "field-camp");
  }

  function appendCacheChoice(root) {
    const doc = root && root.document;
    if (!doc || !ownsSupply(readState(root))) return false;
    const group = doc.querySelector("[data-field-care-choice]");
    if (!group || group.querySelector(`input[name="fieldCareReserve"][value="${CACHE_CHOICE}"]`)) return Boolean(group);

    const label = doc.createElement("label");
    label.className = "expedition-choice__item";
    const input = doc.createElement("input");
    input.type = "radio";
    input.name = "fieldCareReserve";
    input.value = CACHE_CHOICE;
    const body = doc.createElement("span");
    const strong = doc.createElement("strong");
    strong.textContent = "この土地に補給品を隠す";
    const small = doc.createElement("small");
    small.textContent = "現地野営時だけ選択可。補給品を持ち帰らず、自分たちの回収用cacheとして残す";
    body.append(strong, small);
    label.append(input, body);
    group.append(label);

    input.addEventListener("change", () => {
      if (!input.checked) return;
      const form = input.closest("form");
      const supply = form && form.querySelector(`input[name="equipment"][value="${SUPPLY_ID}"]`);
      if (supply) supply.checked = true;
    });
    return true;
  }

  function prepareCacheDispatchInput(input, cacheSelected, fieldCampSelected) {
    const next = { ...(input || {}) };
    const equipment = Array.isArray(next.equipmentIds) ? [...next.equipmentIds] : [];
    if (!cacheSelected || !fieldCampSelected || !equipment.includes(SUPPLY_ID)) {
      return { input: next, cacheSupply: false };
    }
    next.equipmentIds = equipment.filter((id) => id !== SUPPLY_ID);
    next.cacheSupplyIntent = true;
    next.cachedEquipmentId = SUPPLY_ID;
    delete next.fieldCareReserve;
    return { input: next, cacheSupply: true };
  }

  function isCacheExpedition(expedition) {
    return Boolean(expedition && expedition.inputs && String(expedition.inputs.destinationId || "").startsWith(CACHE_DESTINATION_PREFIX));
  }

  function sourceDestinationIdFromCache(destinationId) {
    const value = String(destinationId || "");
    return value.startsWith(CACHE_DESTINATION_PREFIX) ? value.slice(CACHE_DESTINATION_PREFIX.length) : "";
  }

  function canCreateCache(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && inputs.cacheSupplyIntent === true
      && inputs.cachedEquipmentId === SUPPLY_ID
      && inputs.stayPlan === "field-camp"
      && ["success", "early-return"].includes(report.outcome)
      && !isCacheExpedition(expedition)
    );
  }

  function decorateCacheCreation(report, expedition) {
    if (!canCreateCache(report, expedition)) return report;
    const sourceDestinationId = expedition.inputs.destinationId;
    const id = cacheDestinationId(sourceDestinationId);
    if (!report.playerCacheCreated) {
      report.playerCacheCreated = {
        id,
        sourceDestinationId,
        equipmentId: SUPPLY_ID,
      };
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "player-cache" && Array.isArray(entry.causes) && entry.causes.includes(id))) {
      report.log.push({
        minute: 109,
        time: "",
        type: "player-cache",
        text: "帰還前に《野営跡の補給品》を石の陰へ隠した。次にこの土地へ戻ったとき、回収用の補給痕跡として使える。",
        causes: ["player-trace", "cache", id, SUPPLY_ID],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "player-cache" && Array.isArray(entry.causes) && entry.causes.includes(id)) || report.notableEvent;
    return report;
  }

  function decorateCacheRecovery(report, expedition) {
    if (!report || !expedition || !isCacheExpedition(expedition) || report.outcome !== "success") return report;
    const destinationId = expedition.inputs.destinationId;
    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === SUPPLY_ID)) {
      report.loot.push({ id: SUPPLY_ID, name: "野営跡の補給品", count: 1 });
    }
    report.playerCacheRecovered = {
      id: destinationId,
      sourceDestinationId: sourceDestinationIdFromCache(destinationId),
      equipmentId: SUPPLY_ID,
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "player-cache-recovered" && Array.isArray(entry.causes) && entry.causes.includes(destinationId))) {
      report.log.push({
        minute: 96,
        time: "",
        type: "player-cache-recovered",
        text: "以前この土地に隠した補給品を見つけ、無事に持ち帰った。補給痕跡はこれで役目を終えた。",
        causes: ["player-trace", "cache-recovered", destinationId, SUPPLY_ID],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "player-cache-recovered" && Array.isArray(entry.causes) && entry.causes.includes(destinationId)) || report.notableEvent;
    return report;
  }

  function decorateReport(report, expedition) {
    decorateCacheCreation(report, expedition);
    return decorateCacheRecovery(report, expedition);
  }

  function consumeOneSupply(state) {
    if (!state) return state;
    if (Array.isArray(state.securedLoot)) {
      const index = state.securedLoot.findIndex((item) => item && item.id === SUPPLY_ID);
      if (index >= 0) state.securedLoot.splice(index, 1);
    }
    const stillOwned = Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === SUPPLY_ID);
    if (!stillOwned && Array.isArray(state.equipment)) {
      state.equipment = state.equipment.filter((item) => !item || item.id !== SUPPLY_ID);
    }
    return state;
  }

  function ensureSupplyOwned(state) {
    if (!state) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    if (!state.securedLoot.some((item) => item && item.id === SUPPLY_ID)) {
      state.securedLoot.push({ id: SUPPLY_ID, name: "野営跡の補給品", count: 1 });
    }
    if (!Array.isArray(state.equipment)) state.equipment = [];
    if (!state.equipment.some((item) => item && item.id === SUPPLY_ID)) {
      state.equipment.push({ id: SUPPLY_ID, name: "野営跡の補給品", tags: ["supply", "fatigue-relief", "consumable"] });
    }
    return state;
  }

  function createCacheDestination(state, report) {
    const cache = report && report.playerCacheCreated;
    if (!state || !cache) return null;
    if (!Array.isArray(state.destinations)) state.destinations = [];
    let destination = state.destinations.find((item) => item && item.id === cache.id);
    if (!destination) {
      const source = state.destinations.find((item) => item && item.id === cache.sourceDestinationId) || {};
      destination = {
        id: cache.id,
        name: "自分たちの補給隠し場所",
        family: source.family || "forest",
        dangerTags: [],
        opportunityTags: ["player-trace", "cache", "supply"],
        durationMs: Math.max(60000, Math.round((Number(source.durationMs) || 180000) * 0.5)),
        playerTrace: {
          kind: "cache",
          sourceType: "player",
          sourceDestinationId: cache.sourceDestinationId,
        },
      };
      state.destinations.push(destination);
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(cache.id)) state.discoveredDestinationIds.push(cache.id);
    return destination;
  }

  function retireCacheDestination(state, destinationId) {
    if (!state || !destinationId) return state;
    if (Array.isArray(state.destinations)) state.destinations = state.destinations.filter((item) => !item || item.id !== destinationId);
    if (Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = state.discoveredDestinationIds.filter((id) => id !== destinationId);
    return state;
  }

  function applyCacheState(state, report) {
    if (!state || !report) return state;
    if (report.playerCacheCreated && !report.playerCacheSupplyConsumed) {
      consumeOneSupply(state);
      createCacheDestination(state, report);
      report.playerCacheSupplyConsumed = true;
    } else if (report.playerCacheCreated) {
      createCacheDestination(state, report);
    }
    if (report.playerCacheRecovered) {
      ensureSupplyOwned(state);
      retireCacheDestination(state, report.playerCacheRecovered.id);
      report.playerCacheRecoveryApplied = true;
    }
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    Object.assign(stored, clone(report));
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    const fieldCamp = root && root.CrownlessExpeditionFieldCamp;
    const supplyRelief = root && root.CrownlessExpeditionCampSupplyRelief;
    if (!system || !fieldCamp || !supplyRelief || !system.__fieldCampInstalled || !system.__campSupplyReliefInstalled) return false;
    if (system.__playerCacheInstalled) return true;

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithPlayerCache(state, input, nowMs) {
      const prepared = prepareCacheDispatchInput(input, selectedCache(root.document), selectedFieldCamp(root.document));
      const next = baseDispatch(state, prepared.input, nowMs);
      if (prepared.cacheSupply && next && next.activeExpedition && next.activeExpedition.inputs && next.activeExpedition.inputs.stayPlan === "field-camp") {
        next.activeExpedition.inputs.cacheSupplyIntent = true;
        next.activeExpedition.inputs.cachedEquipmentId = SUPPLY_ID;
      }
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithPlayerCache(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithPlayerCache(state, report) {
      const applied = baseApplyReport(state, report);
      applyCacheState(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithPlayerCache(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        applyCacheState(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__playerCacheInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      installSystemHooks(root);
      appendCacheChoice(root);
      if ((!root.CrownlessExpeditionSystem || !root.CrownlessExpeditionCampSupplyRelief) && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    if (root.MutationObserver && root.document && root.document.body) {
      const observer = new root.MutationObserver(() => appendCacheChoice(root));
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    return true;
  }

  return {
    SUPPLY_ID,
    CACHE_CHOICE,
    CACHE_DESTINATION_PREFIX,
    ownsSupply,
    cacheDestinationId,
    selectedCache,
    selectedFieldCamp,
    appendCacheChoice,
    prepareCacheDispatchInput,
    isCacheExpedition,
    sourceDestinationIdFromCache,
    canCreateCache,
    decorateCacheCreation,
    decorateCacheRecovery,
    decorateReport,
    consumeOneSupply,
    ensureSupplyOwned,
    createCacheDestination,
    retireCacheDestination,
    applyCacheState,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});
