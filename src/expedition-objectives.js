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
    hunt: Object.freeze({ id: "hunt", name: "狩り", description: "敵対遭遇や標的の痕跡を優先する" }),
  });

  function normalizeObjective(value) {
    return Object.prototype.hasOwnProperty.call(OBJECTIVES, value) ? value : "explore";
  }

  function selectedObjective(doc) {
    const selected = doc && doc.querySelector('input[name="objective"]:checked');
    return selected ? normalizeObjective(selected.value) : null;
  }

  function readState(root) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
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

  function enhancePrepare(root) {
    const doc = root.document;
    const form = doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form || form.querySelector("[data-expedition-objective]")) return false;
    const groups = Array.from(form.querySelectorAll("fieldset.expedition-choice"));
    const policy = groups.find((group) => group.querySelector("legend")?.textContent.trim() === "方針");
    const objective = createObjectiveGroup(doc);
    if (policy) form.insertBefore(objective, policy);
    else form.prepend(objective);
    return true;
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

  function decorateReport(report, objectiveId) {
    if (!report || typeof report !== "object") return report;
    const id = normalizeObjective(objectiveId);
    report.objectiveId = id;
    report.objectiveName = OBJECTIVES[id].name;
    return report;
  }

  function installSystemHooks(root) {
    const system = root.CrownlessExpeditionSystem;
    if (!system || system.__objectiveChoiceInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithObjectiveChoice(state, input, nowMs) {
      const fromUi = selectedObjective(root.document);
      const objective = normalizeObjective(fromUi || (input && input.objective));
      return baseDispatch(state, { ...(input || {}), objective }, nowMs);
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithObjective(expedition, state) {
      const report = baseResolve(expedition, state);
      return decorateReport(report, expedition && expedition.inputs && expedition.inputs.objective);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithObjective(state, nowMs) {
      const objectiveId = state && state.activeExpedition && state.activeExpedition.inputs
        ? state.activeExpedition.inputs.objective
        : "explore";
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report) {
        decorateReport(advanced.report, objectiveId);
        const reports = advanced.state && advanced.state.completedReports;
        if (Array.isArray(reports)) {
          const stored = reports.find((item) => item && item.expeditionId === advanced.report.expeditionId);
          decorateReport(stored, objectiveId);
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

  return { OBJECTIVES, normalizeObjective, decorateReport, install };
});
