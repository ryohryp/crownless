(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasPreview = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasPreview() {
  "use strict";

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

  function currentWorldModel(root, safe) {
    const Atlas = root && root.CrownlessWorldAtlas;
    if (!Atlas || typeof Atlas.atlasViewModel !== "function") return null;
    const currentCell = root.CrownlessExplorationCells && typeof root.CrownlessExplorationCells.currentCell === "function"
      ? root.CrownlessExplorationCells.currentCell()
      : null;
    try { return Atlas.atlasViewModel(safe && safe.worldKnowledge, currentCell); } catch (_) { return null; }
  }

  function nearbyEntry(root, safe, marker, map) {
    const markers = Array.from(map.querySelectorAll(".world-atlas-nearby-marker"));
    const index = markers.indexOf(marker);
    if (index < 0) return null;
    const runtime = root && root.CrownlessLocationDiscoveryRuntime;
    const discovery = runtime && Array.isArray(runtime.discoveries) ? runtime.discoveries[index] : null;
    if (!discovery) return null;
    const key = runtime && typeof runtime.worldKnowledgeKey === "function" ? cleanText(runtime.worldKnowledgeKey(discovery)) : "";
    const remembered = key && safe && safe.worldKnowledge && safe.worldKnowledge.discoveries
      ? safe.worldKnowledge.discoveries[key]
      : null;
    if (remembered) return remembered;
    return {
      key,
      name: cleanText(discovery.title, "発見地点"),
      baseTitle: cleanText(discovery.baseTitle),
      contentKind: cleanText(discovery.contentKind),
      terrain: terrainOf(discovery)
    };
  }

  function worldEntry(root, safe, marker, map) {
    const markers = Array.from(map.querySelectorAll(".world-atlas-marker"));
    const index = markers.indexOf(marker);
    if (index < 0) return null;
    const model = currentWorldModel(root, safe);
    return model && Array.isArray(model.discoveries) ? model.discoveries[index] || null : null;
  }

  function unplacedEntry(root, safe, button, side) {
    const buttons = Array.from(side.querySelectorAll(".world-atlas-unplaced button"));
    const index = buttons.indexOf(button);
    if (index < 0) return null;
    const model = currentWorldModel(root, safe);
    return model && Array.isArray(model.unplacedDiscoveries) ? model.unplacedDiscoveries[index] || null : null;
  }

  function entryForTarget(root, target) {
    if (!target || typeof target.closest !== "function") return null;
    const safe = safeState(root);
    const nearby = target.closest(".world-atlas-nearby-marker");
    if (nearby) return nearbyEntry(root, safe, nearby, nearby.closest(".world-atlas-map--nearby"));
    const world = target.closest(".world-atlas-marker");
    if (world) return worldEntry(root, safe, world, world.closest(".world-atlas-map--world"));
    const unplaced = target.closest(".world-atlas-unplaced button");
    if (unplaced) return unplacedEntry(root, safe, unplaced, unplaced.closest(".world-atlas-side"));
    return null;
  }

  function defaultEntry(root, viewer) {
    if (!viewer) return null;
    const nearby = viewer.querySelector(".world-atlas-map--nearby");
    if (nearby) {
      const marker = nearby.querySelector(".world-atlas-nearby-marker.active") || nearby.querySelector(".world-atlas-nearby-marker");
      if (marker) return entryForTarget(root, marker);
    }
    const world = viewer.querySelector(".world-atlas-map--world");
    if (world) {
      const marker = world.querySelector(".world-atlas-marker.active") || world.querySelector(".world-atlas-marker");
      if (marker) return entryForTarget(root, marker);
    }
    const unplaced = viewer.querySelector(".world-atlas-unplaced button");
    return unplaced ? entryForTarget(root, unplaced) : null;
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
      empty.style.minHeight = "120px";
      empty.style.display = "grid";
      empty.style.placeItems = "center";
      empty.style.padding = "18px";
      empty.style.color = "#8f8775";
      empty.style.fontSize = "10px";
      empty.style.lineHeight = "1.6";
      empty.style.textAlign = "center";
      empty.style.border = "1px dashed rgba(201,163,93,.16)";
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

  function install(document, root) {
    if (!document || !root || document.documentElement.dataset.worldAtlasPreviewInstalled === "true") return false;
    document.documentElement.dataset.worldAtlasPreviewInstalled = "true";

    let scheduled = false;
    function scheduleDefaultSync() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const viewer = document.getElementById("world-atlas-viewer");
        if (!viewer) return;
        syncPreview(document, root, defaultEntry(root, viewer));
      });
    }

    document.addEventListener("click", (event) => {
      const entry = entryForTarget(root, event.target);
      if (!entry) return;
      queueMicrotask(() => syncPreview(document, root, entry));
    });

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
    previewModel,
    entryForTarget,
    defaultEntry,
    createPreview,
    syncPreview,
    install
  };
});
