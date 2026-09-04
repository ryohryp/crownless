(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionVillageBell = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionVillageBell() {
  "use strict";

  const DESTINATION_ID = "hollow-village";
  const RING = "ring";
  const QUIET = "quiet";
  const APPROACHES = Object.freeze({
    [RING]: Object.freeze({
      id: RING,
      title: "鐘を鳴らす",
      copy: "誰かが応えるかもしれない。だが、廃村にいる別の何かにも居場所を知らせる。",
      suffix: "answering-smoke",
      name: "鐘に応えた遠い煙",
      dangerTags: ["bandit", "unknown"],
      opportunityTags: ["survivor", "rumor", "contact"],
      reportText: "ひび割れた鐘を鳴らすと、谷の向こうで細い煙が一筋だけ上がった。人の返事か、こちらを見ていた何者かの合図かは分からない。",
    }),
    [QUIET]: Object.freeze({
      id: QUIET,
      title: "静かに捜索する",
      copy: "人と出会う機会は捨て、足音を殺して残された物資と記録の痕跡を探す。",
      suffix: "sealed-cellar",
      name: "足音のない封鎖地下蔵",
      dangerTags: ["collapse", "dark"],
      opportunityTags: ["salvage", "ledger", "relic"],
      reportText: "鐘には触れず、崩れた家々を静かに調べた。床板の下に、外から釘で封じられた地下蔵へ続く隙間が残っていた。",
    }),
  });
  let selectedApproach = QUIET;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeApproach(value) {
    return Object.prototype.hasOwnProperty.call(APPROACHES, value) ? value : QUIET;
  }

  function setSelectedApproach(value) {
    selectedApproach = normalizeApproach(value);
    return selectedApproach;
  }

  function followupId(sourceDestinationId, approachId) {
    const profile = APPROACHES[approachId];
    return profile && sourceDestinationId ? `village-choice:${profile.suffix}:${sourceDestinationId}` : null;
  }

  function canResolve(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && report.outcome === "success"
      && inputs
      && inputs.destinationId === DESTINATION_ID
      && APPROACHES[inputs.villageApproach]
    );
  }

  function decorateReport(report, expedition) {
    if (!canResolve(report, expedition)) return report;
    const inputs = expedition.inputs;
    const profile = APPROACHES[inputs.villageApproach];
    const destinationId = followupId(inputs.destinationId, profile.id);
    if (!destinationId) return report;

    report.villageChoice = {
      approachId: profile.id,
      sourceDestinationId: inputs.destinationId,
      destinationId,
    };
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === destinationId)) {
      report.discoveries.push({
        id: destinationId,
        name: profile.name,
        kind: "village-choice-followup",
        sourceDestinationId: inputs.destinationId,
        approachId: profile.id,
      });
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "village-choice" && Array.isArray(entry.causes) && entry.causes.includes(destinationId))) {
      report.log.push({
        minute: 74,
        time: "",
        type: "village-choice",
        text: profile.reportText,
        causes: [DESTINATION_ID, `village-approach:${profile.id}`, destinationId],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "village-choice" && Array.isArray(entry.causes) && entry.causes.includes(destinationId)) || report.notableEvent;
    return report;
  }

  function unlockFollowup(state, report) {
    const choice = report && report.villageChoice;
    if (!state || !choice || !APPROACHES[choice.approachId]) return null;
    const profile = APPROACHES[choice.approachId];
    if (!Array.isArray(state.destinations)) state.destinations = [];
    let destination = state.destinations.find((item) => item && item.id === choice.destinationId);
    if (!destination) {
      const source = state.destinations.find((item) => item && item.id === choice.sourceDestinationId) || {};
      destination = {
        id: choice.destinationId,
        name: profile.name,
        family: source.family || "village",
        dangerTags: [...profile.dangerTags],
        opportunityTags: [...profile.opportunityTags],
        durationMs: Math.max(60000, Math.round((Number(source.durationMs) || 240000) * 0.7)),
        villageLead: { sourceDestinationId: choice.sourceDestinationId, approachId: profile.id },
      };
      state.destinations.push(destination);
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(destination.id)) state.discoveredDestinationIds.push(destination.id);
    report.villageChoiceApplied = true;
    return destination;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    Object.assign(stored, clone(report));
  }

  function currentDestination(form) {
    const input = form && form.querySelector ? form.querySelector('input[name="destination"]:checked') : null;
    return input && input.value || "";
  }

  function choiceItem(document, profile, checked) {
    const label = document.createElement("label");
    label.className = "expedition-choice__item";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "village-approach";
    input.value = profile.id;
    input.checked = checked;
    input.addEventListener("change", () => { if (input.checked) setSelectedApproach(input.value); });
    const body = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = profile.title;
    const small = document.createElement("small");
    small.textContent = profile.copy;
    body.append(strong, small);
    label.append(input, body);
    return label;
  }

  function syncChoice(root) {
    const document = root && root.document;
    const form = document && document.querySelector ? document.querySelector("form.expedition-prepare") : null;
    if (!form) return false;
    const existing = form.querySelector("[data-expedition-village-choice]");
    if (currentDestination(form) !== DESTINATION_ID) {
      selectedApproach = QUIET;
      if (existing) existing.remove();
      return Boolean(existing);
    }
    if (existing) return false;

    selectedApproach = QUIET;
    const fieldset = document.createElement("fieldset");
    fieldset.className = "expedition-choice expedition-choice--village";
    fieldset.dataset.expeditionVillageChoice = "true";
    const legend = document.createElement("legend");
    legend.textContent = "空鐘の廃村でどう振る舞う？";
    fieldset.appendChild(legend);
    fieldset.appendChild(choiceItem(document, APPROACHES[QUIET], true));
    fieldset.appendChild(choiceItem(document, APPROACHES[RING], false));
    const destinationInput = form.querySelector('input[name="destination"]:checked');
    const destinationGroup = destinationInput && destinationInput.closest ? destinationInput.closest("fieldset") : null;
    if (destinationGroup && typeof destinationGroup.insertAdjacentElement === "function") destinationGroup.insertAdjacentElement("afterend", fieldset);
    else form.prepend(fieldset);
    return true;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__villageBellInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithVillageChoice(state, input, nowMs) {
      const requested = selectedApproach;
      const next = baseDispatch(state, input, nowMs);
      const inputs = next && next.activeExpedition && next.activeExpedition.inputs;
      if (inputs && inputs.destinationId === DESTINATION_ID) inputs.villageApproach = normalizeApproach(requested);
      selectedApproach = QUIET;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithVillageChoice(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithVillageChoice(state, report) {
      const applied = baseApplyReport(state, report);
      unlockFollowup(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithVillageChoice(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        unlockFollowup(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__villageBellInstalled = true;
    return true;
  }

  function installUi(root) {
    if (!root || !root.document) return false;
    const sync = () => syncChoice(root);
    sync();
    if (root.__villageBellUiInstalled) return true;
    if (typeof root.MutationObserver === "function" && root.document.body) {
      const observer = new root.MutationObserver(sync);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    if (typeof root.document.addEventListener === "function") {
      root.document.addEventListener("change", (event) => {
        if (event && event.target && event.target.name === "destination") sync();
      });
    }
    root.__villageBellUiInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const systemReady = installSystemHooks(root);
      const uiReady = installUi(root);
      if ((!systemReady || !uiReady) && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return {
    DESTINATION_ID,
    RING,
    QUIET,
    APPROACHES,
    setSelectedApproach,
    followupId,
    canResolve,
    decorateReport,
    unlockFollowup,
    syncStoredReport,
    currentDestination,
    syncChoice,
    installSystemHooks,
    installUi,
    install,
  };
});