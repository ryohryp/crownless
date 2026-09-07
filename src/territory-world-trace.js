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
  const TRAIT_LABELS = Object.freeze({
    strong: "力強さ",
    brave: "勇気",
    loyal: "忠誠",
    woodsman: "森の知識",
    cautious: "慎重さ",
    tracker: "追跡",
    greedy: "欲深さ",
    "keen-eye": "目利き",
    stubborn: "粘り強さ"
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

  function asArray(value) {
    return Array.isArray(value) ? value : [];
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

  function expeditionState(root) {
    const Presentation = root && root.CrownlessExpeditionPresentation;
    if (!Presentation || typeof Presentation.getState !== "function") return null;
    try { return Presentation.getState(); } catch (_) { return null; }
  }

  function territoryForDestination(root, destinationId, modelsInput) {
    const Territory = root && root.CrownlessTerritoryPhase1;
    const id = cleanText(destinationId);
    if (!Territory || !id) return null;
    const key = typeof Territory.discoveryKeyFromDestinationId === "function"
      ? Territory.discoveryKeyFromDestinationId(id)
      : id.startsWith("world:") ? id.slice(6) : "";
    if (!key) return null;
    const models = Array.isArray(modelsInput) ? modelsInput : territoryModels(root);
    return models.find((item) => item && item.key === key) || null;
  }

  function historicalSupplyEffect(Reward, territory) {
    if (!Reward || !territory) return null;
    const supplyMultiplier = Number(Reward.SUPPLY_MULTIPLIER);
    if (!Number.isFinite(supplyMultiplier)) return null;
    const territoryMultiplier = Number(territory.meta && territory.meta.supportMultiplier);
    const combinedMultiplier = (Number.isFinite(territoryMultiplier) ? territoryMultiplier : 1) * supplyMultiplier;
    return {
      combinedPercent: Math.round((1 - combinedMultiplier) * 100)
    };
  }

  function developmentContext(root, territory, modelsInput, optionsInput = {}) {
    const Reward = root && root.CrownlessTerritoryRewardSurface;
    if (!Reward || !territory || typeof Reward.loadState !== "function" || typeof Reward.developmentFor !== "function") return null;
    const models = Array.isArray(modelsInput) ? modelsInput : territoryModels(root);
    const foothold = typeof Reward.representativeTerritory === "function" ? Reward.representativeTerritory(models) : null;
    if (!foothold || foothold.owner !== "player") return null;
    const rewardState = Reward.loadState(root);
    const role = Reward.developmentFor(rewardState, foothold.key);
    if (role !== "scout" && role !== "supply") return null;
    const meta = Reward.DEVELOPMENT_META && Reward.DEVELOPMENT_META[role];
    if (territory.role !== "route") return null;
    if (role === "supply" && typeof Reward.supplyEffect === "function") {
      let effect = Reward.supplyEffect(root, territory.key);
      if (!effect && optionsInput.allowResolvedSupply && territory.owner === "player") {
        effect = historicalSupplyEffect(Reward, territory);
      }
      if (!effect) return null;
      return {
        role,
        label: cleanText(meta && meta.label, "補給所"),
        copy: `足場の支援と合わせ、攻略時間を通常比約${boundedPercent(effect.combinedPercent)}%短縮`
      };
    }
    if (role === "scout" && territory.scouted) {
      return {
        role,
        label: cleanText(meta && meta.label, "斥候所"),
        copy: "この地点の危険と備えを攻略前に把握"
      };
    }
    return null;
  }

  function operationModel(root, stateInput) {
    const state = stateInput || expeditionState(root);
    const expedition = state && state.activeExpedition;
    if (!expedition || !expedition.inputs) return null;
    const models = territoryModels(root);
    const territory = territoryForDestination(root, expedition.inputs.destinationId, models);
    if (!territory) return null;
    const destination = asArray(state.destinations).find((item) => item && item.id === expedition.inputs.destinationId);
    const companions = asArray(expedition.inputs.companionIds)
      .map((id) => asArray(state.companions).find((item) => item && item.id === id))
      .filter(Boolean);
    const equipment = asArray(expedition.inputs.equipmentIds)
      .map((id) => asArray(state.equipment).find((item) => item && item.id === id))
      .filter(Boolean);
    const policies = root && root.CrownlessExpeditionSystem && root.CrownlessExpeditionSystem.policies;
    const policy = policies && policies[expedition.inputs.policyId];
    const context = developmentContext(root, territory, models);
    return {
      destinationName: cleanText(destination && destination.name, cleanText(territory.entry && territory.entry.name, "攻略地点")),
      policyName: cleanText(policy && policy.name, cleanText(expedition.inputs.policyId, "通常")),
      companionNames: companions.map((item) => cleanText(item.name)).filter(Boolean),
      equipmentNames: equipment.map((item) => cleanText(item.name)).filter(Boolean),
      expectedReturnAt: Number(expedition.expectedReturnAt) || 0,
      scouted: Boolean(territory.scouted),
      intel: territory.scouted && root.CrownlessTerritoryPhase1 && typeof root.CrownlessTerritoryPhase1.dangerTags === "function"
        ? asArray(root.CrownlessTerritoryPhase1.dangerTags(root, territory.entry)).map((item) => cleanText(item)).filter(Boolean).slice(0, 3)
        : [],
      development: context
    };
  }

  function appendOperationBrief(document, root) {
    if (!document || !root || typeof document.createElement !== "function") return false;
    const active = document.querySelector && document.querySelector("#expedition-folio-content .expedition-active");
    if (!active || active.querySelector?.(".territory-operation-brief")) return false;
    const model = operationModel(root);
    if (!model) return false;

    const panel = document.createElement("section");
    panel.className = "expedition-review territory-operation-brief";
    panel.setAttribute("aria-label", "実行中の作戦");
    const kicker = document.createElement("small");
    kicker.textContent = "OPERATION / 作戦実行中";
    const title = document.createElement("strong");
    title.textContent = model.destinationName;
    const strategy = document.createElement("p");
    const intel = model.scouted
      ? `偵察済み${model.intel.length ? `（${model.intel.join("・")}）` : ""}`
      : "未偵察で攻略";
    strategy.textContent = `作戦: ${intel} / ${model.policyName}方針`;
    const party = document.createElement("p");
    party.textContent = `隊: ${model.companionNames.join("、") || "未確認"} / 装備: ${model.equipmentNames.join("、") || "なし"}`;
    panel.append(kicker, title, strategy, party);
    if (model.development) {
      const support = document.createElement("p");
      support.className = "territory-development-effect";
      support.textContent = `支援: ${model.development.label} → ${model.development.copy}`;
      panel.appendChild(support);
    }
    if (model.expectedReturnAt) {
      const date = new Date(model.expectedReturnAt);
      const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      const returnAt = document.createElement("p");
      returnAt.textContent = `帰還予定: ${clock}`;
      panel.appendChild(returnAt);
    }
    active.appendChild(panel);
    return true;
  }

  function selectedEquipment(state, report) {
    const names = new Set(asArray(report && report.dispatchSummary && report.dispatchSummary.equipment).map((item) => cleanText(item)).filter(Boolean));
    return asArray(state && state.equipment).filter((item) => item && names.has(cleanText(item.name)));
  }

  function reportCausalEffects(root, report, stateInput) {
    if (!root || !report || !report.territoryOutcome) return [];
    const state = stateInput || expeditionState(root) || {};
    const models = territoryModels(root);
    const territory = territoryForDestination(root, report.destinationId, models);
    if (!territory) return [];
    const effects = [];
    const resolvedOwnControl = Boolean(
      report.territoryOutcome.controlled
      && cleanText(report.territoryOutcome.discoveryKey) === cleanText(territory.key)
      && territory.owner === "player"
    );
    const context = developmentContext(root, territory, models, { allowResolvedSupply: resolvedOwnControl });
    if (context) effects.push(`${context.label} → ${context.copy}。`);
    else if (territory.scouted) {
      const Territory = root.CrownlessTerritoryPhase1;
      const intel = Territory && typeof Territory.dangerTags === "function"
        ? asArray(Territory.dangerTags(root, territory.entry)).map((item) => cleanText(item)).filter(Boolean).slice(0, 3)
        : [];
      effects.push(`事前偵察 → ${intel.length ? intel.join("・") : "守りと危険"}を攻略前に把握。`);
    }

    const log = asArray(report.log);
    const gear = selectedEquipment(state, report);
    let equipmentEffect = null;
    for (const item of gear) {
      const tags = new Set(asArray(item.tags).map((tag) => cleanText(tag)).filter(Boolean));
      const direct = log.find((entry) => ["equipment", "combat-tactic"].includes(entry && entry.type) && asArray(entry.causes).some((cause) => tags.has(cleanText(cause))));
      if (direct) {
        equipmentEffect = `${cleanText(item.name, "装備")} → ${cleanText(direct.text, "攻略に作用した")}`;
        break;
      }
    }
    if (!equipmentEffect) {
      for (const item of gear) {
        const tags = new Set(asArray(item.tags).map((tag) => cleanText(tag)).filter(Boolean));
        const event = log.find((entry) => asArray(entry && entry.causes).some((cause) => tags.has(cleanText(cause))));
        if (event) {
          equipmentEffect = `${cleanText(item.name, "装備")} → ${cleanText(event.text, "攻略に作用した")}`;
          break;
        }
      }
    }
    if (equipmentEffect) effects.push(equipmentEffect.replace(/[。]+$/, "") + "。");

    const companionIds = new Set(asArray(report.companionIds).map((id) => cleanText(id)).filter(Boolean));
    const companions = asArray(state && state.companions).filter((item) => item && companionIds.has(cleanText(item.id)));
    const combatCauses = new Set(asArray(report.combat && report.combat.encounters).flatMap((encounter) => asArray(encounter && encounter.causes)).map((cause) => cleanText(cause)).filter(Boolean));
    const companion = companions.find((item) => asArray(item.traits).some((trait) => combatCauses.has(cleanText(trait))));
    if (companion) {
      const used = asArray(companion.traits).map((trait) => cleanText(trait)).filter((trait) => combatCauses.has(trait));
      const labels = used.map((trait) => TRAIT_LABELS[trait] || trait).slice(0, 2);
      effects.push(`${cleanText(companion.name, "仲間")} → ${labels.join("・") || "特性"}が戦闘の攻防に反映。`);
    }

    return effects.slice(0, 3);
  }

  function appendReportCausality(document, root) {
    if (!document || !root || typeof document.createElement !== "function") return false;
    const summary = document.querySelector && document.querySelector("#expedition-folio-content .expedition-report-summary");
    if (!summary || !summary.parentElement || summary.parentElement.querySelector?.(".expedition-causal-decisions")) return false;
    const state = expeditionState(root);
    const report = state && asArray(state.completedReports)[0];
    const effects = reportCausalEffects(root, report, state);
    if (!effects.length) return false;

    const panel = document.createElement("section");
    panel.className = "expedition-review expedition-causal-decisions";
    panel.setAttribute("aria-label", "判断が効いた点");
    const kicker = document.createElement("small");
    kicker.textContent = "CAUSAL REPORT / 判断が効いた点";
    const title = document.createElement("strong");
    title.textContent = "あなたの選択 → 起きたこと";
    panel.append(kicker, title);
    effects.forEach((effect) => {
      const line = document.createElement("p");
      line.textContent = effect;
      panel.appendChild(line);
    });
    summary.parentElement.insertBefore(panel, summary);
    return true;
  }

  function syncAtlasTrace(document, root) {
    if (!document || !root || !root.CrownlessWorldTraces) return false;
    const detail = document.querySelector && document.querySelector("#world-atlas-viewer .world-atlas-detail");
    if (!detail) return false;
    detail.querySelector?.(".world-trace-investigation--territory")?.remove();
    const models = territoryModels(root);
    const territory = selectedTerritory(document, models);
    const trace = traceForTerritory(root, territory, models);
    return appendTerritoryTracePanel(document, detail, trace);
  }

  function sync(document, root) {
    if (!document || !root) return false;
    let changed = false;
    if (syncAtlasTrace(document, root)) changed = true;
    if (appendOperationBrief(document, root)) changed = true;
    if (appendReportCausality(document, root)) changed = true;
    return changed;
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
      if (target.closest("[data-territory-key], [data-development-role], .world-atlas-details-toggle, #start-expedition, .expedition-dispatch, .expedition-secondary")) {
        scheduleSync(document, root);
      }
    });

    if (typeof root.MutationObserver === "function" && document.body) {
      const observer = new root.MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node && node.nodeType === 1 && (
          node.matches?.(".territory-development, .world-atlas-detail, .expedition-active, .expedition-report-summary, #expedition-folio-content")
          || node.querySelector?.(".territory-development, .world-atlas-detail, .expedition-active, .expedition-report-summary")
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
    TRAIT_LABELS,
    traceForRole,
    selectedTerritory,
    traceForTerritory,
    appendTerritoryTracePanel,
    territoryModels,
    territoryForDestination,
    developmentContext,
    operationModel,
    appendOperationBrief,
    reportCausalEffects,
    appendReportCausality,
    syncAtlasTrace,
    sync,
    scheduleSync,
    install
  });
});