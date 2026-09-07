(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessTerritoryMobileDeclutter = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerritoryMobileDeclutter() {
  "use strict";

  const MOBILE_MAX = 700;
  const MIN_GAP = 24;
  const PAYOFF_MS = 3200;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const CANDIDATE_OFFSETS = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: -24, y: -14 }),
    Object.freeze({ x: 24, y: 14 }),
    Object.freeze({ x: -18, y: 22 }),
    Object.freeze({ x: 18, y: -22 }),
    Object.freeze({ x: 0, y: 28 }),
  ]);

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

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

  function conquestPayoffTarget(root) {
    const Territory = root && root.CrownlessTerritoryPhase1;
    if (!Territory || typeof Territory.territories !== "function") return null;
    let models = [];
    try { models = Territory.territories(root); } catch (_) { return null; }
    const next = (Array.isArray(models) ? models : []).find((item) => item && item.owner !== "player");
    if (!next) return null;
    const key = cleanText(next.key);
    if (!key) return null;
    const effect = cleanText(next.meta && next.meta.effect);
    const value = cleanText(next.meta && next.meta.value);
    const reason = effect && !/Phase\s*1/i.test(effect)
      ? `取れば、${effect.replace(/[。.]+$/, "")}。`
      : value
        ? `取れば、${value.replace(/[。.]+$/, "")}。`
        : "取れば、次の攻略条件が変わる。";
    return {
      key,
      name: cleanText(next.entry && next.entry.name, "次の地点"),
      reason,
    };
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("territory-mobile-declutter-styles")) return false;
    const style = document.createElement("style");
    style.id = "territory-mobile-declutter-styles";
    style.textContent = `
      #world-atlas-viewer .territory-route-ink[data-territory-directional="true"] > path {
        stroke-linecap:round;
        stroke-linejoin:round;
      }
      #world-atlas-viewer .territory-route-ink .territory-route-arrowhead {
        fill:none !important;
        stroke:rgba(202,168,93,.82) !important;
        stroke-width:1.35 !important;
        stroke-dasharray:none !important;
        stroke-linecap:round;
        stroke-linejoin:round;
      }
      #world-atlas-viewer .territory-route-ink > path[data-territory-conquest-payoff="true"] {
        animation:territory-support-write 1.35s cubic-bezier(.2,.75,.25,1) both;
      }
      #world-atlas-viewer [data-territory-conquest-temptation="true"] > i {
        animation:territory-frontier-stamp 1.45s ease-out both;
      }
      #world-atlas-viewer .territory-conquest-temptation {
        display:block;
        max-width:126px;
        margin-top:4px;
        padding:3px 4px 3px 6px;
        border-left:1px solid rgba(202,168,93,.72);
        background:repeating-linear-gradient(135deg,rgba(202,168,93,.055) 0 2px,transparent 2px 7px),rgba(15,13,10,.88);
        color:#d9c98f;
        font:700 7px/1.35 ui-monospace,monospace;
        letter-spacing:.025em;
        white-space:normal;
        transform:rotate(-.7deg);
      }
      @keyframes territory-support-write {
        0% { opacity:.18; stroke-dashoffset:42; }
        55% { opacity:1; }
        100% { opacity:1; stroke-dashoffset:0; }
      }
      @keyframes territory-frontier-stamp {
        0% { outline:0 solid rgba(202,168,93,0); outline-offset:10px; }
        34% { outline:2px solid rgba(202,168,93,.7); outline-offset:5px; }
        100% { outline:1px solid rgba(202,168,93,0); outline-offset:2px; }
      }
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
        #world-atlas-viewer .world-atlas-map--nearby .territory-conquest-temptation {
          max-width:112px;
          font-size:6px;
          line-height:1.3;
        }
        #world-atlas-viewer .territory-atlas-summary {
          top:6px !important;
          right:6px !important;
          width:116px !important;
          padding:5px 7px !important;
          background:rgba(12,11,9,.82) !important;
        }
        #world-atlas-viewer .territory-atlas-summary small,
        #world-atlas-viewer .territory-atlas-summary span { display:none !important; }
        #world-atlas-viewer .territory-atlas-summary strong {
          margin-top:0 !important;
          font-size:9px !important;
          line-height:1.25 !important;
          white-space:nowrap !important;
        }
      }
      @media (prefers-reduced-motion:reduce) {
        #world-atlas-viewer .territory-route-ink > path[data-territory-conquest-payoff="true"],
        #world-atlas-viewer [data-territory-conquest-temptation="true"] > i {
          animation:none !important;
        }
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  function decorateCausalRoutes(document) {
    if (!document || typeof document.createElementNS !== "function") return 0;
    const routes = Array.from(document.querySelectorAll("#world-atlas-viewer .territory-route-ink"));
    let decorated = 0;
    routes.forEach((svg, index) => {
      let defs = Array.from(svg.children || []).find((child) => String(child.tagName).toLowerCase() === "defs" && child.getAttribute?.("data-territory-route-defs") === "true");
      let markerId = defs?.getAttribute?.("data-territory-route-marker-id") || "";
      if (!defs) {
        markerId = `territory-route-arrow-${index}`;
        defs = document.createElementNS(SVG_NS, "defs");
        defs.setAttribute("data-territory-route-defs", "true");
        defs.setAttribute("data-territory-route-marker-id", markerId);
        const marker = document.createElementNS(SVG_NS, "marker");
        marker.setAttribute("id", markerId);
        marker.setAttribute("viewBox", "0 0 9 8");
        marker.setAttribute("refX", "8");
        marker.setAttribute("refY", "4");
        marker.setAttribute("markerWidth", "8");
        marker.setAttribute("markerHeight", "8");
        marker.setAttribute("orient", "auto");
        marker.setAttribute("markerUnits", "strokeWidth");
        const arrow = document.createElementNS(SVG_NS, "path");
        arrow.setAttribute("class", "territory-route-arrowhead");
        arrow.setAttribute("d", "M 1 1 L 8 4 L 1 7");
        arrow.setAttribute("vector-effect", "non-scaling-stroke");
        marker.appendChild(arrow);
        defs.appendChild(marker);
        svg.prepend(defs);
      }

      const paths = Array.from(svg.children || []).filter((child) => String(child.tagName).toLowerCase() === "path");
      paths.forEach((path) => path.setAttribute("marker-end", `url(#${markerId})`));
      if (paths.length) {
        svg.setAttribute("data-territory-directional", "true");
        decorated += 1;
      }
    });
    return decorated;
  }

  function markerForTarget(map, keyInput) {
    const key = cleanText(keyInput);
    return Array.from(map && map.querySelectorAll ? map.querySelectorAll("[data-territory-key]") : [])
      .find((marker) => cleanText(marker.dataset && marker.dataset.territoryKey) === key) || null;
  }

  function decorateConquestPayoff(document, root) {
    const map = document && document.querySelector("#world-atlas-viewer .world-atlas-map--nearby");
    if (!map || !map.querySelector(".territory-capture-toast")) return false;
    const target = conquestPayoffTarget(root);
    if (!target) return false;
    const marker = markerForTarget(map, target.key);
    if (!marker) return false;
    if (marker.dataset.territoryConquestTemptation === "true") return true;

    marker.dataset.territoryConquestTemptation = "true";
    const note = document.createElement("b");
    note.className = "territory-conquest-temptation";
    note.dataset.territoryTargetKey = target.key;
    note.textContent = target.reason;
    (marker.querySelector("span") || marker).appendChild(note);

    const route = map.querySelector('.territory-route-ink[data-territory-directional="true"]') || map.querySelector(".territory-route-ink");
    const paths = route
      ? Array.from(route.children || []).filter((child) => String(child.tagName).toLowerCase() === "path")
      : [];
    const payoffPath = paths[paths.length - 1] || null;
    payoffPath?.setAttribute("data-territory-conquest-payoff", "true");

    const cleanup = () => {
      note.remove();
      delete marker.dataset.territoryConquestTemptation;
      payoffPath?.removeAttribute("data-territory-conquest-payoff");
    };
    if (root && typeof root.setTimeout === "function") root.setTimeout(cleanup, PAYOFF_MS);
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
    decorateCausalRoutes(document);
    const map = document.querySelector("#world-atlas-viewer .world-atlas-map--nearby");
    if (!map) return 0;
    decorateConquestPayoff(document, root);
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
          node.matches?.(".world-atlas-map--nearby, [data-territory-key], .territory-route-ink, .territory-capture-toast") || node.querySelector?.(".world-atlas-map--nearby, [data-territory-key], .territory-route-ink, .territory-capture-toast")
        )));
        if (relevant) schedule(document, root);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    schedule(document, root);
    return true;
  }

  return Object.freeze({ MOBILE_MAX, MIN_GAP, PAYOFF_MS, CANDIDATE_OFFSETS, distance, layoutOffsets, conquestPayoffTarget, decorateCausalRoutes, decorateConquestPayoff, apply, schedule, install });
});