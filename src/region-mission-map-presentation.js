(() => {
  "use strict";

  const Core = window.CrownlessCore;
  const exploreScreen = document.getElementById("explore-screen");
  const leadList = document.getElementById("lead-list");
  if (!Core || !exploreScreen || !leadList || typeof MutationObserver !== "function") return;

  let scheduled = false;

  function revealedMission() {
    if (typeof Core.getRegionMissionBoard !== "function" || typeof Core.loadSafeState !== "function") return null;
    const safe = Core.loadSafeState();
    const board = Core.getRegionMissionBoard(safe);
    return Array.isArray(board)
      ? board.find((mission) => mission && mission.stage === "investigated" && !mission.completed) || null
      : null;
  }

  function removeMarker(map) {
    const marker = map && map.querySelector(".region-mission-map-point");
    if (marker) marker.remove();
    if (map && map.dataset.regionMissionForcedVisible === "true") {
      map.hidden = true;
      delete map.dataset.regionMissionForcedVisible;
    }
  }

  function ensureMarker() {
    const map = document.getElementById("exploration-sketch-map");
    if (!map) return;
    const mission = revealedMission();
    if (!mission) {
      removeMarker(map);
      return;
    }

    const points = map.querySelector(".sketch-map-points");
    if (!points) return;
    if (map.hidden) {
      map.hidden = false;
      map.dataset.regionMissionForcedVisible = "true";
    }

    let marker = points.querySelector(".region-mission-map-point");
    if (!marker) {
      marker = document.createElement("button");
      marker.type = "button";
      marker.className = "sketch-map-point region-mission-map-point active";
      marker.style.left = "76%";
      marker.style.top = "31%";
      marker.dataset.labelHorizontal = "inset-right";
      marker.dataset.labelVertical = "below";
      marker.setAttribute("aria-label", "地域依頼の追跡地点。街道荒らしの野営地。攻略は灰炉で行う");
      marker.innerHTML = `
        <i class="sketch-map-glyph">⚔</i>
        <small>追</small>
        <span><strong>街道荒らしの野営地</strong><em>追跡地点 / 攻略は灰炉で</em></span>`;
      marker.addEventListener("click", () => {
        const returnButton = document.getElementById("return-from-explore");
        if (returnButton && typeof returnButton.focus === "function") returnButton.focus({ preventScroll: true });
        if (returnButton && typeof returnButton.scrollIntoView === "function") returnButton.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      points.appendChild(marker);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      ensureMarker();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(exploreScreen, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "hidden"]
  });

  document.getElementById("start-expedition")?.addEventListener("click", schedule, true);
  document.getElementById("continue-expedition")?.addEventListener("click", schedule, true);
  document.getElementById("return-again")?.addEventListener("click", schedule, true);
  schedule();
})();
