(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessTerritoryPhase1 = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTerritoryPhase1() {
  "use strict";

  const STORAGE_KEY = "crownless.territory.phase1.v1";
  const ROLE_ORDER = Object.freeze(["foothold", "route", "resource"]);
  const ROLE_META = Object.freeze({
    foothold: Object.freeze({
      label: "足場 / 小砦",
      value: "ここを取れば、次の街道攻略を短くできる。",
      effect: "街道攻略の所要時間を35%短縮",
      supportMultiplier: 1
    }),
    route: Object.freeze({
      label: "街道 / 渡河点",
      value: "補給と進軍路を押さえる地点。",
      effect: "資源地攻略の所要時間を25%短縮",
      supportMultiplier: 0.65
    }),
    resource: Object.freeze({
      label: "資源地 / 特殊地点",
      value: "勢力圏を広げる次の目的地。",
      effect: "Phase 1の最奥拠点として確保される",
      supportMultiplier: 0.75
    })
  });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => cleanText(value)).filter(Boolean))];
  }

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const assignments = {};
    ROLE_ORDER.forEach((role) => {
      const key = cleanText(source.assignments && source.assignments[role]);
      if (key) assignments[role] = key;
    });
    const active = source.activeContest && typeof source.activeContest === "object" ? source.activeContest : null;
    return {
      assignments,
      scoutedKeys: uniqueStrings(source.scoutedKeys),
      controlledKeys: uniqueStrings(source.controlledKeys),
      appliedExpeditionIds: uniqueStrings(source.appliedExpeditionIds),
      pendingContestKey: cleanText(source.pendingContestKey),
      activeContest: active && cleanText(active.expeditionId) && cleanText(active.key)
        ? { expeditionId: cleanText(active.expeditionId), key: cleanText(active.key) }
        : null
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

  function terrainSet(entry) {
    return new Set(Array.isArray(entry && entry.terrain) ? entry.terrain.map((item) => cleanText(item)).filter(Boolean) : []);
  }

  function geographicEntries(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return [];
    const bridge = root && root.CrownlessGeographicExpeditionBridge;
    if (bridge && typeof bridge.geographicKnowledgeEntries === "function") {
      return bridge.geographicKnowledgeEntries(Core).filter((entry) => entry && cleanText(entry.key).startsWith("geo:"));
    }
    try {
      const safe = Core.loadSafeState();
      const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
      if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return [];
      return Object.values(discoveries)
        .filter((entry) => entry && typeof entry === "object" && cleanText(entry.key).startsWith("geo:"))
        .sort((left, right) => cleanText(left.key).localeCompare(cleanText(right.key)));
    } catch (_) {
      return [];
    }
  }

  function roleAffinity(entry, role) {
    const terrain = terrainSet(entry);
    const kind = cleanText(entry && entry.contentKind, "unknown");
    if (role === "foothold") {
      return (kind === "dungeon" ? 6 : 0) + (terrain.has("height") ? 5 : 0) + (terrain.has("sacred") ? 4 : 0) + (terrain.has("settlement") ? 1 : 0);
    }
    if (role === "route") {
      return (terrain.has("crossing") ? 6 : 0) + (terrain.has("road_hub") ? 6 : 0) + (terrain.has("water") ? 4 : 0) + (terrain.has("coast") ? 3 : 0) + (terrain.has("settlement") ? 2 : 0);
    }
    return (terrain.has("woods") ? 6 : 0) + (terrain.has("settlement") ? 4 : 0) + (terrain.has("water") ? 2 : 0) + (kind === "facility" ? 2 : 0);
  }

  function ensureAssignments(entriesInput, stateInput) {
    const entries = (Array.isArray(entriesInput) ? entriesInput : [])
      .filter((entry) => entry && cleanText(entry.key))
      .slice()
      .sort((left, right) => cleanText(left.key).localeCompare(cleanText(right.key)));
    const byKey = new Map(entries.map((entry) => [cleanText(entry.key), entry]));
    const state = normalizeState(stateInput);
    const assignments = {};
    const used = new Set();

    ROLE_ORDER.forEach((role) => {
      const existing = cleanText(state.assignments[role]);
      if (existing && byKey.has(existing) && !used.has(existing)) {
        assignments[role] = existing;
        used.add(existing);
      }
    });

    ROLE_ORDER.forEach((role) => {
      if (assignments[role]) return;
      const available = entries.filter((entry) => !used.has(cleanText(entry.key)));
      if (!available.length) return;
      const ranked = available
        .map((entry) => ({ entry, score: roleAffinity(entry, role) }))
        .sort((left, right) => right.score - left.score || cleanText(left.entry.key).localeCompare(cleanText(right.entry.key)));
      const chosen = ranked[0].entry;
      const key = cleanText(chosen.key);
      assignments[role] = key;
      used.add(key);
    });

    state.assignments = assignments;
    return state;
  }

  function predecessorRole(role) {
    if (role === "route") return "foothold";
    if (role === "resource") return "route";
    return "";
  }

  function ownerFor(state, key) {
    return state.controlledKeys.includes(key) ? "player" : "npc";
  }

  function territoryModels(entriesInput, stateInput) {
    const entries = (Array.isArray(entriesInput) ? entriesInput : []).filter(Boolean);
    const byKey = new Map(entries.map((entry) => [cleanText(entry.key), entry]));
    const state = ensureAssignments(entries, stateInput);
    return ROLE_ORDER.map((role) => {
      const key = cleanText(state.assignments[role]);
      const entry = key ? byKey.get(key) : null;
      if (!entry) return null;
      const predecessor = predecessorRole(role);
      const predecessorKey = predecessor ? cleanText(state.assignments[predecessor]) : "";
      const supported = Boolean(predecessorKey && state.controlledKeys.includes(predecessorKey));
      return {
        key,
        role,
        entry,
        owner: ownerFor(state, key),
        scouted: state.scoutedKeys.includes(key),
        predecessorRole: predecessor,
        predecessorKey,
        supported,
        meta: ROLE_META[role]
      };
    }).filter(Boolean);
  }

  function territories(root) {
    const entries = geographicEntries(root);
    const previous = loadState(root);
    const next = ensureAssignments(entries, previous);
    if (JSON.stringify(previous.assignments) !== JSON.stringify(next.assignments)) saveState(root, next);
    return territoryModels(entries, next);
  }

  function territoryByKey(root, key) {
    const wanted = cleanText(key);
    return territories(root).find((territory) => territory.key === wanted) || null;
  }

  function fallbackDangerTags(entry) {
    const terrain = terrainSet(entry);
    const tags = [];
    if (terrain.has("woods")) tags.push("獣", "深い茂み");
    if (terrain.has("settlement") || terrain.has("road_hub") || terrain.has("crossing")) tags.push("街道荒らし");
    if (terrain.has("height") || terrain.has("sacred")) tags.push("崩れた足場");
    if (terrain.has("water") || terrain.has("coast")) tags.push("ぬかるみ");
    return tags.length ? tags : ["正体不明の危険"];
  }

  function dangerTags(root, entry) {
    const bridge = root && root.CrownlessGeographicExpeditionBridge;
    if (bridge && typeof bridge.destinationDangerTags === "function") {
      const tags = bridge.destinationDangerTags(entry);
      if (Array.isArray(tags) && tags.length) return tags;
    }
    return fallbackDangerTags(entry);
  }

  function suggestedPreparation(root, territory) {
    const dangers = dangerTags(root, territory.entry);
    const text = dangers.join("・");
    if (/bandit|街道/.test(text)) return "外套・弓・慎重方針が待ち伏せ対策になる。";
    if (/collapse|足場/.test(text)) return "麻縄と慎重方針が崩れた足場への備えになる。";
    if (/beast|獣/.test(text)) return "森に強い仲間や弓が役に立つ。";
    return "仲間・装備・方針で、未知の危険への備え方が変わる。";
  }

  function supportEffect(stateInput, territory) {
    const state = normalizeState(stateInput);
    const predecessor = predecessorRole(territory && territory.role);
    const predecessorKey = predecessor ? cleanText(state.assignments[predecessor]) : "";
    if (!predecessorKey || !state.controlledKeys.includes(predecessorKey)) return null;
    const multiplier = ROLE_META[territory.role].supportMultiplier;
    return {
      predecessorRole: predecessor,
      predecessorKey,
      multiplier,
      percent: Math.round((1 - multiplier) * 100)
    };
  }

  function effectiveContestDuration(stateInput, territory, baseDurationMs) {
    const base = Number(baseDurationMs);
    if (!territory || !Number.isFinite(base) || base < 0) return baseDurationMs;
    const effect = supportEffect(stateInput, territory);
    return effect ? Math.max(0, Math.round(base * effect.multiplier)) : base;
  }

  function scoutTerritory(root, key) {
    const territory = territoryByKey(root, key);
    if (!territory) return { ok: false, changed: false };
    const state = loadState(root);
    const changed = !state.scoutedKeys.includes(territory.key);
    if (changed) state.scoutedKeys.push(territory.key);
    saveState(root, state);
    if (changed) dispatchUpdated(root, { discoveryKey: territory.key, kind: "scouted" });
    return { ok: true, changed, territory };
  }

  function beginContest(root, key) {
    const territory = territoryByKey(root, key);
    if (!territory || territory.owner === "player") return { ok: false, territory };
    const state = loadState(root);
    state.pendingContestKey = territory.key;
    saveState(root, state);
    dispatchUpdated(root, { discoveryKey: territory.key, kind: "contest-pending" });
    return { ok: true, territory };
  }

  function cancelPendingContest(root, key) {
    const state = loadState(root);
    if (key && state.pendingContestKey !== cleanText(key)) return false;
    if (!state.pendingContestKey) return false;
    state.pendingContestKey = "";
    saveState(root, state);
    return true;
  }

  function discoveryKeyFromDestinationId(destinationId) {
    const id = cleanText(destinationId);
    return id.startsWith("world:") ? id.slice(6) : "";
  }

  function territoryFromStateAndDestination(root, territoryState, destinationId) {
    const key = discoveryKeyFromDestinationId(destinationId);
    if (!key) return null;
    const models = territoryModels(geographicEntries(root), territoryState);
    return models.find((territory) => territory.key === key) || null;
  }

  function decorateContestReport(report, territory, controlled) {
    if (!report || !territory) return report;
    const summary = controlled
      ? `${territory.entry.name}の守りを崩し、灰炉の勢力圏へ加えた。`
      : `${territory.entry.name}はまだNPC勢力の手にある。次の攻略判断が残った。`;
    report.territoryOutcome = {
      discoveryKey: territory.key,
      role: territory.role,
      owner: controlled ? "player" : "npc",
      controlled,
      summary
    };
    if (!Array.isArray(report.worldChanges)) report.worldChanges = [];
    const changeId = `territory-control:${territory.key}`;
    let change = report.worldChanges.find((item) => item && item.id === changeId);
    if (!change) {
      change = { id: changeId, discoveryKey: territory.key, role: territory.role, owner: controlled ? "player" : "npc" };
      report.worldChanges.push(change);
    } else {
      change.owner = controlled ? "player" : "npc";
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((item) => item && item.type === "territory-control" && item.discoveryKey === territory.key)) {
      const lastMinute = Math.max(110, ...report.log.map((item) => Number(item && item.minute) || 0));
      report.log.push({ minute: lastMinute + 1, time: "", type: "territory-control", text: summary, discoveryKey: territory.key, causes: [territory.role, controlled ? "player-control" : "npc-control"] });
    }
    return report;
  }

  function applyContestReport(root, report) {
    if (!report || !cleanText(report.expeditionId)) return { changed: false, controlled: false };
    const state = loadState(root);
    const active = state.activeContest;
    if (!active || active.expeditionId !== cleanText(report.expeditionId)) return { changed: false, controlled: false };
    if (state.appliedExpeditionIds.includes(active.expeditionId)) {
      state.activeContest = null;
      saveState(root, state);
      return { changed: false, controlled: state.controlledKeys.includes(active.key) };
    }

    state.appliedExpeditionIds.push(active.expeditionId);
    const territory = territoryModels(geographicEntries(root), state).find((item) => item.key === active.key) || null;
    const controlled = Boolean(territory && report.outcome === "success");
    let changed = false;
    if (controlled && !state.controlledKeys.includes(active.key)) {
      state.controlledKeys.push(active.key);
      changed = true;
    }
    state.activeContest = null;
    saveState(root, state);
    if (territory) decorateContestReport(report, territory, controlled);
    dispatchUpdated(root, { discoveryKey: active.key, kind: controlled ? "controlled" : "contest-unresolved", outcome: report.outcome });
    return { changed, controlled, territory };
  }

  function patchSystem(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__territoryPhase1Patched || typeof system.dispatchExpedition !== "function") return false;
    const originalDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchTerritoryContest(stateInput, input, nowMs) {
      const territoryState = loadState(root);
      const destinationId = cleanText(input && input.destinationId);
      const territory = territoryFromStateAndDestination(root, territoryState, destinationId);
      const pending = cleanText(territoryState.pendingContestKey);
      let nextInput = input;
      if (territory && pending === territory.key && ownerFor(territoryState, territory.key) !== "player") {
        const normalized = typeof system.normalizeState === "function" ? system.normalizeState(stateInput) : stateInput;
        const destination = normalized && Array.isArray(normalized.destinations)
          ? normalized.destinations.find((item) => item && item.id === destinationId)
          : null;
        const baseDuration = Number(destination && destination.durationMs);
        const durationMs = Number.isFinite(baseDuration)
          ? effectiveContestDuration(territoryState, territory, baseDuration)
          : input && input.durationMs;
        if (Number.isFinite(durationMs) && !(input && Number.isFinite(input.durationMs) && input.durationMs === 0)) {
          nextInput = { ...input, durationMs };
        }
      }

      const nextState = originalDispatch(stateInput, nextInput, nowMs);
      if (pending) {
        if (territory && territory.key === pending && nextState && nextState.activeExpedition) {
          territoryState.activeContest = { expeditionId: cleanText(nextState.activeExpedition.id), key: pending };
        }
        territoryState.pendingContestKey = "";
        saveState(root, territoryState);
      }
      return nextState;
    };

    if (typeof system.advance === "function") {
      const originalAdvance = system.advance.bind(system);
      system.advance = function advanceTerritoryContest(stateInput, nowMs) {
        const advanced = originalAdvance(stateInput, nowMs);
        if (advanced && advanced.report) {
          applyContestReport(root, advanced.report);
          const reports = advanced.state && advanced.state.completedReports;
          const index = Array.isArray(reports) ? reports.findIndex((item) => item && item.expeditionId === advanced.report.expeditionId) : -1;
          if (index >= 0) reports[index] = clone(advanced.report);
        }
        return advanced;
      };
    }
    system.__territoryPhase1Patched = true;
    return true;
  }

  function dispatchUpdated(root, detail) {
    if (!root || typeof root.dispatchEvent !== "function") return false;
    try {
      const EventCtor = root.CustomEvent || (typeof CustomEvent === "function" ? CustomEvent : null);
      if (EventCtor) root.dispatchEvent(new EventCtor("crownless:territory-updated", { detail }));
      else root.dispatchEvent({ type: "crownless:territory-updated", detail });
      return true;
    } catch (_) {
      return false;
    }
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("territory-phase1-styles")) return;
    const style = document.createElement("style");
    style.id = "territory-phase1-styles";
    style.textContent = `
      .world-atlas-nearby-marker[data-territory-owner], .world-atlas-marker[data-territory-owner], .world-atlas-unplaced button[data-territory-owner] { outline:1px solid rgba(186,151,88,.5); outline-offset:2px; }
      [data-territory-owner="player"] { box-shadow:0 0 0 2px rgba(211,184,116,.18), 0 0 20px rgba(211,184,116,.12); }
      [data-territory-owner="npc"] { box-shadow:0 0 0 2px rgba(119,78,60,.18); }
      .territory-marker-badge { display:block; margin-top:2px; font:7px/1.2 ui-monospace,monospace; letter-spacing:.08em; color:#b9a26d; text-transform:uppercase; }
      [data-territory-owner="player"] .territory-marker-badge { color:#dfc985; }
      .territory-panel { margin-top:10px; padding:10px; border:1px solid rgba(185,154,85,.28); background:rgba(23,19,13,.72); }
      .territory-panel > small { display:block; color:#9b8c68; font-size:8px; letter-spacing:.12em; }
      .territory-panel > strong { display:block; margin:4px 0; font:16px/1.3 Georgia,serif; font-weight:500; color:#dfcf9c; }
      .territory-panel p { margin:5px 0; color:#c6b894; font-size:10px; line-height:1.45; }
      .territory-panel__actions { display:grid; gap:6px; margin-top:8px; }
      .territory-panel button { min-height:38px; padding:8px 10px; border:1px solid rgba(185,154,85,.42); background:rgba(185,154,85,.07); color:#e7d8ad; text-align:left; }
      .territory-panel button.primary { border-color:rgba(215,177,98,.68); background:rgba(185,154,85,.13); }
      .territory-panel__status { min-height:1.3em; color:#bba97f; }
      .territory-prepare-note, .territory-report-note { margin:8px 0 12px; padding:10px 12px; border-left:2px solid rgba(201,163,93,.55); background:rgba(185,154,85,.05); }
      .territory-prepare-note strong, .territory-report-note strong { display:block; color:#dfcf9c; }
      .territory-prepare-note span, .territory-report-note span { display:block; margin-top:3px; color:#bcae8a; font-size:10px; line-height:1.45; }
      @media (max-width:700px) { .territory-panel { padding:9px; } .territory-panel__actions { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function entryForMarker(root, marker) {
    const preview = root && root.CrownlessWorldAtlasPreview;
    if (preview && typeof preview.entryForTarget === "function") {
      try { return preview.entryForTarget(root, marker) || null; } catch (_) { return null; }
    }
    return null;
  }

  function syncMarkers(document, root) {
    if (!document) return 0;
    const models = territories(root);
    const byKey = new Map(models.map((territory) => [territory.key, territory]));
    let count = 0;
    const markers = document.querySelectorAll(".world-atlas-nearby-marker, .world-atlas-marker, .world-atlas-unplaced button");
    markers.forEach((marker) => {
      marker.querySelector?.(".territory-marker-badge")?.remove();
      delete marker.dataset.territoryKey;
      delete marker.dataset.territoryOwner;
      const entry = entryForMarker(root, marker);
      const territory = entry ? byKey.get(cleanText(entry.key)) : null;
      if (!territory) return;
      marker.dataset.territoryKey = territory.key;
      marker.dataset.territoryOwner = territory.owner;
      const badge = document.createElement("b");
      badge.className = "territory-marker-badge";
      badge.textContent = `${territory.owner === "player" ? "灰炉支配" : "NPC支配"} · ${territory.meta.label}`;
      const label = marker.querySelector("span") || marker;
      label.appendChild(badge);
      count += 1;
    });
    return count;
  }

  function selectedEntry(document, root) {
    const detail = document && document.querySelector("#world-atlas-viewer .world-atlas-detail");
    if (!detail) return null;
    const actions = root && root.CrownlessWorldAtlasActionsPresentation;
    const key = cleanText(detail.querySelector(".world-atlas-actions")?.dataset.discoveryKey);
    if (key && actions && typeof actions.entryByKey === "function") return actions.entryByKey(root, key);
    const active = document.querySelector("#world-atlas-viewer .world-atlas-nearby-marker.active, #world-atlas-viewer .world-atlas-marker.active, #world-atlas-viewer .world-atlas-unplaced button.active");
    return active ? entryForMarker(root, active) : null;
  }

  function nextTarget(models, territory) {
    if (!territory || territory.owner !== "player") return null;
    const index = ROLE_ORDER.indexOf(territory.role);
    for (let cursor = index + 1; cursor < ROLE_ORDER.length; cursor += 1) {
      const candidate = models.find((item) => item.role === ROLE_ORDER[cursor]);
      if (candidate && candidate.owner !== "player") return candidate;
    }
    return null;
  }

  function focusTerritoryMarker(document, key) {
    const marker = Array.from(document.querySelectorAll("[data-territory-key]")).find((node) => node.dataset.territoryKey === key);
    if (!marker || typeof marker.click !== "function") return false;
    marker.click();
    marker.focus?.({ preventScroll: true });
    return true;
  }

  function createTerritoryPanel(document, root, territory, models) {
    const state = loadState(root);
    const panel = document.createElement("section");
    panel.className = "territory-panel";
    panel.dataset.territoryKey = territory.key;
    panel.setAttribute("aria-label", "地点支配");
    const kicker = document.createElement("small");
    kicker.textContent = "TERRITORY / 勢力圏";
    const owner = document.createElement("strong");
    owner.textContent = territory.owner === "player" ? `灰炉支配 · ${territory.meta.label}` : `NPC支配 · ${territory.meta.label}`;
    const value = document.createElement("p");
    value.textContent = territory.meta.value;
    const intel = document.createElement("p");
    intel.textContent = territory.scouted
      ? `偵察済み: ${dangerTags(root, territory.entry).join("・")}。${suggestedPreparation(root, territory)}`
      : "未偵察: 守りと危険の正体はまだ読めない。情報不足のまま攻略することもできる。";
    panel.append(kicker, owner, value, intel);

    const support = supportEffect(state, territory);
    if (support) {
      const note = document.createElement("p");
      note.textContent = `勢力圏効果: 前の地点を取ったため、この攻略遠征の所要時間が${support.percent}%短くなる。`;
      panel.appendChild(note);
    }

    if (territory.owner === "player") {
      const effect = document.createElement("p");
      effect.textContent = `支配効果: ${territory.meta.effect}。`;
      panel.appendChild(effect);
      const next = nextTarget(models, territory);
      if (next) {
        const actions = document.createElement("div");
        actions.className = "territory-panel__actions";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "primary";
        button.textContent = `次は「${cleanText(next.entry.name, "次の地点")}」を狙う →`;
        button.addEventListener("click", () => focusTerritoryMarker(document, next.key));
        actions.appendChild(button);
        panel.appendChild(actions);
      }
      return panel;
    }

    const actions = document.createElement("div");
    actions.className = "territory-panel__actions";
    const status = document.createElement("p");
    status.className = "territory-panel__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    if (!territory.scouted) {
      const scout = document.createElement("button");
      scout.type = "button";
      scout.textContent = "偵察する — 守りと危険を知る";
      scout.addEventListener("click", () => {
        scoutTerritory(root, territory.key);
        syncAll(document, root);
      });
      actions.appendChild(scout);
    }
    const contest = document.createElement("button");
    contest.type = "button";
    contest.className = "primary";
    contest.textContent = territory.scouted ? "攻略の準備へ →" : "偵察せず攻略の準備へ →";
    contest.addEventListener("click", () => {
      const begun = beginContest(root, territory.key);
      const presentation = root && root.CrownlessWorldAtlasActionsPresentation;
      if (!begun.ok || !presentation || typeof presentation.openExpedition !== "function") {
        status.textContent = "攻略準備を開けない。もう一度試して。";
        cancelPendingContest(root, territory.key);
        return;
      }
      const opened = presentation.openExpedition(document, root, territory.entry, status);
      if (!opened) cancelPendingContest(root, territory.key);
    });
    actions.appendChild(contest);
    panel.append(actions, status);
    return panel;
  }

  function syncDetail(document, root) {
    const detail = document && document.querySelector("#world-atlas-viewer .world-atlas-detail");
    if (!detail) return false;
    const entry = selectedEntry(document, root);
    const models = territories(root);
    const territory = entry ? models.find((item) => item.key === cleanText(entry.key)) : null;
    detail.querySelector(".territory-panel")?.remove();
    if (!territory) return false;
    detail.appendChild(createTerritoryPanel(document, root, territory, models));
    return true;
  }

  function syncPrepare(document, root) {
    const form = document && document.querySelector("#expedition-folio-content form.expedition-prepare");
    if (!form) return false;
    form.querySelector(".territory-prepare-note")?.remove();
    const state = loadState(root);
    const key = cleanText(state.pendingContestKey);
    if (!key) return false;
    const selected = cleanText(form.querySelector('input[name="destination"]:checked')?.value);
    if (selected && discoveryKeyFromDestinationId(selected) !== key) return false;
    const territory = territoryModels(geographicEntries(root), state).find((item) => item.key === key);
    if (!territory) return false;
    const note = document.createElement("aside");
    note.className = "territory-prepare-note";
    const strong = document.createElement("strong");
    strong.textContent = `攻略目標: ${cleanText(territory.entry.name)} / ${territory.meta.label}`;
    const intel = document.createElement("span");
    intel.textContent = territory.scouted
      ? `偵察済み: ${dangerTags(root, territory.entry).join("・")}。${suggestedPreparation(root, territory)}`
      : "未偵察のまま出る。仲間・装備・方針の選択がそのまま攻略結果へ影響する。";
    const rule = document.createElement("span");
    rule.textContent = "成功した帰還だけが支配を変える。早期撤退・敗北ではNPC支配のまま。";
    note.append(strong, intel, rule);
    const support = supportEffect(state, territory);
    if (support) {
      const bonus = document.createElement("span");
      bonus.textContent = `勢力圏効果: 前の地点を取ったため、所要時間 -${support.percent}% が適用される。`;
      note.appendChild(bonus);
    }
    form.prepend(note);
    return true;
  }

  function syncReport(document, root) {
    const summary = document && document.querySelector("#expedition-folio-content .expedition-report-summary");
    if (!summary) return false;
    summary.parentElement?.querySelector(".territory-report-note")?.remove();
    const presentation = root && root.CrownlessExpeditionPresentation;
    const state = presentation && typeof presentation.getState === "function" ? presentation.getState() : null;
    const report = state && Array.isArray(state.completedReports) ? state.completedReports[0] : null;
    const outcome = report && report.territoryOutcome;
    if (!outcome || !cleanText(outcome.discoveryKey)) return false;
    const note = document.createElement("aside");
    note.className = "territory-report-note";
    const strong = document.createElement("strong");
    strong.textContent = outcome.controlled ? "CONTROL / 地点を取った" : "CONTEST / 支配は変わらなかった";
    const copy = document.createElement("span");
    copy.textContent = cleanText(outcome.summary);
    note.append(strong, copy);
    summary.insertAdjacentElement("afterend", note);
    return true;
  }

  function syncAll(document, root) {
    patchSystem(root);
    syncMarkers(document, root);
    syncDetail(document, root);
    syncPrepare(document, root);
    syncReport(document, root);
  }

  function install(root) {
    const document = root && root.document;
    if (!document || root.__territoryPhase1Installed) return false;
    root.__territoryPhase1Installed = true;
    ensureStyles(document);
    patchSystem(root);
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(() => {
        scheduled = false;
        syncAll(document, root);
      });
    };
    if (typeof root.MutationObserver === "function" && document.body) {
      const observer = new root.MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node && node.nodeType === 1 && (
          node.id === "world-atlas-viewer" || node.id === "expedition-folio-content" || node.matches?.(".world-atlas-detail, form.expedition-prepare, .expedition-report-summary") || node.querySelector?.(".world-atlas-detail, form.expedition-prepare, .expedition-report-summary")
        )));
        if (relevant) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    root.addEventListener?.("crownless:world-knowledge-updated", schedule);
    root.addEventListener?.("crownless:territory-updated", schedule);
    document.addEventListener("click", (event) => {
      const target = event && event.target;
      if (target && typeof target.closest === "function" && target.closest(".world-atlas-nearby-marker, .world-atlas-marker, .world-atlas-unplaced button")) schedule();
    });
    schedule();
    return true;
  }

  return Object.freeze({
    STORAGE_KEY,
    ROLE_ORDER,
    ROLE_META,
    normalizeState,
    roleAffinity,
    ensureAssignments,
    territoryModels,
    geographicEntries,
    territories,
    territoryByKey,
    dangerTags,
    supportEffect,
    effectiveContestDuration,
    scoutTerritory,
    beginContest,
    cancelPendingContest,
    discoveryKeyFromDestinationId,
    decorateContestReport,
    applyContestReport,
    patchSystem,
    syncMarkers,
    syncDetail,
    syncPrepare,
    syncReport,
    syncAll,
    install
  });
});
