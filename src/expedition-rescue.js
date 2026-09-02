(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionRescue = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionRescue() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function readState(root) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function selectedRescueTarget(doc) {
    const selected = doc && doc.querySelector('input[name="rescueTarget"]:checked');
    return selected && selected.value ? selected.value : null;
  }

  function qualifiesForMissing(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && !inputs.rescueTargetId
      && report.outcome === "failed"
      && inputs.policyId === "greedy"
      && Array.isArray(inputs.companionIds)
      && inputs.companionIds.length === 1
    );
  }

  function decorateMissingReport(report, expedition, state) {
    if (!qualifiesForMissing(report, expedition)) return report;
    const companionId = expedition.inputs.companionIds[0];
    const companion = state && Array.isArray(state.companions)
      ? state.companions.find((item) => item && item.id === companionId)
      : null;
    const name = companion && companion.name || "仲間";

    report.originalOutcome = report.originalOutcome || report.outcome;
    report.outcome = "missing";
    report.missingCompanionIds = [companionId];
    report.missingDestinationId = report.destinationId;
    report.missingDestinationName = report.destinationName;
    if (!Array.isArray(report.log)) report.log = [];

    const returnEntry = report.log.find((entry) => entry && entry.type === "return");
    if (returnEntry) {
      returnEntry.text = `隊の知らせだけが灰炉へ届いた。${name}は戻っていない。最後に確認されたのは${report.destinationName}だ。`;
      returnEntry.causes = Array.from(new Set([...(returnEntry.causes || []), "missing"]));
    }
    if (!report.log.some((entry) => entry && entry.type === "missing" && entry.causes && entry.causes.includes(companionId))) {
      report.log.push({
        minute: 111,
        time: returnEntry && returnEntry.time || "",
        type: "missing",
        text: `${name}が行方不明になった。${report.destinationName}を最後の手掛かりとして救助に向かえる。`,
        causes: [companionId, report.destinationId, "rescue opportunity"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "missing") || report.notableEvent;
    return report;
  }

  function availableRescueOpportunities(state) {
    const reports = state && Array.isArray(state.completedReports) ? state.completedReports : [];
    const companions = state && Array.isArray(state.companions) ? state.companions : [];
    const results = [];
    const seen = new Set();

    for (const report of reports) {
      const ids = report && Array.isArray(report.missingCompanionIds) ? report.missingCompanionIds : [];
      for (const companionId of ids) {
        if (seen.has(companionId)) continue;
        const companion = companions.find((item) => item && item.id === companionId);
        if (!companion || companion.condition !== "missing") continue;
        results.push({
          id: `rescue-${report.expeditionId}-${companionId}`,
          sourceExpeditionId: report.expeditionId,
          companionId,
          companionName: companion.name || companionId,
          destinationId: report.missingDestinationId || report.destinationId,
          destinationName: report.missingDestinationName || report.destinationName || "最後に分かった場所",
        });
        seen.add(companionId);
      }
    }
    return results;
  }

  function rescueOpportunityById(state, id) {
    return availableRescueOpportunities(state).find((item) => item.id === id) || null;
  }

  function decorateRescueReport(report, expedition, state) {
    const inputs = expedition && expedition.inputs;
    if (!report || !inputs || !inputs.rescueTargetId) return report;
    const target = rescueOpportunityById(state, inputs.rescueTargetId) || {
      id: inputs.rescueTargetId,
      companionId: inputs.rescueCompanionId,
      companionName: inputs.rescueCompanionName || inputs.rescueCompanionId || "仲間",
      destinationId: inputs.destinationId,
      destinationName: report.destinationName,
    };
    if (!target.companionId) return report;

    const reachedLastKnownArea = report.destinationId === target.destinationId;
    const rescued = reachedLastKnownArea && report.outcome === "success";
    report.rescueTargetId = target.id;
    report.rescueCompanionId = target.companionId;
    report.rescueCompanionName = target.companionName;
    report.rescueResolved = rescued;
    if (rescued) report.rescuedCompanionIds = [target.companionId];

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "rescue" && entry.causes && entry.causes.includes(target.id))) {
      report.log.push({
        minute: 106,
        time: report.log.find((entry) => entry && entry.minute === 104)?.time || "",
        type: "rescue",
        text: rescued
          ? `${target.companionName}を発見し、負傷したまま灰炉へ連れ帰ることができた。`
          : `${target.companionName}の手掛かりを追ったが救助には至らなかった。もう一度向かえる。`,
        causes: [target.id, target.companionId, rescued ? "rescued" : "unresolved rescue"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    if (rescued) report.notableEvent = report.log.find((entry) => entry && entry.type === "rescue") || report.notableEvent;
    return report;
  }

  function applyRescueState(state, report) {
    if (!state || !report || !Array.isArray(state.companions)) return state;

    const missingIds = Array.isArray(report.missingCompanionIds) ? report.missingCompanionIds : [];
    for (const companionId of missingIds) {
      const companion = state.companions.find((item) => item && item.id === companionId);
      if (!companion) continue;
      companion.condition = "missing";
      delete companion.recoveryStartedAt;
      delete companion.recoveryUntil;
      const marker = `${report.destinationName}で行方不明`;
      if (!String(companion.history || "").includes(marker)) {
        companion.history = companion.history ? `${companion.history} / ${marker}` : marker;
      }
    }

    if (report.rescueResolved && report.rescueCompanionId) {
      const companion = state.companions.find((item) => item && item.id === report.rescueCompanionId);
      if (companion && companion.condition === "missing") {
        companion.condition = "injured";
        delete companion.recoveryStartedAt;
        delete companion.recoveryUntil;
        const marker = `${report.destinationName}で救助`;
        if (!String(companion.history || "").includes(marker)) {
          companion.history = companion.history ? `${companion.history} / ${marker}` : marker;
        }
      }
    }
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return state;
    const index = state.completedReports.findIndex((item) => item && item.expeditionId === report.expeditionId);
    if (index >= 0) state.completedReports[index] = clone(report);
    return state;
  }

  function createRescueGroup(doc, opportunities) {
    if (!opportunities.length) return null;
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-rescue-choice";
    group.dataset.rescueChoice = "true";
    const legend = doc.createElement("legend");
    legend.textContent = "救助案件";
    group.append(legend);

    const normalLabel = doc.createElement("label");
    normalLabel.className = "expedition-choice__item";
    const normalInput = doc.createElement("input");
    normalInput.type = "radio";
    normalInput.name = "rescueTarget";
    normalInput.value = "";
    normalInput.checked = true;
    const normalBody = doc.createElement("span");
    const normalStrong = doc.createElement("strong");
    normalStrong.textContent = "通常の遠征";
    const normalSmall = doc.createElement("small");
    normalSmall.textContent = "目的と行き先を自由に決める";
    normalBody.append(normalStrong, normalSmall);
    normalLabel.append(normalInput, normalBody);
    group.append(normalLabel);

    opportunities.forEach((target) => {
      const label = doc.createElement("label");
      label.className = "expedition-choice__item";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "rescueTarget";
      input.value = target.id;
      input.dataset.destinationId = target.destinationId;
      const body = doc.createElement("span");
      const strong = doc.createElement("strong");
      strong.textContent = `${target.companionName}を救助する`;
      const small = doc.createElement("small");
      small.textContent = `最後の手掛かり: ${target.destinationName} / 成功すれば負傷状態で連れ帰る`;
      body.append(strong, small);
      label.append(input, body);
      group.append(label);
    });
    return group;
  }

  function enhancePrepare(root) {
    const doc = root.document;
    const form = doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form || form.querySelector("[data-rescue-choice]")) return false;
    const opportunities = availableRescueOpportunities(readState(root));
    const group = createRescueGroup(doc, opportunities);
    if (!group) return false;

    const destinationGroup = Array.from(form.querySelectorAll("fieldset.expedition-choice"))
      .find((field) => field.querySelector("legend")?.textContent.trim() === "遠征先");
    if (destinationGroup) destinationGroup.insertAdjacentElement("afterend", group);
    else form.prepend(group);

    group.addEventListener("change", (event) => {
      if (!event.target || event.target.name !== "rescueTarget" || !event.target.value) return;
      const destinationId = event.target.dataset.destinationId;
      const destination = form.querySelector(`input[name="destination"][value="${destinationId}"]`);
      if (destination) destination.checked = true;
      const explore = form.querySelector('input[name="objective"][value="explore"]');
      if (explore) explore.checked = true;
    });
    return true;
  }

  function enhanceMissingCopy(root) {
    const doc = root.document;
    const shell = doc.getElementById("expedition-folio");
    if (!shell || !shell.classList.contains("is-open")) return false;
    const state = readState(root);
    const opportunities = availableRescueOpportunities(state);
    let changed = false;

    const prepare = doc.querySelector("#expedition-folio form.expedition-prepare");
    if (prepare && opportunities.length) {
      for (const companion of state.companions || []) {
        if (companion.condition !== "missing") continue;
        const input = prepare.querySelector(`input[name="companion"][value="${companion.id}"]`);
        const label = input && input.closest("label");
        const small = label && label.querySelector("small");
        if (small && !small.dataset.missingCopy) {
          small.textContent = small.textContent.replace(/missing$/, "行方不明");
          small.dataset.missingCopy = "true";
          changed = true;
        }
      }
    }

    const reportSummary = doc.querySelector("#expedition-folio [data-expedition-summary]");
    if (reportSummary && !doc.querySelector("[data-rescue-status]")) {
      const reports = state && Array.isArray(state.completedReports) ? state.completedReports : [];
      const historySelect = doc.querySelector(".expedition-report-history select");
      const selectedId = historySelect && historySelect.value;
      const report = reports.find((item) => item && item.expeditionId === selectedId) || reports[0];
      if (report && (report.outcome === "missing" || report.rescueTargetId)) {
        const note = doc.createElement("p");
        note.dataset.rescueStatus = "true";
        note.className = "expedition-form-feedback";
        note.textContent = report.rescueTargetId
          ? (report.rescueResolved ? `${report.rescueCompanionName}を救助した。灰炉で休養させられる。` : `${report.rescueCompanionName}はまだ行方不明だ。救助へ再挑戦できる。`)
          : `${(report.missingCompanionIds || []).map((id) => state.companions.find((item) => item.id === id)?.name || id).join("、")}が戻っていない。次の遠征準備に救助案件が追加された。`;
        reportSummary.insertAdjacentElement("afterend", note);
        changed = true;
      }
    }
    return changed;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__rescueLoopInstalled) return Boolean(system);
    if (!system.__objectiveChoiceInstalled || !system.__equipmentOpportunitiesInstalled) return false;

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithRescue(state, input, nowMs) {
      const selectedId = selectedRescueTarget(root.document) || (input && input.rescueTargetId) || null;
      const target = selectedId ? rescueOpportunityById(state, selectedId) : null;
      const dispatchInput = target ? { ...(input || {}), destinationId: target.destinationId, objective: "explore" } : input;
      const next = baseDispatch(state, dispatchInput, nowMs);
      if (target && next.activeExpedition && next.activeExpedition.inputs) {
        next.activeExpedition.inputs.rescueTargetId = target.id;
        next.activeExpedition.inputs.rescueCompanionId = target.companionId;
        next.activeExpedition.inputs.rescueCompanionName = target.companionName;
      }
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithRescue(expedition, state) {
      const report = baseResolve(expedition, state);
      decorateMissingReport(report, expedition, state);
      return decorateRescueReport(report, expedition, state);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithRescue(state, report) {
      const applied = baseApplyReport(state, report);
      applyRescueState(applied, report);
      return syncStoredReport(applied, report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithRescue(state, nowMs) {
      const expedition = state && state.activeExpedition ? clone(state.activeExpedition) : null;
      const before = state;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateMissingReport(advanced.report, expedition, before);
        decorateRescueReport(advanced.report, expedition, before);
        applyRescueState(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__rescueLoopInstalled = true;
    return true;
  }

  function install(root) {
    if (!root || !root.document) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const hooked = installSystemHooks(root);
      enhancePrepare(root);
      enhanceMissingCopy(root);
      if (!hooked && attempts < 80 && root.setTimeout) root.setTimeout(sync, 50);
    };
    sync();

    if (!root.__crownlessRescueObserver && root.MutationObserver) {
      const observer = new root.MutationObserver(() => {
        enhancePrepare(root);
        enhanceMissingCopy(root);
      });
      observer.observe(root.document.body, { subtree: true, childList: true });
      root.__crownlessRescueObserver = observer;
    }
    return true;
  }

  return {
    qualifiesForMissing,
    decorateMissingReport,
    availableRescueOpportunities,
    rescueOpportunityById,
    decorateRescueReport,
    applyRescueState,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});