(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessTerritoryMobileDeclutter = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerritoryMobileDeclutter() {
  "use strict";

  const MOBILE_MAX = 700;
  const MIN_GAP = 42;
  const CANDIDATE_OFFSETS = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: -24, y: -14 }),
    Object.freeze({ x: 24, y: 14 }),
    Object.freeze({ x: -18, y: 22 }),
    Object.freeze({ x: 18, y: -22 }),
    Object.freeze({ x: 0, y: 28 }),
  ]);

  function distance(a, b) {
    return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
  }

  function layoutOffsets(pointsInput, minGap = MIN_GAP) {
    const points = Array.isArray(pointsInput) ? pointsInput : [];
    const placed = [];
    return points.map((point, index) => {
      const base = { x: Number(point && point.x) || 0, y: Number(point && point.y) || 0 };
      let choice = CANDIDATE_OFFSETS[0];
      for (const candidate of CANDIDATE_OFFSETS) {
        const next = { x: base.x + candidate.x, y: base.y + candidate.y };
        if (placed.every((other) => distance(next, other) >= minGap)) {
          choice = candidate;
          break;
        }
      }
      const finalPoint = { x: base.x + choice.x, y: base.y + choice.y };
      placed.push(finalPoint);
      return { key: String(point && point.key || index), x: choice.x, y: choice.y };
    });
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("territory-mobile-declutter-styles")) return false;
    const style = document.createElement("style");
    style.id = "territory-mobile-declutter-styles";
    style.textContent = `
      @media (max-width:${MOBILE_MAX}px) {
        #world-atlas-viewer .world-atlas-map--nearby [data-territory-declutter="true"] {
          translate: var(--territory-declutter-x,0px) var(--territory-declutter-y,0px);
        }
        #world-atlas-viewer .world-atlas-map--nearby [data-territory-key]:not(.active):not([data-territory-frontier="true"]) > span {
          max-width:0 !important;
          opacity:0 !important;
          overflow:hidden !important;
          pointer-events:none !important;
        }
        #world-atlas-viewer .world-atlas-map--nearby [data-territory-key][data-territory-frontier="true"] > span,
        #world-atlas-viewer .world-atlas-map--nearby [data-territory-key].active > span {
          max-width:118px !important;
        }
        #world-atlas-viewer .world-atlas-map--nearby .territory-frontier-note {
          font-size:6px !important;
          letter-spacing:.03em !important;
        }
        #world-atlas-viewer .territory-atlas-summary {
          top:6px !important;
          right:6px !important;
          width:142px !important;
          padding:5px 7px !important;
          background:rgba(12,11,9,.82) !important;
        }
        #world-atlas-viewer .territory-atlas-summary small { display:none !important; }
        #world-atlas-viewer .territory-atlas-summary strong { margin-top:0 !important; font-size:10px !important; }
        #world-atlas-viewer .territory-atlas-summary span { margin-top:2px !important; font-size:7px !important; line-height:1.25 !important; }
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  function resetMarkers(markers) {
    markers.forEach((marker) => {
      marker.style.removeProperty("--territory-declutter-x");
      marker.style.removeProperty("--territory-declutter-y");
      delete marker.dataset.territoryDeclutter;
    });
  }

  function apply(document, root) {
    if (!document || !root) return 0;
    const map = document.querySelector("#world-atlas-viewer .world-atlas-map--nearby");
    if (!map) return 0;
    const markers = Array.from(map.querySelectorAll("[data-territory-key]"));
    resetMarkers(markers);
    if (Number(root.innerWidth) > MOBILE_MAX || markers.length < 2) return 0;

    const points = markers.map((marker, index) => {
      const rect = marker.getBoundingClientRect();
      return {
        key: marker.dataset.territoryKey || String(index),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });
    const offsets = layoutOffsets(points);
    let changed = 0;
    offsets.forEach((offset, index) => {
      const marker = markers[index];
      marker.dataset.territoryDeclutter = "true";
      marker.style.setProperty("--territory-declutter-x", `${offset.x}px`);
      marker.style.setProperty("--territory-declutter-y", `${offset.y}px`);
      if (offset.x || offset.y) changed += 1;
    });
    return changed;
  }

  function schedule(document, root) {
    if (!document || !root || root.__territoryMobileDeclutterScheduled) return false;
    root.__territoryMobileDeclutterScheduled = true;
    const run = () => {
      root.__territoryMobileDeclutterScheduled = false;
      apply(document, root);
    };
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(run);
    else Promise.resolve().then(run);
    return true;
  }

  function install(root) {
    const document = root && root.document;
    if (!document) return false;
    ensureStyles(document);
    if (root.__territoryMobileDeclutterInstalled) {
      schedule(document, root);
      return true;
    }
    root.__territoryMobileDeclutterInstalled = true;
    root.addEventListener?.("resize", () => schedule(document, root));
    root.addEventListener?.("crownless:territory-updated", () => schedule(document, root));
    root.addEventListener?.("crownless:territory-reward-updated", () => schedule(document, root));
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(".world-atlas-home-entry, .world-atlas-nearby-marker, .world-atlas-marker, .world-atlas-details-toggle")) {
        schedule(document, root);
      }
    });
    if (typeof root.MutationObserver === "function" && document.body) {
      const observer = new root.MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node?.nodeType === 1 && (
          node.matches?.(".world-atlas-map--nearby, [data-territory-key]") || node.querySelector?.(".world-atlas-map--nearby, [data-territory-key]")
        )));
        if (relevant) schedule(document, root);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    schedule(document, root);
    return true;
  }

  return Object.freeze({ MOBILE_MAX, MIN_GAP, CANDIDATE_OFFSETS, distance, layoutOffsets, apply, schedule, install });
});
