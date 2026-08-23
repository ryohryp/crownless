(() => {
  "use strict";

  const exploreScreen = document.getElementById("explore-screen");
  const leadList = document.getElementById("lead-list");
  if (!exploreScreen || !leadList || typeof MutationObserver !== "function") return;

  let scheduled = false;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function regionalTargetCard() {
    return leadList.querySelector('.lead-card[data-discovery-source="region-mission"]');
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
    const card = regionalTargetCard();
    if (!card) {
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
      marker.setAttribute("aria-label", "地域依頼の追跡地点。街道荒らしの野営地");
      marker.innerHTML = `
        <i class="sketch-map-glyph">⚔</i>
        <small>追</small>
        <span><strong></strong><em>地域依頼 / 追跡地点</em></span>`;
      marker.addEventListener("click", () => {
        const current = regionalTargetCard();
        if (!current) return;
        if (typeof current.focus === "function") current.focus({ preventScroll: true });
        if (typeof current.scrollIntoView === "function") current.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      points.appendChild(marker);
    }

    const title = card.querySelector("h3")?.textContent?.trim() || "街道荒らしの野営地";
    setText(marker.querySelector("strong"), title);
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
    attributeFilter: ["class", "data-discovery-source", "hidden"]
  });

  document.getElementById("start-expedition")?.addEventListener("click", schedule, true);
  document.getElementById("continue-expedition")?.addEventListener("click", schedule, true);
  document.getElementById("return-again")?.addEventListener("click", schedule, true);
  schedule();
})();
