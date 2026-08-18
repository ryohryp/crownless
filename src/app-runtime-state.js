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
