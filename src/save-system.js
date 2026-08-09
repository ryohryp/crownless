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

    if (state.equippedItemId && !state.securedLoot.some((item) => item.id === state.equippedItemId)) {
      state.equippedItemId = null;
    }

    try { if (Core.getHuntBoard) Core.getHuntBoard(state); } catch (_) {}
    try { if (Core.getDungeonLedger) Core.getDungeonLedger(state); } catch (_) {}
    try { if (Core.getHearthProgression) Core.getHearthProgression(state); } catch (_) {}
    return state;
  }

  function saveSafeState(state) {
    const store = storage();
    if (!store || !isSafeHubState(state)) return false;
    try {
      store.setItem(SAVE_KEY, JSON.stringify({
        version: SAVE_VERSION,
        savedAt: Date.now(),
        state: clone(state)
      }));
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
    const fresh = base.createInitialState();
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
  Core.loadSafeState = loadSafeState;
  Core.clearLocalSave = clearLocalSave;
  Core.__saveSystemInstalled = true;

  return Core;
});
