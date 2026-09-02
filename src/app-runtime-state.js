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
  let presentationReady = false;
  let replayQueued = false;

  // app.js still owns the transition-era click handler. The expedition slice
  // is loaded dynamically, so a fast click can otherwise reach that old
  // handler before expedition-presentation.js has installed its capture
  // listener. Hold the click until the new entry point is ready.
  if (gate) {
    gate.addEventListener("click", function holdGateUntilExpeditionReady(event) {
      if (presentationReady) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      replayQueued = true;
    }, true);
  }

  ["expedition.css", "expedition-kamishibai.css", "expedition-kamishibai-battle.css"].forEach((href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = href;
    head.appendChild(css);
  });

  function finishExpeditionPresentationReady() {
    presentationReady = true;
    if (replayQueued && gate) {
      replayQueued = false;
      gate.click();
    }
  }

  function loadGeographicExpeditionBridge() {
    if (document.querySelector('script[src="src/geographic-expedition-bridge.js"]')) {
      finishExpeditionPresentationReady();
      return;
    }
    const bridge = document.createElement("script");
    bridge.src = "src/geographic-expedition-bridge.js";
    bridge.onload = finishExpeditionPresentationReady;
    bridge.onerror = finishExpeditionPresentationReady;
    document.body.appendChild(bridge);
  }

  function loadExpeditionDomain() {
    const domain = document.createElement("script");
    domain.src = "src/expedition-system.js";
    domain.onload = function loadExpeditionPresentation() {
      const presentation = document.createElement("script");
      presentation.src = "src/expedition-presentation.js";
      presentation.onload = loadGeographicExpeditionBridge;
      document.body.appendChild(presentation);
    };
    document.body.appendChild(domain);
  }

  // Issue #211: battle compositions remain a pure optional presentation layer.
  // A missing helper must never block deterministic expedition resolution or
  // the existing single-asset kamishibai fallback.
  function loadExpeditionComposition() {
    const composition = document.createElement("script");
    composition.src = "src/expedition-visual-composition.js";
    composition.onload = loadExpeditionDomain;
    composition.onerror = loadExpeditionDomain;
    document.body.appendChild(composition);
  }

  // Issue #203: representative paper-theatre scenes are another pure
  // projection of a completed report. Keep this optional so a scene-layer
  // loading failure never blocks the deterministic expedition resolver.
  function loadExpeditionScenes() {
    const scenes = document.createElement("script");
    scenes.src = "src/expedition-scenes.js";
    scenes.onload = loadExpeditionComposition;
    scenes.onerror = loadExpeditionComposition;
    document.body.appendChild(scenes);
  }

  // Issue #200: narrative generation is a separate deterministic projection of
  // raw combat state. Load it independently so resolver rules never depend on
  // prose generation, while the report presentation can opt into the layer.
  const narrative = document.createElement("script");
  narrative.src = "src/expedition-narrative.js";
  narrative.onload = loadExpeditionScenes;
  narrative.onerror = loadExpeditionScenes;
  document.body.appendChild(narrative);
})();

