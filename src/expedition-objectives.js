(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionObjectives = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionObjectives() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const OBJECTIVES = Object.freeze({
    explore: Object.freeze({ id: "explore", name: "探索", description: "新しい手掛かりや発見を優先する" }),
    scavenge: Object.freeze({ id: "scavenge", name: "漁り", description: "持ち帰れる戦利品を優先する" }),
    hunt: Object.freeze({ id: "hunt", name: "狩り", description: "敵対遭遇から標的の痕跡を探す" }),
  });

  function normalizeObjective(value) {
    return Object.prototype.hasOwnProperty.call(OBJECTIVES, value) ? value : "explore";
  }

  function selectedObjective(doc) {
    const selected = doc && doc.querySelector('input[name="objective"]:checked');
    return selected ? normalizeObjective(selected.value) : null;
  }

  function selectedHuntTrace(doc) {
    const selected = doc && doc.querySelector('input[name="huntTrace"]:checked');
    return selected && selected.value ? selected.value : null;
  }

  function readState(root) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function availableHuntTraces(state) {
    const reports = state && Array.isArray(state.completedReports) ? state.completedReports : [];
    const known = new Set(state && Array.isArray(state.discoveredDestinationIds) ? state.discoveredDestinationIds : []);
    const traces = [];
    const seen = new Set();
    for (const report of reports) {
      const discoveries = report && Array.isArray(report.discoveries) ? report.discoveries : [];
      const encounter = report && report.combat && Array.isArray(report.combat.encounters)
        ? report.combat.encounters.find((item) => item && item.encounterId)
        : null;
      for (const discovery of discoveries) {
        if (!discovery || discovery.kind !== "hunt-trace" || !known.has(discovery.id) || seen.has(discovery.id)) continue;
        traces.push({
          ...discovery,
          encounterId: discovery.encounterId || (encounter && encounter.encounterId) || null,
          encounterName: discovery.encounterName || (encounter && encounter.encounterName) || null,
        });
        seen.add(discovery.id);
      }
    }
    return traces;
  }

  function objectiveForVisibleFolio(root) {
    const state = readState(root);
    if (!state) return OBJECTIVES.explore;
    if (state.activeExpedition && state.activeExpedition.inputs) {
      return OBJECTIVES[normalizeObjective(state.activeExpedition.inputs.objective)];
    }
    const historySelect = root.document.querySelector(".expedition-report-history select");
    const selectedId = historySelect && historySelect.value;
    const reports = Array.isArray(state.completedReports) ? state.completedReports : [];
    const report = reports.find((item) => item && item.expeditionId === selectedId) || reports[0];
    return OBJECTIVES[normalizeObjective(report && (report.objectiveId || report.objective))];
  }

  function createObjectiveGroup(doc) {
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-objective-choice";
    group.dataset.expeditionObjective = "true";
    const legend = doc.createElement("legend");
    legend.textContent = "目的";
    group.append(legend);

    Object.values(OBJECTIVES).forEach((objective, index) => {
      const label = doc.createElement("label");
      label.className = "expedition-choice__item";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "objective";
      input.value = objective.id;
      input.checked = index === 0;
      const body = doc.createElement("span");
      const strong = doc.createElement("strong");
      strong.textContent = objective.name;
      const small = doc.createElement("small");
      small.textContent = objective.description;
      body.append(strong, small);
      label.append(input, body);
      group.append(label);
    });
    return group;
  }

  function createHuntTraceGroup(doc, traces) {
    if (!traces.length) return null;
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-hunt-trace-choice";
    group.dataset.huntTraceChoice = "true";
    const legend = doc.createElement("legend");
    legend.textContent = "狩りの標的";
    group.append(legend);

    const freshLabel = doc.createElement("label");
    freshLabel.className = "expedition-choice__item";
    const freshInput = doc.createElement("input");
    freshInput.type = "radio";
    freshInput.name = "huntTrace";
    freshInput.value = "";
    freshInput.checked = true;
    const freshBody = doc.createElement("span");
    const freshStrong = doc.createElement("strong");
    freshStrong.textContent = "新しい痕跡を探す";
    const freshSmall = doc.createElement("small");
    freshSmall.textContent = "新しい敵対遭遇から追跡痕を持ち帰る";
    freshBody.append(freshStrong, freshSmall);
    freshLabel.append(freshInput, freshBody);
    group.append(freshLabel);

    traces.forEach((trace) => {
      const label = doc.createElement("label");
      label.className = "expedition-choice__item";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "huntTrace";
      input.value = trace.id;
      const body = doc.createElement("span");
      const strong = doc.createElement("strong");
      strong.textContent = trace.name;
      const small = doc.createElement("small");
      small.textContent = "同じ土地へ狩りに出て仕留めれば討伐証を得る。撤退なら痕跡は残る";
      body.append(strong, small);
      label.append(input, body);
      group.append(label);
    });
    return group;
  }

  function enhancePrepare(root) {
    const doc = root.document;
    const form = doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form) return false;
    let changed = false;
    let objective = form.querySelector("[data-expedition-objective]");
    if (!objective) {
      const groups = Array.from(form.querySelectorAll("fieldset.expedition-choice"));
      const policy = groups.find((group) => group.querySelector("legend")?.textContent.trim() === "方針");
      objective = createObjectiveGroup(doc);
      if (policy) form.insertBefore(objective, policy);
      else form.prepend(objective);
      changed = true;
    }

    if (!form.querySelector("[data-hunt-trace-choice]")) {
      const traces = availableHuntTraces(readState(root));
      const traceGroup = createHuntTraceGroup(doc, traces);
      if (traceGroup) {
        objective.insertAdjacentElement("afterend", traceGroup);
        changed = true;
      }
    }
    return changed;
  }

  function enhanceOutcomeCopy(root) {
    const doc = root.document;
    const shell = doc.getElementById("expedition-folio");
    if (!shell || !shell.classList.contains("is-open")) return false;
    const objective = objectiveForVisibleFolio(root);
    let changed = false;

    const activeCopy = doc.querySelector("#expedition-folio .expedition-active p");
    if (activeCopy && !activeCopy.dataset.objectiveShown) {
      activeCopy.textContent += ` / 目的: ${objective.name}`;
      activeCopy.dataset.objectiveShown = "true";
      changed = true;
    }

    const heading = doc.querySelector("#expedition-folio .expedition-folio__heading");
    const reportSummary = doc.querySelector("#expedition-folio [data-expedition-summary]");
    if (heading && reportSummary) {
      const copy = heading.querySelector("p:last-child");
      if (copy && !copy.dataset.objectiveShown) {
        copy.textContent = `目的: ${objective.name}。${copy.textContent}`;
        copy.dataset.objectiveShown = "true";
        changed = true;
      }
      if (!reportSummary.querySelector("[data-objective-summary]")) {
        const cell = doc.createElement("div");
        cell.dataset.objectiveSummary = "true";
        const small = doc.createElement("small");
        small.textContent = "目的";
        const strong = doc.createElement("strong");
        strong.textContent = objective.name;
        cell.append(small, strong);
        reportSummary.prepend(cell);
        changed = true;
      }
    }
    return changed;
  }

  function huntTraceForReport(report) {
    const encounters = report && report.combat && Array.isArray(report.combat.encounters)
      ? report.combat.encounters
      : [];
    const encounter = encounters.find((item) => item && item.encounterId);
    if (!encounter) return null;
    return {
      id: `hunt-trace-${report.destinationId}-${encounter.encounterId}`,
      name: `${encounter.encounterName || "敵影"}の追跡痕`,
      sourceDestinationId: report.destinationId,
      encounterId: encounter.encounterId,
      encounterName: encounter.encounterName || "敵影",
      kind: "hunt-trace",
    };
  }

  function applyTrackedHunt(report, targetTrace) {
    if (!report || !targetTrace) return report;
    report.targetHuntTraceId = targetTrace.id;
    report.targetHuntTraceName = targetTrace.name;
    const encounters = report.combat && Array.isArray(report.combat.encounters) ? report.combat.encounters : [];
    const encounter = encounters.find((item) => item && (!targetTrace.encounterId || item.encounterId === targetTrace.encounterId));
    const resolved = Boolean(encounter && encounter.result === "victory" && report.destinationId === targetTrace.sourceDestinationId);
    report.trackedHuntResolved = resolved;

    if (!Array.isArray(report.log)) report.log = [];
    if (resolved) {
      const trophyId = `tracked-trophy-${targetTrace.id}`;
      if (!Array.isArray(report.loot)) report.loot = [];
      if (!report.loot.some((item) => item && item.id === trophyId)) {
        report.loot.push({
          id: trophyId,
          name: `${targetTrace.encounterName || encounter.encounterName || "標的"}の討伐証`,
          tags: ["trophy", "tracked-hunt"],
        });
      }
      if (!report.log.some((item) => item && item.type === "tracked-hunt" && item.causes && item.causes.includes(targetTrace.id))) {
        report.log.push({
          minute: 105,
          time: report.log.find((item) => item && item.minute === 104)?.time || "",
          type: "tracked-hunt",
          text: `${targetTrace.name}を追い、標的を仕留めた。討伐証を確保した。`,
          causes: [targetTrace.id, "resolved trace"],
        });
      }
    } else if (!report.log.some((item) => item && item.type === "tracked-hunt" && item.causes && item.causes.includes(targetTrace.id))) {
      report.log.push({
        minute: 105,
        time: report.log.find((item) => item && item.minute === 104)?.time || "",
        type: "tracked-hunt",
        text: `${targetTrace.name}を追ったが仕留めきれなかった。痕跡はまだ追える。`,
        causes: [targetTrace.id, "unresolved trace"],
      });
    }
    report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    return report;
  }

  function decorateReport(report, objectiveId, targetTrace) {
    if (!report || typeof report !== "object") return report;
    const id = normalizeObjective(objectiveId);
    report.objectiveId = id;
    report.objectiveName = OBJECTIVES[id].name;
    if (id === "hunt" && targetTrace) return applyTrackedHunt(report, targetTrace);
    if (id === "hunt") {
      const trace = huntTraceForReport(report);
      if (trace) {
        if (!Array.isArray(report.discoveries)) report.discoveries = [];
        if (!report.discoveries.some((item) => item && item.id === trace.id)) report.discoveries.push(trace);
        if (Array.isArray(report.log) && !report.log.some((item) => item && item.type === "hunt-trace" && item.causes && item.causes.includes(trace.id))) {
          report.log.push({
            minute: 105,
            time: report.log.find((item) => item && item.minute === 104)?.time || "",
            type: "hunt-trace",
            text: `${trace.name}を記録した。次に追うべき標的の手掛かりになる。`,
            causes: [trace.id, "learned value"],
          });
          report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
        }
      }
    }
    return report;
  }

  function persistHuntTrace(state, report) {
    if (!state || !report || report.objectiveId !== "hunt" || report.targetHuntTraceId) return state;
    const trace = Array.isArray(report.discoveries)
      ? report.discoveries.find((item) => item && item.kind === "hunt-trace")
      : null;
    if (!trace) return state;
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(trace.id)) state.discoveredDestinationIds.push(trace.id);
    return state;
  }

  function persistTrackedHuntReward(state, report) {
    if (!state || !report || !report.trackedHuntResolved || !Array.isArray(report.loot)) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    for (const item of report.loot.filter((loot) => loot && Array.isArray(loot.tags) && loot.tags.includes("tracked-hunt"))) {
      if (!state.securedLoot.some((existing) => existing && existing.sourceExpeditionId === report.expeditionId && existing.id === item.id)) {
        state.securedLoot.push({ ...item, sourceExpeditionId: report.expeditionId });
      }
    }
    return state;
  }

  function resolveTrackedHuntState(state, report) {
    if (!state || !report || !report.trackedHuntResolved || !report.targetHuntTraceId) return state;
    if (!Array.isArray(state.discoveredDestinationIds)) return state;
    state.discoveredDestinationIds = state.discoveredDestinationIds.filter((id) => id !== report.targetHuntTraceId);
    return state;
  }

  function traceForExpedition(state, expedition) {
    const traceId = expedition && expedition.inputs && expedition.inputs.huntTraceId;
    if (!traceId) return null;
    return availableHuntTraces(state).find((trace) => trace.id === traceId) || null;
  }

  function installSystemHooks(root) {
    const system = root.CrownlessExpeditionSystem;
    if (!system || system.__objectiveChoiceInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithObjectiveChoice(state, input, nowMs) {
      const fromUi = selectedObjective(root.document);
      const objective = normalizeObjective(fromUi || (input && input.objective));
      const selectedTraceId = objective === "hunt" ? (selectedHuntTrace(root.document) || (input && input.huntTraceId)) : null;
      const traces = selectedTraceId ? availableHuntTraces(state) : [];
      const targetTrace = traces.find((trace) => trace.id === selectedTraceId && trace.sourceDestinationId === input.destinationId) || null;
      const next = baseDispatch(state, { ...(input || {}), objective }, nowMs);
      if (targetTrace && next.activeExpedition && next.activeExpedition.inputs) next.activeExpedition.inputs.huntTraceId = targetTrace.id;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithObjective(expedition, state) {
      const report = baseResolve(expedition, state);
      return decorateReport(report, expedition && expedition.inputs && expedition.inputs.objective, traceForExpedition(state, expedition));
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithObjective(state, report) {
      const targetTrace = report && report.targetHuntTraceId
        ? availableHuntTraces(state).find((trace) => trace.id === report.targetHuntTraceId) || null
        : null;
      const decorated = decorateReport(report, report && report.objectiveId, targetTrace);
      const applied = baseApplyReport(state, decorated);
      persistHuntTrace(applied, decorated);
      persistTrackedHuntReward(applied, decorated);
      return resolveTrackedHuntState(applied, decorated);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithObjective(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const objectiveId = expedition && expedition.inputs ? expedition.inputs.objective : "explore";
      const targetTrace = traceForExpedition(state, expedition);
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report) {
        decorateReport(advanced.report, objectiveId, targetTrace);
        persistHuntTrace(advanced.state, advanced.report);
        persistTrackedHuntReward(advanced.state, advanced.report);
        resolveTrackedHuntState(advanced.state, advanced.report);
        const reports = advanced.state && advanced.state.completedReports;
        if (Array.isArray(reports)) {
          const stored = reports.find((item) => item && item.expeditionId === advanced.report.expeditionId);
          decorateReport(stored, objectiveId, targetTrace);
        }
      }
      return advanced;
    };

    system.__objectiveChoiceInstalled = true;
    return true;
  }

  function install(root) {
    if (!root || !root.document) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const hooked = installSystemHooks(root);
      enhancePrepare(root);
      enhanceOutcomeCopy(root);
      if (!hooked && attempts < 40) root.setTimeout(sync, 50);
    };
    sync();

    if (!root.__crownlessObjectiveObserver) {
      const observer = new root.MutationObserver(() => {
        enhancePrepare(root);
        enhanceOutcomeCopy(root);
      });
      observer.observe(root.document.body, { subtree: true, childList: true });
      root.__crownlessObjectiveObserver = observer;
    }
    return true;
  }

  return {
    OBJECTIVES,
    normalizeObjective,
    availableHuntTraces,
    huntTraceForReport,
    applyTrackedHunt,
    decorateReport,
    persistHuntTrace,
    persistTrackedHuntReward,
    resolveTrackedHuntState,
    install,
  };
});