(() => {
  "use strict";
  const N = window.CrownlessNeighboringLands;
  if (!N) return;

  const DEMO_REGIONS = Object.freeze({
    wood: { regionKey: "35.750,139.850", label: "森の入口" },
    tower: { regionKey: "35.760,139.860", label: "丘の地域" },
    fen: { regionKey: "35.770,139.870", label: "水辺の地域" },
    crypt: { regionKey: "35.780,139.880", label: "南の地域" }
  });

  let previous = DEMO_REGIONS.wood;
  let continuityState = {};
  let latest = null;

  function renderConnection() {
    const host = document.querySelector(".map-home-detail");
    if (!host || !latest) return;
    const old = host.querySelector("[data-neighboring-lands]");
    if (old) old.remove();
    const card = document.createElement("aside");
    card.dataset.neighboringLands = "true";
    card.className = "notice map-home-notice";
    card.setAttribute("role", "status");
    card.innerHTML = `<strong>${latest.title}</strong><br>${latest.text}<br><small>${latest.fromLabel} → ${latest.toLabel} · ${latest.followUp}</small>`;
    host.prepend(card);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest('[data-action="scout"]');
    if (!button) return;
    const current = DEMO_REGIONS[button.dataset.value];
    if (!current) return;
    const result = N.connectNeighboringLands(previous, current, continuityState);
    continuityState = result.state;
    previous = current;
    if (!result.connection) return;
    latest = result.connection;
    setTimeout(renderConnection, 0);
  });
})();
