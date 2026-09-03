(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionForcedMarch = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionForcedMarch() {
  "use strict";

  const NORMAL_PACE = "normal";
  const FORCED_PACE = "forced";
  const FORCED_DURATION_RATIO = 0.5;
  const FORCED_RECOVERY_MS = 5 * 60 * 1000;
  let selectedPace = NORMAL_PACE;

  function normalizePace(value) {
    return value === FORCED_PACE ? FORCED_PACE : NORMAL_PACE;
  }

  function setSelectedPace(value) {
    selectedPace = normalizePace(value);
    return selectedPace;
  }

  function getSelectedPace() {
    return selectedPace;
  }

  function dispatchInputForPace(state, input, paceValue) {
    const inputCopy = { ...(input || {}) };
    const pace = normalizePace(paceValue);
    if (pace !== FORCED_PACE || Number.isFinite(inputCopy.durationMs)) return { input: inputCopy, pace };
    const destination = state && Array.isArray(state.destinations)
      ? state.destinations.find((item) => item && item.id === inputCopy.destinationId)
      : null;
    if (destination && Number.isFinite(destination.durationMs)) {
      inputCopy.durationMs = Math.max(0, Math.round(destination.durationMs * FORCED_DURATION_RATIO));
    }
    return { input: inputCopy, pace };
  }

  function isForcedMarch(expedition) {
    return Boolean(expedition && expedition.inputs && expedition.inputs.pace === FORCED_PACE);
  }

  function decorateReport(report, expedition) {
    if (!report || !isForcedMarch(expedition)) return report;
    report.marchPace = FORCED_PACE;
    if (!["success", "early-return"].includes(report.outcome)) return report;
    const injured = new Set(Array.isArray(report.injuries) ? report.injuries : []);
    const fatiguedIds = (Array.isArray(report.companionIds) ? report.companionIds : []).filter((id) => !injured.has(id));
    report.forcedMarchFatigueIds = fatiguedIds;
    if (!fatiguedIds.length) return report;
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "forced-march-fatigue")) {
      report.log.push({
        minute: 109,
        time: "",
        type: "forced-march-fatigue",
        text: "強行軍で帰路を急いだ。帰還は早まったが、隊には疲労が残った。",
        causes: ["forced-march", "shorter-wait", "fatigue"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function applyFatigue(state, report) {
    if (!state || !report || report.marchPace !== FORCED_PACE) return state;
    const ids = new Set(Array.isArray(report.forcedMarchFatigueIds) ? report.forcedMarchFatigueIds : []);
    if (!ids.size || !Array.isArray(state.companions)) return state;
    const completedAt = Number.isFinite(Number(report.completedAt)) ? Number(report.completedAt) : Date.now();
    for (const companion of state.companions) {
      if (!companion || !ids.has(companion.id) || !["healthy", "ready"].includes(companion.condition)) continue;
      companion.condition = "recovering";
      companion.recoveryStartedAt = completedAt;
      companion.recoveryUntil = completedAt + FORCED_RECOVERY_MS;
      const entry = "強行軍の疲労で休養";
      const current = String(companion.history || "").trim();
      if (!current.includes(entry)) companion.history = current ? `${current} / ${entry}` : entry;
    }
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    stored.marchPace = report.marchPace;
    stored.forcedMarchFatigueIds = report.forcedMarchFatigueIds;
    stored.log = report.log;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__forcedMarchInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithMarchPace(state, input, nowMs) {
      const prepared = dispatchInputForPace(state, input, selectedPace);
      const next = baseDispatch(state, prepared.input, nowMs);
      if (next && next.activeExpedition && next.activeExpedition.inputs) next.activeExpedition.inputs.pace = prepared.pace;
      selectedPace = NORMAL_PACE;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithMarchPace(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithMarchPace(state, report) {
      const wasApplied = Boolean(state && Array.isArray(state.appliedExpeditionIds) && state.appliedExpeditionIds.includes(report && report.expeditionId));
      const applied = baseApplyReport(state, report);
      if (!wasApplied) applyFatigue(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithMarchPace(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        applyFatigue(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__forcedMarchInstalled = true;
    return true;
  }

  function injectPaceChoice(root) {
    const document = root && root.document;
    if (!document) return false;
    const form = document.querySelector("form.expedition-prepare");
    if (!form || form.querySelector("[data-expedition-march-pace]")) return Boolean(form);

    selectedPace = NORMAL_PACE;
    const fieldset = document.createElement("fieldset");
    fieldset.className = "expedition-choice expedition-choice--pace";
    fieldset.dataset.expeditionMarchPace = "true";
    const legend = document.createElement("legend");
    legend.textContent = "行軍速度";
    fieldset.appendChild(legend);

    [
      { id: NORMAL_PACE, name: "通常行軍", copy: "帰還予定と疲労はいつもどおり" },
      { id: FORCED_PACE, name: "強行軍", copy: "帰還予定を半分にする代わり、無傷でも約5分の休養が必要" },
    ].forEach((choice) => {
      const label = document.createElement("label");
      label.className = "expedition-choice__item";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "march-pace";
      input.value = choice.id;
      input.checked = choice.id === NORMAL_PACE;
      input.addEventListener("change", () => {
        if (input.checked) setSelectedPace(input.value);
      });
      const body = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = choice.name;
      const small = document.createElement("small");
      small.textContent = choice.copy;
      body.append(strong, small);
      label.append(input, body);
      fieldset.appendChild(label);
    });

    const gear = form.querySelector(".expedition-choice--gear");
    if (gear) form.insertBefore(fieldset, gear);
    else form.appendChild(fieldset);
    return true;
  }

  function installUi(root) {
    if (!root || !root.document) return false;
    injectPaceChoice(root);
    if (root.__forcedMarchUiObserverInstalled) return true;
    const Observer = root.MutationObserver;
    if (typeof Observer !== "function") return true;
    const observer = new Observer(() => injectPaceChoice(root));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.__forcedMarchUiObserverInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const systemReady = installSystemHooks(root);
      const uiReady = installUi(root);
      if ((!systemReady || !uiReady) && root.setTimeout && attempts < 40) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return {
    NORMAL_PACE,
    FORCED_PACE,
    FORCED_DURATION_RATIO,
    FORCED_RECOVERY_MS,
    normalizePace,
    setSelectedPace,
    getSelectedPace,
    dispatchInputForPace,
    isForcedMarch,
    decorateReport,
    applyFatigue,
    syncStoredReport,
    installSystemHooks,
    injectPaceChoice,
    installUi,
    install,
  };
});