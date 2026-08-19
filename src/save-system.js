(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) {
    root.CrownlessCore = factory(root.CrownlessCore);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function installSaveSystem(Core) {
  "use strict";

  if (!Core || Core.__saveSystemInstalled) return Core;

  const SAVE_KEY = "crownless.safe.v1";
  const SAVE_VERSION = 1;
  const KNOWLEDGE_STATES = new Set(["discovered", "investigated", "cleared"]);

  const base = {
    createInitialState: Core.createInitialState,
    beginExpedition: Core.beginExpedition,
    returnHome: Core.returnHome,
    resolveDefeat: Core.resolveDefeat,
    equipItem: Core.equipItem
  };

  function storage() {
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (_) {
      return null;
    }
    return null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, fallback = "") {
    const result = String(value == null ? "" : value).trim();
    return result || fallback;
  }

  function sanitizeWorldKnowledge(value) {
    const source = value && typeof value === "object" ? value : {};
    const discoveries = source.discoveries && typeof source.discoveries === "object" && !Array.isArray(source.discoveries)
      ? source.discoveries
      : {};
    const safe = {};

    Object.entries(discoveries).forEach(([fallbackKey, raw]) => {
      if (!raw || typeof raw !== "object") return;
      const key = cleanText(raw.key || fallbackKey);
      if (!key) return;
      const firstDiscoveredAt = Number(raw.firstDiscoveredAt);
      const terrain = Array.isArray(raw.terrain)
        ? [...new Set(raw.terrain.map((item) => cleanText(item)).filter(Boolean))].slice(0, 8)
        : [];
      safe[key] = {
        key,
        name: cleanText(raw.name, "名もない発見"),
        baseTitle: cleanText(raw.baseTitle),
        terrain,
        contentKind: cleanText(raw.contentKind, "unknown"),
        state: KNOWLEDGE_STATES.has(raw.state) ? raw.state : "discovered",
        firstDiscoveredAt: Number.isFinite(firstDiscoveredAt) && firstDiscoveredAt > 0 ? firstDiscoveredAt : 0,
        visits: Math.max(1, Math.floor(Number(raw.visits) || 1))
      };
    });

    return { discoveries: safe };
  }

  function isSafeHubState(state) {
    return Boolean(
      state &&
      typeof state === "object" &&
      state.phase === "hub" &&
      !state.expedition &&
      Array.isArray(state.securedLoot) &&
      state.stats &&
      typeof state.stats === "object"
    );
  }

  function normalizeLoadedState(state) {
    state.phase = "hub";
    state.expedition = null;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    if (!state.stats || typeof state.stats !== "object") state.stats = {};
    state.worldKnowledge = sanitizeWorldKnowledge(state.worldKnowledge);

    if (state.equippedItemId && !state.securedLoot.some((item) => item.id === state.equippedItemId)) {
      state.equippedItemId = null;
    }

    try { if (Core.getHuntBoard) Core.getHuntBoard(state); } catch (_) {}
    try { if (Core.getDungeonLedger) Core.getDungeonLedger(state); } catch (_) {}
    try { if (Core.getHearthProgression) Core.getHearthProgression(state); } catch (_) {}
    return state;
  }

  function writeSnapshot(store, state) {
    store.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state
    }));
  }

  function saveSafeState(state) {
    const store = storage();
    if (!store || !isSafeHubState(state)) return false;
    try {
      const safeState = clone(state);
      safeState.worldKnowledge = sanitizeWorldKnowledge(safeState.worldKnowledge);
      writeSnapshot(store, safeState);
      return true;
    } catch (_) {
      return false;
    }
  }

  function saveWorldKnowledge(state) {
    const store = storage();
    if (!store || !state || typeof state !== "object") return false;
    try {
      const raw = store.getItem(SAVE_KEY);
      if (!raw) return isSafeHubState(state) ? saveSafeState(state) : false;
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== SAVE_VERSION || !isSafeHubState(payload.state)) return false;

      const safeState = normalizeLoadedState(clone(payload.state));
      safeState.worldKnowledge = sanitizeWorldKnowledge(state.worldKnowledge);
      writeSnapshot(store, safeState);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadSafeState() {
    const store = storage();
    if (!store) return null;
    try {
      const raw = store.getItem(SAVE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== SAVE_VERSION || !isSafeHubState(payload.state)) return null;
      return normalizeLoadedState(clone(payload.state));
    } catch (_) {
      return null;
    }
  }

  function clearLocalSave() {
    const store = storage();
    if (!store) return false;
    try {
      store.removeItem(SAVE_KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  Core.createInitialState = function createInitialStateFromLastSafeHub() {
    const fresh = normalizeLoadedState(base.createInitialState());
    const loaded = loadSafeState();
    if (!loaded) {
      saveSafeState(fresh);
      return fresh;
    }

    // Preserve the object identity returned by the already-installed systems.
    // Their queued UI renderers hold this reference, so mutating it here makes
    // the first hub paint reflect the loaded save instead of a transient fresh game.
    Object.keys(fresh).forEach((key) => { delete fresh[key]; });
    Object.assign(fresh, loaded);
    normalizeLoadedState(fresh);
    return fresh;
  };

  Core.beginExpedition = function beginExpeditionAfterCheckpoint(state, seed) {
    saveSafeState(state);
    return base.beginExpedition(state, seed);
  };

  Core.returnHome = function returnHomeAndSave(state) {
    const next = base.returnHome(state);
    saveSafeState(next);
    return next;
  };

  Core.resolveDefeat = function resolveDefeatAndSave(state) {
    const next = base.resolveDefeat(state);
    saveSafeState(next);
    return next;
  };

  Core.equipItem = function equipAndSave(state, itemId) {
    const next = base.equipItem(state, itemId);
    saveSafeState(next);
    return next;
  };

  Core.SAVE_KEY = SAVE_KEY;
  Core.SAVE_VERSION = SAVE_VERSION;
  Core.saveSafeState = saveSafeState;
  Core.saveWorldKnowledge = saveWorldKnowledge;
  Core.loadSafeState = loadSafeState;
  Core.clearLocalSave = clearLocalSave;
  Core.sanitizeWorldKnowledge = sanitizeWorldKnowledge;
  Core.__saveSystemInstalled = true;

  return Core;
});
