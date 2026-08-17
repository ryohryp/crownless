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

// This file is parsed before app.js. Load the optional location-discovery
// boundary synchronously so it can wrap exploration generation before the app
// installs its expedition click handlers. The feature still degrades to the
// normal simulated exploration path if location or network access is denied.
if (typeof document !== "undefined" && document.readyState === "loading") {
  document.write('<script src="src/discovery-provider.js"><\\/script>');
  document.write('<script src="src/location-discovery-runtime.js"><\\/script>');
}
