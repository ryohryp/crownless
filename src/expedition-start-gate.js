(() => {
  "use strict";
  const runtime = window.CrownlessLocationDiscoveryRuntime;
  const startButton = document.getElementById("start-expedition");
  if (!runtime || !startButton) return;

  let replaying = false;

  function showExplorationLoading() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
    const explore = document.getElementById("explore-screen");
    if (explore) explore.classList.add("active");
    runtime.showPending();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  startButton.addEventListener("click", (event) => {
    if (replaying) {
      replaying = false;
      return;
    }

    event.stopImmediatePropagation();
    const discovery = runtime.begin();
    showExplorationLoading();

    discovery.finally(() => {
      replaying = true;
      startButton.click();
      runtime.finish();
    });
  });
})();
