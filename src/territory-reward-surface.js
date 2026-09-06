(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessTerritoryRewardSurface = api;
  if (root && root.document) {
    if (root.CrownlessTerritoryPhase1) api.install(root);
    else api.armTerritoryLoader(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerritoryRewardSurface() {
  "use strict";

  const STORAGE_KEY = "crownless.territory.reward.v1";
  const SUPPLY_MULTIPLIER = 0.7;
  const DEVELOPMENT_META = Object.freeze({
    scout: Object.freeze({
      label: "斥候所",
      short: "斥候",
      effect: "次の街道の危険と備えを先に明らかにする"
    }),
    supply: Object.freeze({
      label: "補給所",
      short: "補給",
      effect: "次の街道攻略の所要時間をさらに30%短くする"
    })
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => cleanText(value)).filter(Boolean))];
  }

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const developments = {};
    const raw = source.developments && typeof source.developments === "object" && !Array.isArray(source.developments)
      ? source.developments
      : {};
    Object.entries(raw).forEach(([keyInput, roleInput]) => {
      const key = cleanText(keyInput);
      const role = cleanText(roleInput);
      if (key.startsWith("geo:") && DEVELOPMENT_META[role]) developments[key] = role;
    });
    return {
      developments,
      pendingCelebrationKey: cleanText(source.pendingCelebrationKey),
      celebratedKeys: uniqueStrings(source.celebratedKeys)
    };
  }

  function storageOf(root) {
    try { return root && root.localStorage ? root.localStorage : null; } catch (_) { return null; }
  }

  function loadState(root) {
    const storage = storageOf(root);
    const raw = storage ? safeJsonParse(storage.getItem(STORAGE_KEY) || "null", null) : null;
    return normalizeState(raw);
  }

  function saveState(root, stateInput) {
    const storage = storageOf(root);
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(stateInput)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function territoryApi(root) {
    return root && root.CrownlessTerritoryPhase1 || null;
  }

  function territoryModels(root) {
    const Territory = territoryApi(root);
    if (!Territory || typeof Territory.territories !== "function") return [];
    try { return Territory.territories(root); } catch (_) { return []; }
  }

  function modelByRole(models, role) {
    return (Array.isArray(models) ? models : []).find((item) => item && item.role === role) || null;
  }

  function developmentFor(stateInput, key) {
    const state = normalizeState(stateInput);
    return cleanText(state.developments[cleanText(key)]);
  }

  function representativeTerritory(models) {
    return modelByRole(models, "foothold");
  }

  function scoutRevealTarget(modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    return ["route", "resource"]
      .map((role) => modelByRole(models, role))
      .find((item) => item && item.owner !== "player" && !item.scouted) || null;
  }

  function nextMeaningfulTarget(modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    const ordered = ["foothold", "route", "resource"]
      .map((role) => modelByRole(models, role))
      .filter(Boolean);
    return ordered.find((item) => item.owner !== "player") || null;
  }

  function connectionPairs(modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    const pairs = [];
    for (let index = 0; index < 2; index += 1) {
      const from = modelByRole(models, ["foothold", "route"][index]);
      const to = modelByRole(models, ["route", "resource"][index]);
      if (from && to && from.owner === "player" && to.owner !== "player") pairs.push({ from, to });
    }
    return pairs;
  }

  function summaryModel(modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : [];
    const controlled = models.filter((item) => item && item.owner === "player").length;
    const uncontrolled = models.filter((item) => item && item.owner !== "player").length;
    return {
      controlled,
      total: models.length,
      front: uncontrolled,
      next: nextMeaningfulTarget(models)
    };
  }

  function queueCelebration(root, keyInput) {
    const key = cleanText(keyInput);
    if (!key) return false;
    const state = loadState(root);
    if (state.celebratedKeys.includes(key) || state.pendingCelebrationKey === key) return false;
    state.pendingCelebrationKey = key;
    saveState(root, state);
    return true;
  }

  function consumeCelebration(root, keyInput) {
    const key = cleanText(keyInput);
    const state = loadState(root);
    if (!key || state.pendingCelebrationKey !== key) return false;
    state.pendingCelebrationKey = "";
    if (!state.celebratedKeys.includes(key)) state.celebratedKeys.push(key);
    saveState(root, state);
    return true;
  }

  function chooseDevelopment(root, territoryKeyInput, roleInput) {
    const key = cleanText(territoryKeyInput);
    const role = cleanText(roleInput);
    if (!key || !DEVELOPMENT_META[role]) return { ok: false, changed: false, reason: "invalid" };
    const models = territoryModels(root);
    const representative = representativeTerritory(models);
    if (!representative || representative.key !== key || representative.owner !== "player") {
      return { ok: false, changed: false, reason: "unavailable" };
    }

    const state = loadState(root);
    const existing = developmentFor(state, key);
    if (existing) return { ok: existing === role, changed: false, locked: existing !== role, role: existing };

    state.developments[key] = role;
    saveState(root, state);

    let revealed = false;
    if (role === "scout") {
      const next = scoutRevealTarget(models);
      const Territory = territoryApi(root);
      if (next && Territory && typeof Territory.scoutTerritory === "function") {
        const result = Territory.scoutTerritory(root, next.key);
        revealed = Boolean(result && result.changed);
      }
    }

    dispatchUpdated(root, { kind: "territory-development", discoveryKey: key, role });
    return { ok: true, changed: true, role, revealed };
  }

  function supplyEffect(root, destinationKeyInput) {
    const destinationKey = cleanText(destinationKeyInput);
    const models = territoryModels(root);
    const foothold = representativeTerritory(models);
    const route = modelByRole(models, "route");
    if (!foothold || !route || route.key !== destinationKey || foothold.owner !== "player" || route.owner === "player") return null;
    const state = loadState(root);
    if (developmentFor(state, foothold.key) !== "supply") return null;
    const territoryMultiplier = Number(route.meta && route.meta.supportMultiplier);
    const combinedMultiplier = Number.isFinite(territoryMultiplier) ? territoryMultiplier * SUPPLY_MULTIPLIER : SUPPLY_MULTIPLIER;
    return {
      sourceKey: foothold.key,
      destinationKey: route.key,
      multiplier: SUPPLY_MULTIPLIER,
      extraPercent: Math.round((1 - SUPPLY_MULTIPLIER) * 100),
      combinedPercent: Math.round((1 - combinedMultiplier) * 100)
    };
  }

  function applySupplyToExpeditionState(root, stateInput, dispatchInput) {
    const Territory = territoryApi(root);
    const destinationId = cleanText(dispatchInput && dispatchInput.destinationId);
    const destinationKey = Territory && typeof Territory.discoveryKeyFromDestinationId === "function"
      ? Territory.discoveryKeyFromDestinationId(destinationId)
      : destinationId.startsWith("world:") ? destinationId.slice(6) : "";
    const effect = supplyEffect(root, destinationKey);
    if (!effect || !stateInput || !Array.isArray(stateInput.destinations)) return stateInput;

    let changed = false;
    const destinations = stateInput.destinations.map((destination) => {
      if (!destination || cleanText(destination.id) !== destinationId) return destination;
      const base = Number(destination.durationMs);
      if (!Number.isFinite(base) || base < 0) return destination;
      changed = true;
      return { ...destination, durationMs: Math.max(0, Math.round(base * effect.multiplier)) };
    });
    return changed ? { ...stateInput, destinations } : stateInput;
  }

  function patchSystem(root) {
    const Territory = territoryApi(root);
    if (Territory && typeof Territory.patchSystem === "function") Territory.patchSystem(root);
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__territoryRewardSurfacePatched || typeof system.dispatchExpedition !== "function") return false;
    const originalDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithTerritoryDevelopment(stateInput, input, nowMs) {
      const adjusted = applySupplyToExpeditionState(root, stateInput, input);
      return originalDispatch(adjusted, input, nowMs);
    };
    system.__territoryRewardSurfacePatched = true;
    return true;
  }

  function dispatchUpdated(root, detail) {
    if (!root || typeof root.dispatchEvent !== "function") return false;
    try {
      const EventCtor = root.CustomEvent || (typeof CustomEvent === "function" ? CustomEvent : null);
      if (EventCtor) root.dispatchEvent(new EventCtor("crownless:territory-reward-updated", { detail }));
      else root.dispatchEvent({ type: "crownless:territory-reward-updated", detail });
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("territory-reward-surface-styles")) return;
    const style = document.createElement("style");
    style.id = "territory-reward-surface-styles";
    style.textContent = `
      [data-territory-owner="player"] > i,
      .world-atlas-marker[data-territory-owner="player"] i {
        border:3px double rgba(220,190,116,.92) !important;
        background:repeating-linear-gradient(135deg,rgba(211,184,116,.15) 0 3px,transparent 3px 7px),#16140f !important;
        box-shadow:0 0 0 2px rgba(10,9,7,.9),0 0 0 4px rgba(211,184,116,.18) !important;
      }
      [data-territory-owner="npc"] > i,
      .world-atlas-marker[data-territory-owner="npc"] i {
        border:1px dashed rgba(142,109,88,.9) !important;
        background:linear-gradient(45deg,transparent 43%,rgba(126,78,64,.22) 44% 48%,transparent 49% 51%,rgba(126,78,64,.22) 52% 56%,transparent 57%),#14120f !important;
      }
      [data-territory-owner="player"] .territory-marker-badge::before { content:"⚑ "; }
      [data-territory-owner="npc"] .territory-marker-badge::before { content:"✕ "; }
      [data-territory-owner].active > i,
      .world-atlas-marker[data-territory-owner].active i {
        outline:2px solid rgba(103,137,117,.82) !important;
        outline-offset:5px !important;
      }
      [data-territory-frontier="true"] > i,
      .world-atlas-marker[data-territory-frontier="true"] i {
        box-shadow:0 0 0 2px rgba(18,16,12,.9),0 0 0 5px rgba(183,154,87,.22),0 0 18px rgba(183,154,87,.16) !important;
      }
      .territory-frontier-note,.territory-development-badge { display:block; margin-top:2px; font:700 7px/1.2 ui-monospace,monospace; letter-spacing:.06em; color:#d2bc7a; white-space:nowrap; }
      .territory-development-badge { color:#839b8b; }
      .territory-route-ink { position:absolute; inset:0; z-index:3; width:100%; height:100%; pointer-events:none; overflow:visible; }
      .territory-route-ink path { fill:none; stroke:rgba(202,168,93,.68); stroke-width:1.5; stroke-dasharray:7 5 2 5; vector-effect:non-scaling-stroke; }
      .territory-route-ink circle { fill:#17140f; stroke:rgba(202,168,93,.8); stroke-width:1.4; vector-effect:non-scaling-stroke; }
      .territory-atlas-summary { position:absolute; z-index:18; top:10px; right:10px; width:min(210px,45%); padding:8px 10px; border-left:2px solid rgba(202,168,93,.52); background:rgba(12,11,9,.88); box-shadow:0 5px 18px rgba(0,0,0,.2); pointer-events:none; }
      .territory-atlas-summary small,.territory-atlas-summary strong,.territory-atlas-summary span { display:block; }
      .territory-atlas-summary small { color:#9f906c; font:700 7px/1.2 ui-monospace,monospace; letter-spacing:.12em; }
      .territory-atlas-summary strong { margin-top:3px; color:#dfcf9c; font:500 13px/1.3 Georgia,serif; }
      .territory-atlas-summary span { margin-top:3px; color:#a99f87; font-size:8px; line-height:1.35; }
      .territory-development { margin-top:9px; padding:9px 10px; border-left:2px solid rgba(103,137,117,.46); background:repeating-linear-gradient(135deg,rgba(103,137,117,.035) 0 2px,transparent 2px 8px); }
      .territory-development small,.territory-development strong,.territory-development span { display:block; }
      .territory-development small { color:#839b8b; font-size:8px; letter-spacing:.1em; }
      .territory-development strong { margin-top:4px; color:#dfcf9c; font:500 14px/1.3 Georgia,serif; }
      .territory-development span { margin-top:3px; color:#b7aa8c; font-size:9px; line-height:1.45; }
      .territory-development__choices { display:grid; gap:6px; margin-top:8px; }
      .territory-development__choices button { min-height:42px; padding:8px 9px; border:1px solid rgba(131,155,139,.38); background:rgba(103,137,117,.055); color:#ddd0ac; text-align:left; cursor:pointer; }
      .territory-development__choices button b,.territory-development__choices button em { display:block; pointer-events:none; }
      .territory-development__choices button b { font:600 11px/1.3 Georgia,serif; }
      .territory-development__choices button em { margin-top:2px; color:#968e79; font:normal 8px/1.35 sans-serif; }
      .territory-capture-toast { position:absolute; z-index:30; left:50%; top:50%; width:min(330px,78%); transform:translate(-50%,-50%) rotate(-.7deg); padding:13px 15px; border:1px solid rgba(217,181,100,.58); border-left:4px double rgba(217,181,100,.84); background:rgba(19,16,11,.96); box-shadow:0 18px 45px rgba(0,0,0,.42); pointer-events:none; animation:territory-capture-in 1.8s ease both; }
      .territory-capture-toast small,.territory-capture-toast strong,.territory-capture-toast span { display:block; }
      .territory-capture-toast small { color:#bda462; font:800 8px/1 ui-monospace,monospace; letter-spacing:.14em; }
      .territory-capture-toast strong { margin-top:5px; color:#ead8a5; font:500 20px/1.25 Georgia,serif; }
      .territory-capture-toast span { margin-top:5px; color:#b9ab8a; font-size:9px; line-height:1.45; }
      .territory-capture-pulse > i,.world-atlas-marker.territory-capture-pulse i { animation:territory-seal-pulse 1.5s ease both; }
      .territory-development-effect { color:#91a795 !important; }
      @keyframes territory-capture-in { 0%{opacity:0;transform:translate(-50%,-46%) rotate(-1.2deg) scale(.96)} 16%,78%{opacity:1;transform:translate(-50%,-50%) rotate(-.7deg) scale(1)} 100%{opacity:0;transform:translate(-50%,-52%) rotate(-.3deg) scale(.99)} }
      @keyframes territory-seal-pulse { 0%,100%{filter:none} 35%{filter:brightness(1.5);transform:rotate(1deg) scale(1.16)} }
      @media (max-width:700px) { .territory-atlas-summary { top:8px; right:8px; width:min(178px,52%); padding:7px 8px; } .territory-atlas-summary strong { font-size:11px; } .territory-development__choices { grid-template-columns:1fr; } }
      @media (prefers-reduced-motion:reduce) { .territory-capture-toast,.territory-capture-pulse > i,.world-atlas-marker.territory-capture-pulse i { animation:none !important; } }
    `;
    document.head.appendChild(style);
  }

  function markerForKey(document, keyInput) {
    const key = cleanText(keyInput);
    return Array.from(document.querySelectorAll("[data-territory-key]")).find((node) => cleanText(node.dataset && node.dataset.territoryKey) === key) || null;
  }

  function syncMarkerStates(document, root, modelsInput) {
    const models = Array.isArray(modelsInput) ? modelsInput : territoryModels(root);
    const state = loadState(root);
    const next = nextMeaningfulTarget(models);
    document.querySelectorAll("[data-territory-key]").forEach((marker) => {
      delete marker.dataset.territoryFrontier;
      marker.classList.remove("territory-capture-pulse");
      marker.querySelector?.(".territory-frontier-note")?.remove();
      marker.querySelector?.(".territory-development-badge")?.remove();
      const key = cleanText(marker.dataset.territoryKey);
      if (next && key === next.key) {
        marker.dataset.territoryFrontier = "true";
        const note = document.createElement("b");
        note.className = "territory-frontier-note";
        note.textContent = next.supported ? "前線 · 支援あり" : "次の標的";
        (marker.querySelector("span") || marker).appendChild(note);
      }
      const role = developmentFor(state, key);
      if (role && DEVELOPMENT_META[role]) {
        const badge = document.createElement("b");
        badge.className = "territory-development-badge";
        badge.textContent = `拠点: ${DEVELOPMENT_META[role].short}`;
        (marker.querySelector("span") || marker).appendChild(badge);
      }
    });
    return Boolean(next);
  }

  function syncConnections(document, modelsInput) {
    const map = document && document.querySelector("#world-atlas-viewer .world-atlas-map");
    if (!map) return 0;
    map.querySelector(".territory-route-ink")?.remove();
    const pairs = connectionPairs(modelsInput);
    if (!pairs.length || typeof document.createElementNS !== "function") return 0;
    const rect = map.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "territory-route-ink");
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute("aria-hidden", "true");
    let count = 0;
    pairs.forEach(({ from, to }) => {
      const fromMarker = markerForKey(document, from.key);
      const toMarker = markerForKey(document, to.key);
      if (!fromMarker || !toMarker) return;
      const a = fromMarker.getBoundingClientRect();
      const b = toMarker.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - rect.left;
      const y1 = a.top + a.height / 2 - rect.top;
      const x2 = b.left + b.width / 2 - rect.left;
      const y2 = b.top + b.height / 2 - rect.top;
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.06;
      const my = (y1 + y2) / 2 - (x2 - x1) * 0.06;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
      svg.appendChild(path);
      const seal = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      seal.setAttribute("cx", String(x2));
      seal.setAttribute("cy", String(y2));
      seal.setAttribute("r", "4");
      svg.appendChild(seal);
      count += 1;
    });
    if (count) map.prepend(svg);
    return count;
  }

  function syncSummary(document, modelsInput) {
    const map = document && document.querySelector("#world-atlas-viewer .world-atlas-map");
    if (!map) return false;
    map.querySelector(".territory-atlas-summary")?.remove();
    const summary = summaryModel(modelsInput);
    if (!summary.total) return false;
    const aside = document.createElement("aside");
    aside.className = "territory-atlas-summary";
    aside.setAttribute("aria-label", "勢力圏の要約");
    const kicker = document.createElement("small");
    kicker.textContent = "TERRITORY / 勢力圏";
    const count = document.createElement("strong");
    count.textContent = `支配 ${summary.controlled}/${summary.total} · 前線 ${summary.front}`;
    const next = document.createElement("span");
    next.textContent = summary.next
      ? `次候補: ${cleanText(summary.next.entry && summary.next.entry.name, "未支配地点")}${summary.next.supported ? " — 既支配地の支援が届く" : ""}`
      : "三地点を押さえた。次の拡張はまだ地図に書かれていない。";
    aside.append(kicker, count, next);
    map.appendChild(aside);
    return true;
  }

  function selectedTerritory(document, modelsInput) {
    const active = document && document.querySelector("#world-atlas-viewer [data-territory-key].active");
    if (active) {
      const key = cleanText(active.dataset.territoryKey);
      return (Array.isArray(modelsInput) ? modelsInput : []).find((item) => item.key === key) || null;
    }
    const panel = document && document.querySelector("#world-atlas-viewer .territory-panel[data-territory-key]");
    const key = cleanText(panel && panel.dataset && panel.dataset.territoryKey);
    return key ? (Array.isArray(modelsInput) ? modelsInput : []).find((item) => item.key === key) || null : null;
  }

  function createDevelopmentPanel(document, root, territory, modelsInput) {
    if (!territory || territory.role !== "foothold" || territory.owner !== "player") return null;
    const state = loadState(root);
    const existing = developmentFor(state, territory.key);
    const next = modelByRole(modelsInput, "route");
    const section = document.createElement("section");
    section.className = "territory-development";
    section.dataset.territoryDevelopmentKey = territory.key;
    const kicker = document.createElement("small");
    kicker.textContent = "TERRITORY BUILD / 土地の使い道";
    const title = document.createElement("strong");
    const copy = document.createElement("span");
    section.append(kicker, title, copy);

    if (existing && DEVELOPMENT_META[existing]) {
      const meta = DEVELOPMENT_META[existing];
      title.textContent = `${meta.label}を置いた`;
      if (existing === "scout") {
        copy.textContent = next
          ? `${cleanText(next.entry && next.entry.name, "次の街道")}の危険と備えが地図に先書きされた。`
          : meta.effect;
      } else {
        const effect = next ? supplyEffect(root, next.key) : null;
        copy.textContent = effect
          ? `${cleanText(next.entry && next.entry.name, "次の街道")}の攻略時間は、足場の支援と合わせて通常比約${effect.combinedPercent}%短くなる。`
          : meta.effect;
      }
      return section;
    }

    title.textContent = "この土地をどう使う？";
    copy.textContent = "一度決めた用途は、この三地点テストでは固定される。次の攻略判断が変わる方を選ぶ。";
    const choices = document.createElement("div");
    choices.className = "territory-development__choices";
    Object.entries(DEVELOPMENT_META).forEach(([role, meta]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.developmentRole = role;
      const label = document.createElement("b");
      label.textContent = meta.label;
      const effect = document.createElement("em");
      effect.textContent = meta.effect;
      button.append(label, effect);
      button.addEventListener("click", () => {
        const result = chooseDevelopment(root, territory.key, role);
        if (result.ok) scheduleSync(document, root);
      });
      choices.appendChild(button);
    });
    section.appendChild(choices);
    return section;
  }

  function syncDevelopmentPanel(document, root, modelsInput) {
    const detail = document && document.querySelector("#world-atlas-viewer .world-atlas-detail");
    if (!detail) return false;
    detail.querySelector(".territory-development")?.remove();
    const territory = selectedTerritory(document, modelsInput);
    const panel = createDevelopmentPanel(document, root, territory, modelsInput);
    if (!panel) return false;
    detail.appendChild(panel);
    return true;
  }

  function syncPrepareEffect(document, root, modelsInput) {
    const note = document && document.querySelector("#expedition-folio-content .territory-prepare-note");
    if (!note) return false;
    note.querySelectorAll(".territory-development-effect").forEach((node) => node.remove());
    const route = modelByRole(modelsInput, "route");
    const foothold = representativeTerritory(modelsInput);
    if (!route || !foothold || route.owner === "player") return false;
    const role = developmentFor(loadState(root), foothold.key);
    if (!role) return false;
    const selected = cleanText(document.querySelector('#expedition-folio-content form.expedition-prepare input[name="destination"]:checked')?.value);
    const Territory = territoryApi(root);
    const key = Territory && typeof Territory.discoveryKeyFromDestinationId === "function" ? Territory.discoveryKeyFromDestinationId(selected) : selected.replace(/^world:/, "");
    if (key && key !== route.key) return false;
    const span = document.createElement("span");
    span.className = "territory-development-effect";
    if (role === "scout") {
      span.textContent = "斥候所: この地点の危険情報は、支配地から先に送られた斥候が明らかにした。";
    } else {
      const effect = supplyEffect(root, route.key);
      if (!effect) return false;
      span.textContent = `補給所: 街道までの運搬を整え、足場の支援と合わせて通常比約${effect.combinedPercent}%短縮。`;
    }
    note.appendChild(span);
    return true;
  }

  function syncCelebration(document, root, modelsInput) {
    const map = document && document.querySelector("#world-atlas-viewer .world-atlas-map");
    if (!map) return false;
    const state = loadState(root);
    const key = cleanText(state.pendingCelebrationKey);
    if (!key) return false;
    const territory = (Array.isArray(modelsInput) ? modelsInput : []).find((item) => item.key === key && item.owner === "player");
    if (!territory) return false;
    map.querySelector(".territory-capture-toast")?.remove();
    const next = nextMeaningfulTarget(modelsInput);
    const toast = document.createElement("aside");
    toast.className = "territory-capture-toast";
    toast.setAttribute("role", "status");
    const kicker = document.createElement("small");
    kicker.textContent = "CONTROL / 支配変化";
    const headline = document.createElement("strong");
    headline.textContent = `灰炉が「${cleanText(territory.entry && territory.entry.name, "この地") }」を押さえた`;
    const consequence = document.createElement("span");
    consequence.textContent = next
      ? `${cleanText(next.entry && next.entry.name, "次の地点")}へ支援線が伸びた。地図から次の一手を選べる。`
      : "三地点の支配がつながった。";
    toast.append(kicker, headline, consequence);
    map.appendChild(toast);
    const marker = markerForKey(document, key);
    marker?.classList.add("territory-capture-pulse");
    consumeCelebration(root, key);
    const remove = () => {
      toast.remove();
      marker?.classList.remove("territory-capture-pulse");
    };
    if (root && typeof root.setTimeout === "function") root.setTimeout(remove, 1850);
    return true;
  }

  function syncAll(document, root) {
    const Territory = territoryApi(root);
    if (!document || !Territory) return false;
    if (typeof Territory.syncAll === "function") Territory.syncAll(document, root);
    patchSystem(root);
    const models = territoryModels(root);
    syncMarkerStates(document, root, models);
    syncConnections(document, models);
    syncSummary(document, models);
    syncDevelopmentPanel(document, root, models);
    syncPrepareEffect(document, root, models);
    syncCelebration(document, root, models);
    return true;
  }

  function scheduleSync(document, root) {
    if (!document || !root || root.__territoryRewardSyncScheduled) return false;
    root.__territoryRewardSyncScheduled = true;
    Promise.resolve().then(() => {
      root.__territoryRewardSyncScheduled = false;
      syncAll(document, root);
    });
    return true;
  }

  function install(root) {
    const document = root && root.document;
    if (!document || !territoryApi(root)) return false;
    if (root.__territoryRewardSurfaceInstalled) {
      patchSystem(root);
      scheduleSync(document, root);
      return true;
    }
    root.__territoryRewardSurfaceInstalled = true;
    ensureStyles(document);
    patchSystem(root);

    root.addEventListener?.("crownless:territory-updated", (event) => {
      const detail = event && event.detail;
      if (detail && detail.kind === "controlled") queueCelebration(root, detail.discoveryKey);
      scheduleSync(document, root);
    });
    root.addEventListener?.("crownless:territory-reward-updated", () => scheduleSync(document, root));
    root.addEventListener?.("crownless:world-knowledge-updated", () => scheduleSync(document, root));
    document.addEventListener("click", (event) => {
      const target = event && event.target;
      if (target && typeof target.closest === "function" && target.closest(".world-atlas-nearby-marker, .world-atlas-marker, .world-atlas-unplaced button, #hearth-map-focus")) {
        scheduleSync(document, root);
      }
    });
    if (typeof root.MutationObserver === "function" && document.body) {
      const observer = new root.MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node && node.nodeType === 1 && (
          node.id === "world-atlas-viewer" || node.id === "expedition-folio-content" || node.matches?.(".world-atlas-detail, form.expedition-prepare") || node.querySelector?.(".world-atlas-detail, form.expedition-prepare")
        )));
        if (relevant) scheduleSync(document, root);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    scheduleSync(document, root);
    return true;
  }

  function armTerritoryLoader(root) {
    if (!root || root.CrownlessTerritoryPhase1) return install(root);
    const bridge = root.CrownlessExpeditionUnknownBridge;
    if (!bridge || typeof bridge.loadTerritoryPhase1 !== "function") return false;
    if (bridge.__territoryRewardLoaderPatched) return true;
    const original = bridge.loadTerritoryPhase1.bind(bridge);
    bridge.loadTerritoryPhase1 = async function loadTerritoryThenReward(activeRoot) {
      await original(activeRoot || root);
      install(activeRoot || root);
    };
    bridge.__territoryRewardLoaderPatched = true;
    return true;
  }

  return Object.freeze({
    STORAGE_KEY,
    SUPPLY_MULTIPLIER,
    DEVELOPMENT_META,
    normalizeState,
    loadState,
    saveState,
    developmentFor,
    representativeTerritory,
    scoutRevealTarget,
    nextMeaningfulTarget,
    connectionPairs,
    summaryModel,
    queueCelebration,
    consumeCelebration,
    chooseDevelopment,
    supplyEffect,
    applySupplyToExpeditionState,
    patchSystem,
    syncMarkerStates,
    syncConnections,
    syncSummary,
    syncDevelopmentPanel,
    syncPrepareEffect,
    syncCelebration,
    syncAll,
    scheduleSync,
    install,
    armTerritoryLoader
  });
});