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

// Location discovery augments exploration data but never owns navigation.
// app.js remains the single authority for entering the expedition screen.
if (typeof document !== "undefined" && document.readyState === "loading") {
  document.write('<link rel="stylesheet" href="location-discovery.css">');
  document.write('<script src="src/discovery-provider.js"></script>');
  document.write('<script src="src/geography-api-provider.js"></script>');
  document.write('<script src="src/location-discovery-runtime.js"></script>');
}
