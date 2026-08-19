(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory;
    return;
  }

  if (root.CrownlessCore) {
    root.CrownlessCore = factory(root.CrownlessCore);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function installWorldKnowledge(Core) {
  "use strict";

  if (!Core || Core.__worldKnowledgeInstalled) return Core;

  const base = {
    createInitialState: Core.createInitialState,
    beginExpedition: Core.beginExpedition,
    returnHome: Core.returnHome,
    resolveDefeat: Core.resolveDefeat,
    equipItem: Core.equipItem
  };

  const STATE_RANK = { discovered: 1, investigated: 2, cleared: 3 };
  let lastKnownState = null;
  let toastTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value, fallback = "") {
    const result = String(value == null ? "" : value).trim();
    return result || fallback;
  }

  function safeTerrain(value) {
    const source = Array.isArray(value) ? value : [];
    return [...new Set(source.map((item) => text(item)).filter(Boolean))].slice(0, 8);
  }

  function normalizeEntry(value, fallbackKey) {
    if (!value || typeof value !== "object") return null;
    const key = text(value.key || fallbackKey);
    if (!key) return null;
    const state = STATE_RANK[value.state] ? value.state : "discovered";
    const firstDiscoveredAt = Number(value.firstDiscoveredAt);
    return {
      key,
      name: text(value.name, "名もない発見"),
      baseTitle: text(value.baseTitle),
      terrain: safeTerrain(value.terrain),
      contentKind: text(value.contentKind, "unknown"),
      state,
      firstDiscoveredAt: Number.isFinite(firstDiscoveredAt) && firstDiscoveredAt > 0 ? firstDiscoveredAt : 0,
      visits: Math.max(1, Math.floor(Number(value.visits) || 1))
    };
  }

  function ensureWorldKnowledge(state) {
    if (!state || typeof state !== "object") return state;
    const source = state.worldKnowledge && typeof state.worldKnowledge === "object" ? state.worldKnowledge : {};
    const discoveries = source.discoveries && typeof source.discoveries === "object" && !Array.isArray(source.discoveries)
      ? source.discoveries
      : {};
    const normalized = {};
    Object.entries(discoveries).forEach(([key, value]) => {
      const entry = normalizeEntry(value, key);
      if (entry) normalized[entry.key] = entry;
    });
    state.worldKnowledge = { discoveries: normalized };
    return state;
  }

  function geographicIdentity(discovery) {
    if (!discovery || typeof discovery !== "object") return null;
    if (discovery.geographicDiscovery && typeof discovery.geographicDiscovery === "object") {
      return discovery.geographicDiscovery;
    }
    return discovery.sourceRef || discovery.ruleId ? discovery : null;
  }

  function discoveryKey(discovery) {
    const geographic = geographicIdentity(discovery);
    if (geographic) {
      const sourceRef = text(geographic.sourceRef);
      const ruleId = text(geographic.ruleId);
      if (sourceRef && ruleId) return `geo:${sourceRef}:${ruleId}`;
      return null;
    }

    const locationId = text(discovery && discovery.locationId);
    if (locationId) return `sim:${locationId}`;
    return null;
  }

  function stateFromDiscovery(discovery) {
    const candidate = text(discovery && (discovery.knowledgeState || discovery.discoveryState || discovery.state));
    return STATE_RANK[candidate] ? candidate : "discovered";
  }

  function entryFromDiscovery(discovery, key, now) {
    const geographic = geographicIdentity(discovery) || {};
    const terrain = safeTerrain(geographic.features);
    const firstDiscoveredAt = Number(now);
    return {
      key,
      name: text(discovery && discovery.name, text(geographic.title, "名もない発見")),
      baseTitle: text(geographic.baseTitle),
      terrain,
      contentKind: text(geographic.contentKind, text(discovery && discovery.eventKind, "unknown")),
      state: stateFromDiscovery(discovery),
      firstDiscoveredAt: Number.isFinite(firstDiscoveredAt) && firstDiscoveredAt > 0 ? firstDiscoveredAt : Date.now(),
      visits: 1
    };
  }

  function mergeState(previous, nextState) {
    const previousRank = STATE_RANK[previous.state] || 1;
    const nextRank = STATE_RANK[nextState] || 1;
    return nextRank > previousRank ? nextState : previous.state;
  }

  function exportWorldKnowledge(state) {
    ensureWorldKnowledge(state);
    const exported = {};
    Object.entries(state.worldKnowledge.discoveries).forEach(([key, value]) => {
      const entry = normalizeEntry(value, key);
      if (entry) exported[entry.key] = entry;
    });
    return { discoveries: exported };
  }

  function getWorldKnowledge(state) {
    ensureWorldKnowledge(state);
    const discoveries = Object.values(state.worldKnowledge.discoveries)
      .map((entry) => clone(entry))
      .sort((left, right) => (right.firstDiscoveredAt || 0) - (left.firstDiscoveredAt || 0));
    return { count: discoveries.length, discoveries };
  }

  function hasDiscoveryKnowledge(state, discovery) {
    if (!state) return false;
    ensureWorldKnowledge(state);
    const key = typeof discovery === "string" ? discovery : discoveryKey(discovery);
    return Boolean(key && state.worldKnowledge.discoveries[key]);
  }

  function showDiscoveryToast(entry) {
    if (typeof document === "undefined" || !entry) return;
    let toast = document.getElementById("world-knowledge-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "world-knowledge-toast";
      toast.className = "world-knowledge-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<small>NEW DISCOVERY / 探索録</small><strong>${entry.name}</strong><span>羊皮紙に新しい墨印が残った。</span>`;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function recordDiscoveryKnowledge(state, discovery, now = Date.now()) {
    if (!state || !discovery) return { state, key: null, entry: null, isNew: false };
    ensureWorldKnowledge(state);
    const key = discoveryKey(discovery);
    if (!key) return { state, key: null, entry: null, isNew: false };

    const previous = state.worldKnowledge.discoveries[key] || null;
    const incoming = entryFromDiscovery(discovery, key, now);
    const entry = previous
      ? {
          ...previous,
          name: incoming.name || previous.name,
          baseTitle: incoming.baseTitle || previous.baseTitle,
          terrain: incoming.terrain.length ? incoming.terrain : previous.terrain,
          contentKind: incoming.contentKind !== "unknown" ? incoming.contentKind : previous.contentKind,
          state: mergeState(previous, incoming.state),
          visits: Math.max(1, Number(previous.visits) || 1) + 1
        }
      : incoming;

    state.worldKnowledge.discoveries[key] = normalizeEntry(entry, key);
    discovery.discoveryKey = key;
    discovery.isNewDiscovery = !previous;
    remember(state);
    if (!previous) showDiscoveryToast(state.worldKnowledge.discoveries[key]);
    return { state, key, entry: clone(state.worldKnowledge.discoveries[key]), isNew: !previous };
  }

  function injectStyles() {
    if (typeof document === "undefined" || document.getElementById("world-knowledge-styles")) return;
    const style = document.createElement("style");
    style.id = "world-knowledge-styles";
    style.textContent = `
      .world-knowledge-panel { margin:16px 0 0; padding:16px 18px; }
      .world-knowledge-head { display:flex; justify-content:space-between; gap:16px; align-items:end; margin-bottom:10px; }
      .world-knowledge-head h2 { margin:0; }
      .world-knowledge-count { text-align:right; }
      .world-knowledge-count small { display:block; color:var(--dim); font-size:8px; letter-spacing:.12em; }
      .world-knowledge-count strong { color:var(--gold-2); font:34px/1 Georgia,serif; font-weight:400; }
      .world-knowledge-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      .world-knowledge-entry { padding:9px 10px; border-left:1px solid rgba(185,154,85,.42); background:rgba(185,154,85,.035); min-width:0; }
      .world-knowledge-entry small { display:block; color:var(--dim); font-size:8px; letter-spacing:.08em; }
      .world-knowledge-entry strong { display:block; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:14px/1.35 Georgia,serif; font-weight:500; }
      .world-knowledge-empty { color:var(--muted); font-size:10px; line-height:1.5; }
      .lead-knowledge-badge { display:inline-flex; align-items:center; margin-left:7px; padding:2px 5px; border:1px solid rgba(185,154,85,.38); color:#b9a26d; background:rgba(185,154,85,.04); font-size:8px; letter-spacing:.08em; vertical-align:middle; }
      .lead-card.discovery-known { border-color:rgba(185,154,85,.28); }
      .world-knowledge-toast { position:fixed; z-index:1200; left:50%; bottom:max(24px,env(safe-area-inset-bottom)); width:min(88vw,360px); transform:translate(-50%,18px); padding:11px 14px; border:1px solid rgba(185,154,85,.55); background:rgba(24,20,14,.96); box-shadow:0 12px 36px rgba(0,0,0,.35); opacity:0; pointer-events:none; transition:opacity .18s ease,transform .18s ease; }
      .world-knowledge-toast.show { opacity:1; transform:translate(-50%,0); }
      .world-knowledge-toast small,.world-knowledge-toast span { display:block; color:#a99b7d; font-size:8px; line-height:1.4; }
      .world-knowledge-toast strong { display:block; margin:3px 0; color:#e3cf9a; font:16px/1.3 Georgia,serif; font-weight:500; }
      @media (max-width:560px) { .world-knowledge-list { grid-template-columns:1fr; } .world-knowledge-panel { padding:14px; } }
      @media (prefers-reduced-motion:reduce) { .world-knowledge-toast { transition:none; } }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (typeof document === "undefined") return null;
    injectStyles();
    let panel = document.getElementById("world-knowledge-panel");
    if (panel) return panel;
    const hub = document.getElementById("hub-screen");
    const grid = hub && hub.querySelector(".hub-grid");
    if (!hub || !grid) return null;
    panel = document.createElement("section");
    panel.id = "world-knowledge-panel";
    panel.className = "panel world-knowledge-panel";
    hub.insertBefore(panel, grid);
    return panel;
  }

  function renderWorldKnowledge(state) {
    if (!state || typeof document === "undefined") return;
    const panel = ensurePanel();
    if (!panel) return;
    const data = getWorldKnowledge(state);
    const recent = data.discoveries.slice(0, 4);
    panel.innerHTML = `
      <div class="world-knowledge-head">
        <div><p class="eyebrow">DISCOVERY JOURNAL / WORLD KNOWLEDGE</p><h2>探索録</h2></div>
        <div class="world-knowledge-count"><small>DISCOVERED</small><strong id="world-knowledge-count">${data.count}</strong></div>
      </div>
      ${recent.length
        ? `<div class="world-knowledge-list">${recent.map((entry) => `<div class="world-knowledge-entry"><small>${entry.state.toUpperCase()} · VISIT ${entry.visits}</small><strong>${entry.name}</strong></div>`).join("")}</div>`
        : `<div class="world-knowledge-empty">まだ白紙だ。現実の周囲から何かを見つけると、ここに墨印が残る。</div>`}
    `;
  }

  function remember(state) {
    if (!state) return state;
    ensureWorldKnowledge(state);
    lastKnownState = state;
    if (typeof document !== "undefined") queueMicrotask(() => renderWorldKnowledge(state));
    return state;
  }

  Core.createInitialState = function createInitialStateWithWorldKnowledge() {
    return remember(ensureWorldKnowledge(base.createInitialState()));
  };

  Core.beginExpedition = function beginExpeditionWithWorldKnowledge(state, seed) {
    return remember(base.beginExpedition(ensureWorldKnowledge(clone(state)), seed));
  };

  Core.returnHome = function returnHomeWithWorldKnowledge(state) {
    return remember(base.returnHome(ensureWorldKnowledge(clone(state))));
  };

  Core.resolveDefeat = function resolveDefeatWithWorldKnowledge(state) {
    return remember(base.resolveDefeat(ensureWorldKnowledge(clone(state))));
  };

  Core.equipItem = function equipItemWithWorldKnowledge(state, itemId) {
    return remember(base.equipItem(ensureWorldKnowledge(clone(state)), itemId));
  };

  Core.discoveryKey = discoveryKey;
  Core.recordDiscoveryKnowledge = recordDiscoveryKnowledge;
  Core.hasDiscoveryKnowledge = hasDiscoveryKnowledge;
  Core.getWorldKnowledge = getWorldKnowledge;
  Core.exportWorldKnowledge = exportWorldKnowledge;
  Core.syncWorldKnowledgePresentation = remember;
  Core.__worldKnowledgeInstalled = true;

  return Core;
});
