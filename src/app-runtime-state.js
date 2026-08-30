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
// only from persisted coarse world knowledge. Keep it independent of the
// expedition slice so the map remains available before or between dispatches.
(function loadWorldAtlas() {
  if (typeof document === "undefined" || document.querySelector('script[src="src/world-atlas.js"]')) return;
  const atlas = document.createElement("script");
  atlas.src = "src/world-atlas.js";
  document.body.appendChild(atlas);
})();