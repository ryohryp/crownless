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
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "expedition.css";
  head.appendChild(css);

  const domain = document.createElement("script");
  domain.src = "src/expedition-system.js";
  domain.onload = function loadExpeditionPresentation() {
    const presentation = document.createElement("script");
    presentation.src = "src/expedition-presentation.js";
    document.body.appendChild(presentation);
  };
  document.body.appendChild(domain);
})();
