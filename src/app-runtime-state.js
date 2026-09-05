"use strict";

// Runtime state shared with the classic-script app bundle.
// Keep these as `var` bindings so unqualified references inside src/app.js
// resolve through the browser global environment.
var lastReturnReport = null;
var soundEnabled = (function readInitialSoundPreference() {
  try {
    return localStorage.getItem("crownless.sound") !== "off";
  } catch (_) {
    return true;
  }
})();
var audioContext = null;

// Issue #193: load the new idle-expedition slice independently from the
// transition-era action runtime. This keeps the PoC reversible while letting
// the Grey Hearth dispatch gate become the new playable entry point.
(function loadIdleExpeditionSlice() {
  if (typeof document === "undefined") return;
  const head = document.head || document.documentElement;
  const gate = document.getElementById("start-expedition");
  let loading = false;
  let queued = false;
  // This capture handler always owns the gate; no click can reach old combat.
  if (gate) gate.addEventListener("click", function holdGateUntilExpeditionReady(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (window.CrownlessExpeditionPresentation?.isReady()) {
      window.CrownlessExpeditionPresentation.open();
    } else { queued = true; load(); }
  }, true);
  ["expedition.css", "expedition-kamishibai.css", "expedition-kamishibai-battle.css", "expedition-journey.css"].forEach(href => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = href; head.appendChild(css);
  });
  function script(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const node = document.createElement("script");
      node.src = src;
      node.onload = () => window[globalName] ? resolve() : reject(new Error(src));
      node.onerror = () => { node.remove(); reject(new Error(src)); };
      document.body.appendChild(node);
    });
  }
  async function load() {
    if (loading) return;
    loading = true;
    try {
      await script("src/expedition-system.js", "CrownlessExpeditionSystem");
      await script("src/expedition-unknown-bridge.js", "CrownlessExpeditionUnknownBridge");
      await window.CrownlessExpeditionUnknownBridge.loadRuntime(window);
      await script("src/geographic-expedition-bridge.js", "CrownlessGeographicExpeditionBridge");
      await script("src/expedition-journey.js", "CrownlessExpeditionJourney");
      await script("src/expedition-narrative.js", "CrownlessExpeditionNarrative").catch(() => {});
      await script("src/expedition-scenes.js", "CrownlessExpeditionScenes").catch(() => {});
      await script("src/expedition-visual-composition.js", "CrownlessExpeditionVisualComposition").catch(() => {});
      await script("src/expedition-presentation.js", "CrownlessExpeditionPresentation");
      if (queued) { queued = false; window.CrownlessExpeditionPresentation.open(); }
    } catch (_) {
      const copy = gate?.querySelector(".object-label strong");
      if (copy) copy.textContent = "遠征台帳を再読込 →";
      const detail = gate?.querySelector(".object-label span:last-child");
      if (detail) detail.textContent = "準備を読み込めなかった。もう一度押すと再試行する。";
    } finally { loading = false; }
  }
  window.CrownlessExpeditionRuntime = { retry: load };
  load();
})();

