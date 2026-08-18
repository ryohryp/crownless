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

// These files are parsed before app.js. Location discovery owns data loading,
// while the start gate owns the short loading transition before app.js renders
// the first exploration choices.
if (typeof document !== "undefined" && document.readyState === "loading") {
  document.write('<script src="src/discovery-provider.js"></script>');
  document.write('<script src="src/geography-api-provider.js"></script>');
  document.write('<script src="src/location-discovery-runtime.js"></script>');
  document.write('<script src="src/expedition-start-gate.js"></script>');
}
