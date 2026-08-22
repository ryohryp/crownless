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
  const EXPLORATION_CELL_ZOOM = 16;
  const MAX_MERCATOR_LATITUDE = 85.05112878;

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

  function parseExplorationCellId(value) {
    const match = /^cell:(\d{1,2}):(\d+):(\d+)$/.exec(cleanText(value));
    if (!match) return null;
    const zoom = Number(match[1]);
    const x = Number(match[2]);
    const y = Number(match[3]);
    if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) return null;
    const size = 2 ** zoom;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) return null;
    return { id: `cell:${zoom}:${x}:${y}`, zoom, x, y };
  }

  function explorationCellFromLocation(location, zoom = EXPLORATION_CELL_ZOOM) {
    const latitude = Number(location && location.latitude);
    const longitude = Number(location && location.longitude);
    const normalizedZoom = Number(zoom);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    if (!Number.isInteger(normalizedZoom) || normalizedZoom < 1 || normalizedZoom > 22) return null;

    const size = 2 ** normalizedZoom;
    const mercatorLatitude = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude));
    const latitudeRadians = mercatorLatitude * Math.PI / 180;
    const x = Math.max(0, Math.min(size - 1, Math.floor(((longitude + 180) / 360) * size)));
    const y = Math.max(0, Math.min(size - 1, Math.floor((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * size)));
    return { id: `cell:${normalizedZoom}:${x}:${y}`, zoom: normalizedZoom, x, y };
  }

  function sanitizeExploredCells(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const safe = {};
    Object.entries(source).forEach(([fallbackId, raw]) => {
      const candidate = raw && typeof raw === "object" ? raw : {};
      const parsed = parseExplorationCellId(candidate.id || fallbackId);
      if (!parsed) return;
      const firstExploredAt = Number(candidate.firstExploredAt);
      safe[parsed.id] = {
        id: parsed.id,
        firstExploredAt: Number.isFinite(firstExploredAt) && firstExploredAt > 0 ? firstExploredAt : 0
      };
    });
    return safe;
  }

  function mergeExploredCells(...collections) {
    const merged = {};
    collections.forEach((collection) => {
      Object.values(sanitizeExploredCells(collection)).forEach((entry) => {
        const existing = merged[entry.id];
        if (!existing) {
          merged[entry.id] = entry;
          return;
        }
        const existingAt = Number(existing.firstExploredAt) || 0;
        const incomingAt = Number(entry.firstExploredAt) || 0;
        if (incomingAt > 0 && (existingAt <= 0 || incomingAt < existingAt)) merged[entry.id] = entry;
      });
    });
    return merged;
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

    const result = { discoveries: safe };
    const exploredCells = sanitizeExploredCells(source.exploredCells);
    if (Object.keys(exploredCells).length || Object.prototype.hasOwnProperty.call(source, "exploredCells")) result.exploredCells = exploredCells;
    return result;
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

  function storedExploredCells(store) {
    try {
      const raw = store.getItem(SAVE_KEY);
      if (!raw) return {};
      const payload = JSON.parse(raw);
      if (!payload || payload.version !== SAVE_VERSION || !isSafeHubState(payload.state)) return {};
      return sanitizeExploredCells(payload.state.worldKnowledge && payload.state.worldKnowledge.exploredCells);
    } catch (_) {
      return {};
    }
  }

  function preserveStoredExploredCells(store, worldKnowledge) {
    const next = sanitizeWorldKnowledge(worldKnowledge);
    const exploredCells = mergeExploredCells(storedExploredCells(store), next.exploredCells);
    if (Object.keys(exploredCells).length) next.exploredCells = exploredCells;
    return next;
  }

  function saveSafeState(state) {
    const store = storage();
    if (!store || !isSafeHubState(state)) return false;
    try {
      const safeState = clone(state);
      safeState.worldKnowledge = preserveStoredExploredCells(store, safeState.worldKnowledge);
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
      const incoming = sanitizeWorldKnowledge(state.worldKnowledge);
      const exploredCells = mergeExploredCells(safeState.worldKnowledge.exploredCells, incoming.exploredCells);
      if (Object.keys(exploredCells).length) incoming.exploredCells = exploredCells;
      safeState.worldKnowledge = incoming;
      writeSnapshot(store, safeState);
      return true;
    } catch (_) {
      return false;
    }
  }

  function recordExploredCell(state, location, now = Date.now()) {
    if (!state || typeof state !== "object") return { added: false, cell: null, count: 0, persisted: false };
    const cell = explorationCellFromLocation(location);
    if (!cell) return { added: false, cell: null, count: 0, persisted: false };

    state.worldKnowledge = sanitizeWorldKnowledge(state.worldKnowledge);
    if (!state.worldKnowledge.exploredCells) state.worldKnowledge.exploredCells = {};
    const previous = state.worldKnowledge.exploredCells[cell.id] || null;
    if (!previous) {
      const timestamp = Number(now);
      state.worldKnowledge.exploredCells[cell.id] = {
        id: cell.id,
        firstExploredAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
      };
    }

    return {
      added: !previous,
      cell: clone(cell),
      count: Object.keys(state.worldKnowledge.exploredCells).length,
      persisted: saveWorldKnowledge(state)
    };
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
  Core.EXPLORATION_CELL_ZOOM = EXPLORATION_CELL_ZOOM;
  Core.saveSafeState = saveSafeState;
  Core.saveWorldKnowledge = saveWorldKnowledge;
  Core.recordExploredCell = recordExploredCell;
  Core.explorationCellFromLocation = explorationCellFromLocation;
  Core.parseExplorationCellId = parseExplorationCellId;
  Core.loadSafeState = loadSafeState;
  Core.clearLocalSave = clearLocalSave;
  Core.sanitizeWorldKnowledge = sanitizeWorldKnowledge;
  Core.__saveSystemInstalled = true;

  return Core;
});
