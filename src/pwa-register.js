(() => {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is progressive enhancement; gameplay must remain usable.
    });
  });
})();
