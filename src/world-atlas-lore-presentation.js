(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasLorePresentation = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasLorePresentation() {
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

  function explorationRecordText(lore, state) {
    if (state === "cleared" && cleanText(lore && lore.clearedNote)) return lore.clearedNote;
    if ((state === "investigated" || state === "cleared") && cleanText(lore && lore.expeditionNote)) return lore.expeditionNote;
    return "未調査。遠征すれば、ここにより確かな探索録が増える。";
  }

  function createLoreLine(document, label, text, className = "") {
    const row = document.createElement("div");
    row.className = `world-atlas-lore-line${className ? ` ${className}` : ""}`;
    const term = document.createElement("small");
    term.textContent = label;
    const value = document.createElement("p");
    value.textContent = cleanText(text, "まだ手掛かりがない。");
    row.append(term, value);
    return row;
  }

  function createHintLine(document, label, values, className = "") {
    const row = document.createElement("div");
    row.className = `world-atlas-lore-line world-atlas-lore-hints${className ? ` ${className}` : ""}`;
    const term = document.createElement("small");
    term.textContent = label;
    const list = document.createElement("div");
    list.className = "world-atlas-lore-tags";
    const hints = Array.isArray(values) ? values.filter(Boolean) : [];
    (hints.length ? hints : ["不明"]).forEach((hint) => {
      const tag = document.createElement("span");
      tag.textContent = hint;
      list.appendChild(tag);
    });
    row.append(term, list);
    return row;
  }

  function createLorePanel(document, lore, entry) {
    const state = cleanText(entry && entry.state, "discovered");
    const panel = document.createElement("section");
    panel.className = "world-atlas-lore";
    panel.setAttribute("aria-label", "Crownless世界の噂と遠征ヒント");

    const kicker = document.createElement("small");
    kicker.className = "world-atlas-lore-kicker";
    kicker.textContent = "CROWNLESS LORE / 架空の探索録";
    const discovery = document.createElement("p");
    discovery.className = "world-atlas-lore-discovery";
    discovery.textContent = cleanText(lore && lore.discoveryText, "この地点にはまだ短い発見記録しかない。");

    const hints = document.createElement("div");
    hints.className = "world-atlas-lore-hint-grid";
    hints.append(
      createHintLine(document, "脅威の気配", lore && lore.threatHints, "is-threat"),
      createHintLine(document, "期待できるもの", lore && lore.rewardHints, "is-reward")
    );

    const fiction = document.createElement("small");
    fiction.className = "world-atlas-lore-fiction";
    fiction.textContent = "※ Crownless世界内の噂。現実の地点の由来・事件を示すものではない。";

    panel.append(
      kicker,
      discovery,
      createLoreLine(document, "噂", lore && lore.rumorText, "is-rumor"),
      hints,
      createLoreLine(document, "探索録", explorationRecordText(lore, state), "is-record"),
      fiction
    );
    return panel;
  }

  function safeState(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return null;
    try { return Core.loadSafeState(); } catch (_) { return null; }
  }

  function rememberedByDetailTitle(document, root) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const name = cleanText(viewer && viewer.querySelector(".world-atlas-detail strong")?.textContent);
    if (!name) return null;
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (discoveries && typeof discoveries === "object" && !Array.isArray(discoveries)) {
      const remembered = Object.values(discoveries).find((entry) => cleanText(entry && entry.name) === name);
      if (remembered) return remembered;
    }
    const runtime = root && root.CrownlessLocationDiscoveryRuntime;
    const nearby = runtime && Array.isArray(runtime.discoveries) ? runtime.discoveries : [];
    const discovery = nearby.find((entry) => cleanText(entry && entry.title) === name);
    if (!discovery) return null;
    const key = typeof runtime.worldKnowledgeKey === "function" ? cleanText(runtime.worldKnowledgeKey(discovery)) : "";
    return {
      key,
      name,
      contentKind: cleanText(discovery.contentKind, "unknown"),
      terrain: terrainOf(discovery),
      state: "discovered"
    };
  }

  function entryForSelection(document, root, target) {
    const preview = root && root.CrownlessWorldAtlasPreview;
    if (target && preview && typeof preview.entryForTarget === "function") {
      const direct = preview.entryForTarget(root, target);
      if (direct) return direct;
    }
    const viewer = document && document.getElementById("world-atlas-viewer");
    if (viewer && preview && typeof preview.defaultEntry === "function") {
      const active = preview.defaultEntry(root, viewer);
      if (active) return active;
    }
    return rememberedByDetailTitle(document, root);
  }

  function syncLore(document, root, entry) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    const loreApi = root && root.CrownlessDiscoveryLore;
    if (!detail || !entry || !loreApi || typeof loreApi.buildDiscoveryLore !== "function") return false;
    const lore = loreApi.buildDiscoveryLore(entry);
    const next = createLorePanel(document, lore, entry);
    const existing = detail.querySelector(".world-atlas-lore");
    if (existing) existing.replaceWith(next);
    else detail.appendChild(next);
    return true;
  }

  function ensureStylesheet(document) {
    if (!document || document.querySelector('link[href="world-atlas-lore.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "world-atlas-lore.css";
    document.head.appendChild(link);
  }

  function install(document, root) {
    if (!document || !root || document.documentElement.dataset.worldAtlasLoreInstalled === "true") return false;
    document.documentElement.dataset.worldAtlasLoreInstalled = "true";
    ensureStylesheet(document);

    let scheduled = false;
    let pendingTarget = null;
    function scheduleSync(target = null) {
      if (target) pendingTarget = target;
      if (scheduled) return;
      scheduled = true;
      const enqueue = typeof queueMicrotask === "function" ? queueMicrotask : (callback) => Promise.resolve().then(callback);
      enqueue(() => {
        scheduled = false;
        const targetNode = pendingTarget;
        pendingTarget = null;
        syncLore(document, root, entryForSelection(document, root, targetNode));
      });
    }

    document.addEventListener("click", (event) => {
      const target = event && event.target;
      if (!target || typeof target.closest !== "function") return;
      if (!target.closest(".world-atlas-nearby-marker, .world-atlas-marker, .world-atlas-unplaced button")) return;
      scheduleSync(target);
    });

    document.addEventListener("pointerup", (event) => {
      const target = event && event.target;
      if (!target || typeof target.closest !== "function" || !target.closest(".world-atlas-map")) return;
      scheduleSync(target);
    });

    if (typeof MutationObserver === "function" && document.body) {
      const observer = new MutationObserver((records) => {
        const changed = records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1 && (
          node.id === "world-atlas-viewer" || node.matches?.(".world-atlas-detail") || node.querySelector?.(".world-atlas-detail")
        )));
        if (changed) scheduleSync();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (root && typeof root.addEventListener === "function") {
      root.addEventListener("crownless:world-knowledge-updated", () => scheduleSync());
    }
    scheduleSync();
    return true;
  }

  return {
    explorationRecordText,
    createLorePanel,
    rememberedByDetailTitle,
    entryForSelection,
    syncLore,
    ensureStylesheet,
    install
  };
});