// Issue #216: the Grey Hearth wall map opens a manuscript-style atlas built
// only from persisted coarse world knowledge. Issue #222 adds deterministic
// Crownless lore, while #224 turns each selected discovery into an action hub.
(function loadWorldAtlas() {
  if (typeof document === "undefined") return;
  const wallMap = document.getElementById("hearth-map-focus");
  const runtimeVersion = (() => {
    const current = document.currentScript;
    if (!current || !current.src) return "";
    try {
      return new URL(current.src, document.baseURI).searchParams.get("v") || "";
    } catch (_) {
      return "";
    }
  })();
  const atlasAsset = (path) => runtimeVersion ? `${path}?v=${encodeURIComponent(runtimeVersion)}` : path;
  const findAtlasScript = (path) => {
    const expected = atlasAsset(path);
    const scripts = Array.from(document.scripts || []);
    return scripts.find((script) => script.getAttribute("src") === expected)
      || scripts.find((script) => script.getAttribute("src") === path)
      || null;
  };
  let atlasReady = Boolean(window.CrownlessWorldAtlas);
  let atlasReplayQueued = false;
  let atlasLoadFailed = false;

  // The Atlas is the only supported wall-map entry point. Hold every tap until
  // its capture listener is installed. A failed load must never release the
  // click into the older Hearth/discovery handlers; the next tap retries the
  // versioned Atlas asset instead.
  if (wallMap) {
    wallMap.addEventListener("click", function holdWallMapUntilAtlasReady(event) {
      if (atlasReady) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      atlasReplayQueued = true;
      if (atlasLoadFailed) {
        atlasLoadFailed = false;
        loadAtlas();
      }
    }, true);
  }

  function finishAtlasReady() {
    atlasReady = true;
    atlasLoadFailed = false;
    if (atlasReplayQueued && wallMap) {
      atlasReplayQueued = false;
      window.CrownlessWorldAtlas.openAtlas(document, window.CrownlessCore, window);
    }
  }

  function failAtlasLoad(event) {
    atlasReady = false;
    atlasLoadFailed = true;
    const failedScript = event && event.currentTarget;
    if (failedScript && typeof failedScript.remove === "function") failedScript.remove();
    const mapStatus = document.getElementById("hearth-map-status");
    if (mapStatus) mapStatus.textContent = "地図を読み込めなかった。もう一度触れると再試行する。";
  }

  function loadActionsPresentation() {
    if (findAtlasScript("src/world-atlas-actions-presentation.js")) return;
    const presentation = document.createElement("script");
    presentation.src = atlasAsset("src/world-atlas-actions-presentation.js");
    document.body.appendChild(presentation);
  }

  function loadActionsDomain() {
    const existingActions = findAtlasScript("src/discovery-actions.js");
    if (existingActions) {
      if (window.CrownlessDiscoveryActions) loadActionsPresentation();
      else {
        existingActions.addEventListener("load", loadActionsPresentation, { once: true });
        existingActions.addEventListener("error", loadActionsPresentation, { once: true });
      }
      return;
    }
    const actions = document.createElement("script");
    actions.src = atlasAsset("src/discovery-actions.js");
    actions.onload = loadActionsPresentation;
    actions.onerror = loadActionsPresentation;
    document.body.appendChild(actions);
  }

  function loadLorePresentation() {
    const existingLorePresentation = findAtlasScript("src/world-atlas-lore-presentation.js");
    if (existingLorePresentation) {
      if (window.CrownlessWorldAtlasLorePresentation) loadActionsDomain();
      else {
        existingLorePresentation.addEventListener("load", loadActionsDomain, { once: true });
        existingLorePresentation.addEventListener("error", loadActionsDomain, { once: true });
      }
      return;
    }
    const lorePresentation = document.createElement("script");
    lorePresentation.src = atlasAsset("src/world-atlas-lore-presentation.js");
    lorePresentation.onload = loadActionsDomain;
    lorePresentation.onerror = loadActionsDomain;
    document.body.appendChild(lorePresentation);
  }

  function loadReunionPresentation() {
    const existingPresentation = findAtlasScript("src/world-atlas-reunion-presentation.js");
    if (existingPresentation) {
      if (window.CrownlessWorldAtlasReunionPresentation) loadLorePresentation();
      else {
        existingPresentation.addEventListener("load", loadLorePresentation, { once: true });
        existingPresentation.addEventListener("error", loadLorePresentation, { once: true });
      }
      return;
    }
    const presentation = document.createElement("script");
    presentation.src = atlasAsset("src/world-atlas-reunion-presentation.js");
    presentation.onload = loadLorePresentation;
    presentation.onerror = loadLorePresentation;
    document.body.appendChild(presentation);
  }

  function loadReunionEncounter() {
    const existingEncounter = findAtlasScript("src/npc-reunion-encounter.js");
    if (existingEncounter) {
      if (window.CrownlessNpcReunionEncounter) loadReunionPresentation();
      else {
        existingEncounter.addEventListener("load", loadReunionPresentation, { once: true });
        existingEncounter.addEventListener("error", loadReunionPresentation, { once: true });
      }
      return;
    }
    const encounter = document.createElement("script");
    encounter.src = atlasAsset("src/npc-reunion-encounter.js");
    encounter.onload = loadReunionPresentation;
    encounter.onerror = loadReunionPresentation;
    document.body.appendChild(encounter);
  }

  function loadNpcSignals() {
    const existingSignals = findAtlasScript("src/world-atlas-npc-signals.js");
    if (existingSignals) {
      if (window.CrownlessWorldAtlasNpcSignals) loadReunionEncounter();
      else {
        existingSignals.addEventListener("load", loadReunionEncounter, { once: true });
        existingSignals.addEventListener("error", loadReunionEncounter, { once: true });
      }
      return;
    }
    const signals = document.createElement("script");
    signals.src = atlasAsset("src/world-atlas-npc-signals.js");
    signals.onload = loadReunionEncounter;
    signals.onerror = loadReunionEncounter;
    document.body.appendChild(signals);
  }

  function loadNpcLifeForAtlas() {
    const existingNpcLife = findAtlasScript("src/npc-life.js");
    if (existingNpcLife) {
      if (window.CrownlessNpcLife) loadNpcSignals();
      else {
        existingNpcLife.addEventListener("load", loadNpcSignals, { once: true });
        existingNpcLife.addEventListener("error", loadNpcSignals, { once: true });
      }
      return;
    }
    const npcLife = document.createElement("script");
    npcLife.src = atlasAsset("src/npc-life.js");
    npcLife.onload = loadNpcSignals;
    npcLife.onerror = loadNpcSignals;
    document.body.appendChild(npcLife);
  }

  function loadSelectionPreview(event) {
    if (!window.CrownlessWorldAtlas) {
      failAtlasLoad(event);
      return;
    }
    finishAtlasReady();
    const existingPreview = findAtlasScript("src/world-atlas-selection-preview.js");
    if (existingPreview) {
      if (window.CrownlessWorldAtlasPreview) loadNpcLifeForAtlas();
      else {
        existingPreview.addEventListener("load", loadNpcLifeForAtlas, { once: true });
        existingPreview.addEventListener("error", loadNpcLifeForAtlas, { once: true });
      }
      return;
    }
    const preview = document.createElement("script");
    preview.src = atlasAsset("src/world-atlas-selection-preview.js");
    preview.onload = loadNpcLifeForAtlas;
    preview.onerror = loadNpcLifeForAtlas;
    document.body.appendChild(preview);
  }

  function loadAtlas() {
    const existingAtlas = findAtlasScript("src/world-atlas.js");
    if (existingAtlas) {
      if (window.CrownlessWorldAtlas) loadSelectionPreview();
      else {
        existingAtlas.addEventListener("load", loadSelectionPreview, { once: true });
        existingAtlas.addEventListener("error", failAtlasLoad, { once: true });
      }
      return;
    }
    const atlas = document.createElement("script");
    atlas.src = atlasAsset("src/world-atlas.js");
    atlas.onload = loadSelectionPreview;
    atlas.onerror = failAtlasLoad;
    document.body.appendChild(atlas);
  }

  const existingLore = findAtlasScript("src/discovery-lore.js");
  if (existingLore) {
    if (window.CrownlessDiscoveryLore) loadAtlas();
    else {
      existingLore.addEventListener("load", loadAtlas, { once: true });
      existingLore.addEventListener("error", loadAtlas, { once: true });
    }
    return;
  }
  const lore = document.createElement("script");
  lore.src = atlasAsset("src/discovery-lore.js");
  lore.onload = loadAtlas;
  lore.onerror = loadAtlas;
  document.body.appendChild(lore);
})();