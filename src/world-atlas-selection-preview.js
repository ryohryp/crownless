(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasPreview = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasPreview() {
  "use strict";

  const MOUSE_MAGNET_RADIUS = 72;
  const TOUCH_MAGNET_RADIUS = 88;

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function terrainOf(entry) {
    if (Array.isArray(entry && entry.terrain)) return entry.terrain.slice();
    if (Array.isArray(entry && entry.features)) return entry.features.slice();
    return [];
  }

  function previewModel(entry, locationVisuals) {
    if (!entry || typeof entry !== "object") {
      return { key: "none", name: "発見地点", state: "empty", visual: null };
    }
    const name = cleanText(entry.name, cleanText(entry.title, "発見地点"));
    const normalized = {
      key: cleanText(entry.key),
      name,
      baseTitle: cleanText(entry.baseTitle),
      contentKind: cleanText(entry.contentKind),
      terrain: terrainOf(entry)
    };
    const visual = locationVisuals && typeof locationVisuals.resolveLocationVisual === "function"
      ? locationVisuals.resolveLocationVisual(normalized)
      : null;
    return {
      key: normalized.key || `${normalized.contentKind}:${normalized.terrain.join("+")}:${name}`,
      name,
      state: visual && cleanText(visual.assetPath) ? "visual" : "empty",
      visual: visual && cleanText(visual.assetPath) ? visual : null
    };
  }

  function safeState(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return null;
    try { return Core.loadSafeState(); } catch (_) { return null; }
  }

  function discoverySource(safe) {
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    return discoveries && typeof discoveries === "object" && !Array.isArray(discoveries) ? discoveries : {};
  }

  function markerName(marker) {
    const aria = cleanText(marker && marker.getAttribute && marker.getAttribute("aria-label"));
    if (aria) return cleanText(aria.split("。")[0]);
    return cleanText(marker && marker.querySelector && marker.querySelector("strong")?.textContent,
      cleanText(marker && marker.textContent));
  }

  function rememberedByName(safe, name) {
    const wanted = cleanText(name);
    if (!wanted) return null;
    return Object.values(discoverySource(safe)).find((entry) => cleanText(entry && entry.name) === wanted) || null;
  }

  function runtimeDiscoveryByName(root, name) {
    const runtime = root && root.CrownlessLocationDiscoveryRuntime;
    const discoveries = runtime && Array.isArray(runtime.discoveries) ? runtime.discoveries : [];
    const wanted = cleanText(name);
    return discoveries.find((entry) => cleanText(entry && entry.title) === wanted) || null;
  }

  function normalizedRuntimeEntry(root, safe, discovery) {
    if (!discovery) return null;
    const runtime = root && root.CrownlessLocationDiscoveryRuntime;
    const key = runtime && typeof runtime.worldKnowledgeKey === "function" ? cleanText(runtime.worldKnowledgeKey(discovery)) : "";
    const remembered = key ? discoverySource(safe)[key] : null;
    if (remembered) return remembered;
    return {
      key,
      name: cleanText(discovery.title, "発見地点"),
      baseTitle: cleanText(discovery.baseTitle),
      contentKind: cleanText(discovery.contentKind),
      terrain: terrainOf(discovery),
      state: "discovered"
    };
  }

  function entryForMarker(root, safe, marker) {
    const name = markerName(marker);
    const remembered = rememberedByName(safe, name);
    if (remembered) return remembered;
    return normalizedRuntimeEntry(root, safe, runtimeDiscoveryByName(root, name));
  }

  function entryForTarget(root, target) {
    if (!target || typeof target.closest !== "function") return null;
    const safe = safeState(root);
    const marker = target.closest(".world-atlas-nearby-marker, .world-atlas-marker");
    if (marker) return entryForMarker(root, safe, marker);
    const unplaced = target.closest(".world-atlas-unplaced button");
    if (unplaced) return rememberedByName(safe, cleanText(unplaced.textContent));
    return null;
  }

  function defaultEntry(root, viewer) {
    if (!viewer) return null;
    const marker = viewer.querySelector(".world-atlas-nearby-marker.active, .world-atlas-nearby-marker, .world-atlas-marker.active, .world-atlas-marker");
    if (marker) return entryForTarget(root, marker);
    const unplaced = viewer.querySelector(".world-atlas-unplaced button");
    return unplaced ? entryForTarget(root, unplaced) : null;
  }

  function stateLabel(entry) {
    if (!entry) return "探索録";
    if (entry.state === "cleared") return "踏破済み";
    if (entry.state === "investigated") return "調査済み / 遠征候補";
    return "発見済み / 遠征候補";
  }

  function syncDetail(document, entry) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail || !entry) return false;
    const title = detail.querySelector("strong");
    const state = detail.querySelector("span");
    const terrain = detail.querySelector("em");
    if (title) title.textContent = cleanText(entry.name, cleanText(entry.title, "発見地点"));
    if (state) state.textContent = cleanText(entry.stateLabel, stateLabel(entry));
    if (terrain) {
      const terrainItems = terrainOf(entry).map((item) => cleanText(item)).filter(Boolean);
      terrain.textContent = terrainItems.length ? terrainItems.join(" / ") : "粗い地勢だけが記録されている。";
    }
    return true;
  }

  function createPreview(document, model) {
    const figure = document.createElement("figure");
    figure.className = `world-atlas-latest-visual world-atlas-selection-preview${model.state === "empty" ? " is-empty" : ""}`;
    figure.dataset.previewKey = model.key;
    if (model.state === "visual") {
      const image = document.createElement("img");
      image.src = model.visual.assetPath;
      image.alt = cleanText(model.visual.alt, model.name);
      image.loading = "lazy";
      figure.appendChild(image);
    } else {
      const empty = document.createElement("div");
      empty.className = "world-atlas-selection-preview-empty";
      empty.textContent = "この地点の墨絵はまだ記録されていない。";
      figure.appendChild(empty);
    }
    const caption = document.createElement("figcaption");
    caption.textContent = `選択地点の墨絵 · ${model.name}`;
    figure.appendChild(caption);
    return figure;
  }

  function syncPreview(document, root, entry) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const side = viewer && viewer.querySelector(".world-atlas-side");
    if (!side) return false;
    const model = previewModel(entry, root && root.CrownlessLocationVisuals);
    const existing = side.querySelector(".world-atlas-selection-preview, .world-atlas-latest-visual");
    if (existing && existing.dataset.previewKey === model.key) return true;
    const next = createPreview(document, model);
    if (existing) existing.replaceWith(next);
    else side.appendChild(next);
    return true;
  }

  function syncSelection(document, root, entry) {
    if (!entry) return false;
    const detail = syncDetail(document, entry);
    const preview = syncPreview(document, root, entry);
    return detail || preview;
  }

  function markerSelectorForMap(map) {
    return map && map.classList && map.classList.contains("world-atlas-map--nearby")
      ? ".world-atlas-nearby-marker"
      : ".world-atlas-marker";
  }

  function nearestMarkerForPoint(map, clientX, clientY, maxDistance = MOUSE_MAGNET_RADIUS) {
    if (!map || typeof map.querySelectorAll !== "function") return null;
    const x = Number(clientX);
    const y = Number(clientY);
    const limit = Math.max(0, Number(maxDistance) || 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !limit) return null;
    let best = null;
    let bestDistance = Infinity;
    Array.from(map.querySelectorAll(markerSelectorForMap(map))).forEach((marker) => {
      if (!marker || typeof marker.getBoundingClientRect !== "function") return;
      const rect = marker.getBoundingClientRect();
      const centerX = Number(rect.left) + Number(rect.width) / 2;
      const centerY = Number(rect.top) + Number(rect.height) / 2;
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance < bestDistance) {
        best = marker;
        bestDistance = distance;
      }
    });
    return bestDistance <= limit ? best : null;
  }

  function markActive(map, marker) {
    if (!map || !marker || typeof map.querySelectorAll !== "function") return;
    Array.from(map.querySelectorAll(markerSelectorForMap(map))).forEach((node) => {
      if (node && node.classList) node.classList.toggle("active", node === marker);
    });
  }

  function pointerSelection(document, root, event) {
    const target = event && event.target;
    if (!target || typeof target.closest !== "function") return false;
    const directMarker = target.closest(".world-atlas-nearby-marker, .world-atlas-marker");
    const map = directMarker
      ? directMarker.closest(".world-atlas-map--nearby, .world-atlas-map--world")
      : target.closest(".world-atlas-map--nearby, .world-atlas-map--world");
    if (!map) return false;
    const radius = event.pointerType === "touch" || event.pointerType === "pen" ? TOUCH_MAGNET_RADIUS : MOUSE_MAGNET_RADIUS;
    const marker = directMarker || nearestMarkerForPoint(map, event.clientX, event.clientY, radius);
    if (!marker) return false;
    const entry = entryForMarker(root, safeState(root), marker);
    if (!entry) return false;
    markActive(map, marker);
    syncSelection(document, root, entry);
    return true;
  }

  function ensureInteractionStyles(document) {
    if (!document || document.getElementById("world-atlas-selection-interaction-styles")) return;
    const style = document.createElement("style");
    style.id = "world-atlas-selection-interaction-styles";
    style.textContent = `
      .world-atlas-nearby-marker > span { pointer-events:auto !important; cursor:pointer; }
      .world-atlas-map--nearby, .world-atlas-map--world { touch-action:manipulation; }
      .world-atlas-selection-preview-empty { min-height:120px; display:grid; place-items:center; padding:18px; color:#8f8775; font-size:10px; line-height:1.6; text-align:center; border:1px dashed rgba(201,163,93,.16); }
    `;
    document.head.appendChild(style);
  }

  function install(document, root) {
    if (!document || !root || document.documentElement.dataset.worldAtlasPreviewInstalled === "true") return false;
    document.documentElement.dataset.worldAtlasPreviewInstalled = "true";
    ensureInteractionStyles(document);

    let scheduled = false;
    function scheduleDefaultSync() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const viewer = document.getElementById("world-atlas-viewer");
        if (!viewer) return;
        syncSelection(document, root, defaultEntry(root, viewer));
      });
    }

    document.addEventListener("pointerup", (event) => {
      pointerSelection(document, root, event);
    }, true);

    document.addEventListener("click", (event) => {
      const entry = entryForTarget(root, event.target);
      if (!entry) return;
      syncSelection(document, root, entry);
    }, true);

    const observer = new MutationObserver((records) => {
      if (!records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1 && (
        node.id === "world-atlas-viewer" || node.matches?.(".world-atlas-side, .world-atlas-body") || node.querySelector?.(".world-atlas-side")
      )))) return;
      scheduleDefaultSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleDefaultSync();
    return true;
  }

  return {
    MOUSE_MAGNET_RADIUS,
    TOUCH_MAGNET_RADIUS,
    previewModel,
    markerName,
    rememberedByName,
    entryForMarker,
    entryForTarget,
    defaultEntry,
    stateLabel,
    syncDetail,
    createPreview,
    syncPreview,
    syncSelection,
    nearestMarkerForPoint,
    pointerSelection,
    install
  };
});
