(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessTerritoryWorldTrace = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerritoryWorldTrace() {
  "use strict";

  const TRACE_IDS = Object.freeze({
    scout: "world-trace:territory:scout-post",
    supply: "world-trace:territory:supply-post"
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function boundedPercent(value, fallback = 55) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(95, Math.round(numeric)));
  }

  function traceForRole(roleInput, contextInput = {}) {
    const role = cleanText(roleInput);
    const targetName = cleanText(contextInput.targetName, "次の前線");
    if (role === "scout") {
      return Object.freeze({
        id: TRACE_IDS.scout,
        role,
        kind: "scout-mark",
        sourceType: "territory",
        discoveryState: "visible",
        kicker: "WORLD TRACE / 支配地の気配",
        heading: "灰炉の斥候印が刻まれている",
        copy: `石や杭に浅い刻み傷が続く。斥候所から戻った者が、${targetName}方面の動きを残したらしい。`,
        inspectLabel: "斥候印を読む",
        investigatedHeading: "斥候が敵の動きを書き残した",
        investigatedCopy: `${targetName}の危険と備えは、この土地から先に出た斥候の報せだ。地図に先書きされた情報を次の準備に使える。`,
        leaveLabel: "印には触れない",
        leaveCopy: "斥候の印はそのまま残し、今の探索を続けることにした。"
      });
    }
    if (role === "supply") {
      const combinedPercent = boundedPercent(contextInput.combinedPercent);
      return Object.freeze({
        id: TRACE_IDS.supply,
        role,
        kind: "supply-ruts",
        sourceType: "territory",
        discoveryState: "visible",
        kicker: "WORLD TRACE / 支配地の気配",
        heading: "灰炉の荷車の轍が残っている",
        copy: `新しい車輪跡と麻縄の切れ端が、${targetName}へ向かっている。補給所から荷が流れ始めたらしい。`,
        inspectLabel: "補給の轍を調べる",
        investigatedHeading: "補給路が前線へ伸びている",
        investigatedCopy: `${targetName}への運搬路が整っている。足場の支援と合わせ、遠征時間は通常比約${combinedPercent}%短くなる。`,
        leaveLabel: "轍には触れない",
        leaveCopy: "荷車の流れを邪魔せず、今の探索を続けることにした。"
      });
    }
    return null;
  }

  function selectedTerritory(document, modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    const active = document && document.querySelector
      ? document.querySelector("#world-atlas-viewer [data-territory-key].active")
      : null;
    if (active && active.dataset) {
      const key = cleanText(active.dataset.territoryKey);
      return models.find((item) => item && item.key === key) || null;
    }
    const panel = document && document.querySelector
      ? document.querySelector("#world-atlas-viewer .territory-panel[data-territory-key]")
      : null;
    const key = cleanText(panel && panel.dataset && panel.dataset.territoryKey);
    return key ? models.find((item) => item && item.key === key) || null : null;
  }

  function traceForTerritory(root, territory, modelsInput) {
    if (!root || !territory || territory.owner !== "player" || territory.role !== "foothold") return null;
    const Reward = root.CrownlessTerritoryRewardSurface;
    if (!Reward || typeof Reward.loadState !== "function" || typeof Reward.developmentFor !== "function") return null;
    const state = Reward.loadState(root);
    const role = Reward.developmentFor(state, territory.key);
    if (role !== "scout" && role !== "supply") return null;
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    const next = typeof Reward.nextMeaningfulTarget === "function"
      ? Reward.nextMeaningfulTarget(models)
      : models.find((item) => item && item.owner !== "player") || null;
    const targetName = cleanText(next && next.entry && next.entry.name, "次の前線");
    let combinedPercent = 55;
    if (role === "supply" && next && typeof Reward.supplyEffect === "function") {
      const effect = Reward.supplyEffect(root, next.key);
      if (effect) combinedPercent = boundedPercent(effect.combinedPercent, combinedPercent);
    }
    return traceForRole(role, { targetName, combinedPercent });
  }

  function appendTerritoryTracePanel(document, detail, trace) {
    if (!document || !detail || !trace || typeof document.createElement !== "function") return false;
    if (detail.querySelector && detail.querySelector(".world-trace-investigation:not(.world-trace-investigation--territory)")) return false;

    const panel = document.createElement("section");
    panel.className = "world-atlas-npc-signal-match world-trace-investigation world-trace-investigation--territory";
    panel.dataset.traceId = trace.id;
    panel.dataset.traceRole = trace.role;
    panel.dataset.traceState = "visible";

    const kicker = document.createElement("small");
    kicker.className = "world-trace-investigation__kicker";
    kicker.textContent = trace.kicker;

    const heading = document.createElement("strong");
    heading.textContent = trace.heading;

    const copy = document.createElement("span");
    copy.textContent = trace.copy;

    const inspect = document.createElement("button");
    inspect.type = "button";
    inspect.className = "world-atlas-npc-signal-match__open world-trace-investigation__inspect world-trace-investigation__territory-inspect";
    inspect.textContent = trace.inspectLabel;

    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "world-atlas-npc-signal-match__open world-trace-investigation__leave world-trace-investigation__territory-leave";
    leave.textContent = trace.leaveLabel;

    inspect.addEventListener("click", () => {
      heading.textContent = trace.investigatedHeading;
      copy.textContent = trace.investigatedCopy;
      inspect.hidden = true;
      leave.textContent = "地図へ戻る";
      panel.dataset.traceState = "investigated";
    });

    leave.addEventListener("click", () => {
      if (panel.dataset.traceState !== "investigated") {
        heading.textContent = "痕跡には触れない";
        copy.textContent = trace.leaveCopy;
      }
      inspect.hidden = true;
      leave.hidden = true;
      panel.dataset.traceState = "left";
    });

    panel.append(kicker, heading, copy, inspect, leave);
    detail.appendChild(panel);
    return true;
  }

  function territoryModels(root) {
    const Territory = root && root.CrownlessTerritoryPhase1;
    if (!Territory || typeof Territory.territories !== "function") return [];
    try {
      const models = Territory.territories(root);
      return Array.isArray(models) ? models : [];
    } catch (_) {
      return [];
    }
  }

  function sync(document, root) {
    if (!document || !root || !root.CrownlessWorldTraces) return false;
    const detail = document.querySelector && document.querySelector("#world-atlas-viewer .world-atlas-detail");
    if (!detail) return false;
    detail.querySelector?.(".world-trace-investigation--territory")?.remove();
    const models = territoryModels(root);
    const territory = selectedTerritory(document, models);
    const trace = traceForTerritory(root, territory, models);
    return appendTerritoryTracePanel(document, detail, trace);
  }

  function scheduleSync(document, root) {
    if (!document || !root || root.__territoryWorldTraceSyncScheduled) return false;
    root.__territoryWorldTraceSyncScheduled = true;
    Promise.resolve().then(() => {
      root.__territoryWorldTraceSyncScheduled = false;
      sync(document, root);
    });
    return true;
  }

  function install(document, root) {
    if (!document || !root || !root.CrownlessWorldTraces || !root.CrownlessTerritoryRewardSurface) return false;
    if (root.__territoryWorldTraceInstalled) {
      scheduleSync(document, root);
      return true;
    }
    root.__territoryWorldTraceInstalled = true;

    root.addEventListener?.("crownless:territory-updated", () => scheduleSync(document, root));
    root.addEventListener?.("crownless:territory-reward-updated", () => scheduleSync(document, root));
    document.addEventListener?.("click", (event) => {
      const target = event && event.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("[data-territory-key], [data-development-role], .world-atlas-details-toggle")) {
        scheduleSync(document, root);
      }
    });

    if (typeof root.MutationObserver === "function" && document.body) {
      const observer = new root.MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node && node.nodeType === 1 && (
          node.matches?.(".territory-development, .world-atlas-detail") || node.querySelector?.(".territory-development, .world-atlas-detail")
        )));
        if (relevant) scheduleSync(document, root);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    scheduleSync(document, root);
    return true;
  }

  return Object.freeze({
    TRACE_IDS,
    traceForRole,
    selectedTerritory,
    traceForTerritory,
    appendTerritoryTracePanel,
    territoryModels,
    sync,
    scheduleSync,
    install
  });
});