// Issue #216: the Grey Hearth wall map opens a manuscript-style atlas built
// only from persisted coarse world knowledge. Issue #222 adds deterministic
// Crownless lore, while #224 turns each selected discovery into an action hub.
(function loadWorldAtlas() {
  if (typeof document === "undefined") return;
  const wallMap = document.getElementById("hearth-map-focus");
  let atlasReady = Boolean(window.CrownlessWorldAtlas);
  let atlasReplayQueued = false;

  // The atlas is loaded dynamically. On a slow mobile connection, the wall-map
  // can be tapped before world-atlas.js installs its capture listener; without
  // this guard the older Hearth click handler opens the legacy discovery view.
  // Hold that first tap and replay it once the canonical Atlas entry point is
  // available, matching the readiness guard used by the expedition gate above.
  if (wallMap) {
    wallMap.addEventListener("click", function holdWallMapUntilAtlasReady(event) {
      if (atlasReady) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      atlasReplayQueued = true;
    }, true);
  }

  function finishAtlasReady() {
    atlasReady = true;
    if (atlasReplayQueued && wallMap) {
      atlasReplayQueued = false;
      wallMap.click();
    }
  }

  function loadActionsPresentation() {
    if (document.querySelector('script[src="src/world-atlas-actions-presentation.js"]')) return;
    const presentation = document.createElement("script");
    presentation.src = "src/world-atlas-actions-presentation.js";
    document.body.appendChild(presentation);
  }

  function loadActionsDomain() {
    const existingActions = document.querySelector('script[src="src/discovery-actions.js"]');
    if (existingActions) {
      if (window.CrownlessDiscoveryActions) loadActionsPresentation();
      else {
        existingActions.addEventListener("load", loadActionsPresentation, { once: true });
        existingActions.addEventListener("error", loadActionsPresentation, { once: true });
      }
      return;
    }
    const actions = document.createElement("script");
    actions.src = "src/discovery-actions.js";
    actions.onload = loadActionsPresentation;
    actions.onerror = loadActionsPresentation;
    document.body.appendChild(actions);
  }

  function loadLorePresentation() {
    const existingLorePresentation = document.querySelector('script[src="src/world-atlas-lore-presentation.js"]');
    if (existingLorePresentation) {
      if (window.CrownlessWorldAtlasLorePresentation) loadActionsDomain();
      else {
        existingLorePresentation.addEventListener("load", loadActionsDomain, { once: true });
        existingLorePresentation.addEventListener("error", loadActionsDomain, { once: true });
      }
      return;
    }
    const lorePresentation = document.createElement("script");
    lorePresentation.src = "src/world-atlas-lore-presentation.js";
    lorePresentation.onload = loadActionsDomain;
    lorePresentation.onerror = loadActionsDomain;
    document.body.appendChild(lorePresentation);
  }

  function loadReunionPresentation() {
    const existingPresentation = document.querySelector('script[src="src/world-atlas-reunion-presentation.js"]');
    if (existingPresentation) {
      if (window.CrownlessWorldAtlasReunionPresentation) loadLorePresentation();
      else {
        existingPresentation.addEventListener("load", loadLorePresentation, { once: true });
        existingPresentation.addEventListener("error", loadLorePresentation, { once: true });
      }
      return;
    }
    const presentation = document.createElement("script");
    presentation.src = "src/world-atlas-reunion-presentation.js";
    presentation.onload = loadLorePresentation;
    presentation.onerror = loadLorePresentation;
    document.body.appendChild(presentation);
  }

  function loadReunionEncounter() {
    const existingEncounter = document.querySelector('script[src="src/npc-reunion-encounter.js"]');
    if (existingEncounter) {
      if (window.CrownlessNpcReunionEncounter) loadReunionPresentation();
      else {
        existingEncounter.addEventListener("load", loadReunionPresentation, { once: true });
        existingEncounter.addEventListener("error", loadReunionPresentation, { once: true });
      }
      return;
    }
    const encounter = document.createElement("script");
    encounter.src = "src/npc-reunion-encounter.js";
    encounter.onload = loadReunionPresentation;
    encounter.onerror = loadReunionPresentation;
    document.body.appendChild(encounter);
  }

  function loadNpcLifeForAtlas() {
    const existingNpcLife = document.querySelector('script[src="src/npc-life.js"]');
    if (existingNpcLife) {
      if (window.CrownlessNpcLife) loadReunionEncounter();
      else {
        existingNpcLife.addEventListener("load", loadReunionEncounter, { once: true });
        existingNpcLife.addEventListener("error", loadReunionEncounter, { once: true });
      }
      return;
    }
    const npcLife = document.createElement("script");
    npcLife.src = "src/npc-life.js";
    npcLife.onload = loadReunionEncounter;
    npcLife.onerror = loadReunionEncounter;
    document.body.appendChild(npcLife);
  }

  function loadSelectionPreview() {
    const existingPreview = document.querySelector('script[src="src/world-atlas-selection-preview.js"]');
    if (existingPreview) {
      if (window.CrownlessWorldAtlasPreview) loadNpcLifeForAtlas();
      else {
        existingPreview.addEventListener("load", loadNpcLifeForAtlas, { once: true });
        existingPreview.addEventListener("error", loadNpcLifeForAtlas, { once: true });
      }
      return;
    }
    const preview = document.createElement("script");
    preview.src = "src/world-atlas-selection-preview.js";
    preview.onload = loadNpcLifeForAtlas;
    preview.onerror = loadNpcLifeForAtlas;
    document.body.appendChild(preview);
  }

  function atlasLoaded() {
    finishAtlasReady();
    loadSelectionPreview();
  }

  function atlasFailed() {
    finishAtlasReady();
    loadSelectionPreview();
  }

  function loadAtlas() {
    const existingAtlas = document.querySelector('script[src="src/world-atlas.js"]');
    if (existingAtlas) {
      if (window.CrownlessWorldAtlas) atlasLoaded();
      else {
        existingAtlas.addEventListener("load", atlasLoaded, { once: true });
        existingAtlas.addEventListener("error", atlasFailed, { once: true });
      }
      return;
    }
    const atlas = document.createElement("script");
    atlas.src = "src/world-atlas.js";
    atlas.onload = atlasLoaded;
    atlas.onerror = atlasFailed;
    document.body.appendChild(atlas);
  }

  const existingLore = document.querySelector('script[src="src/discovery-lore.js"]');
  if (existingLore) {
    if (window.CrownlessDiscoveryLore) loadAtlas();
    else {
      existingLore.addEventListener("load", loadAtlas, { once: true });
      existingLore.addEventListener("error", loadAtlas, { once: true });
    }
    return;
  }
  const lore = document.createElement("script");
  lore.src = "src/discovery-lore.js";
  lore.onload = loadAtlas;
  lore.onerror = loadAtlas;
  document.body.appendChild(lore);
})();
