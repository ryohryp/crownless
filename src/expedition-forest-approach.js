(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionForestApproach = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionForestApproach() {
  "use strict";

  const DESTINATION_ID = "ashen-wood";
  const FOLLOW_HOWL = "follow-howl";
  const MARK_TRAIL = "mark-game-trail";
  const APPROACHES = Object.freeze({
    [FOLLOW_HOWL]: Object.freeze({
      id: FOLLOW_HOWL,
      title: "遠吠えを追う",
      copy: "獣の声が重なる奥へ踏み込む。次の探索は危険になるが、群れの動きと巣穴へつながる手掛かりを狙う。",
      suffix: "howling-ravine",
      name: "遠吠えが集まる谷筋",
      dangerTags: ["beast", "thicket", "pack"],
      opportunityTags: ["tracks", "lair", "trophy"],
      durationFactor: 1.15,
      reportText: "遠吠えが途切れるたびに足跡を拾って奥へ進んだ。谷筋には複数の獣が行き交う跡が重なり、さらに深い巣へ続く気配が残っている。",
    }),
    [MARK_TRAIL]: Object.freeze({
      id: MARK_TRAIL,
      title: "獣道を記録する",
      copy: "獣を追い立てず、踏み固められた細道へ印を残す。次は短い時間で薬草や新しい足跡を拾いやすくする。",
      suffix: "marked-game-trail",
      name: "印を残した獣道",
      dangerTags: ["thicket"],
      opportunityTags: ["herbs", "tracks", "passage"],
      durationFactor: 0.7,
      reportText: "遠吠えから距離を取り、踏み固められた獣道の分岐へ小さな布印を残した。次は森を深追いせず、短い巡回で薬草と新しい足跡を拾えそうだ。",
    }),
  });
  let selectedApproach = null;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeApproach(value) {
    return Object.prototype.hasOwnProperty.call(APPROACHES, value) ? value : null;
  }

  function setSelectedApproach(value) {
    selectedApproach = normalizeApproach(value);
    return selectedApproach;
  }

  function followupId(sourceDestinationId, approachId) {
    const profile = APPROACHES[approachId];
    return profile && sourceDestinationId ? `forest-approach:${profile.suffix}:${sourceDestinationId}` : null;
  }

  function canResolve(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && report.outcome === "success"
      && inputs
      && inputs.destinationId === DESTINATION_ID
      && APPROACHES[inputs.forestApproach]
    );
  }

  function decorateReport(report, expedition) {
    if (!canResolve(report, expedition)) return report;
    const inputs = expedition.inputs;
    const profile = APPROACHES[inputs.forestApproach];
    const destinationId = followupId(inputs.destinationId, profile.id);
    if (!destinationId) return report;

    report.forestApproach = {
      approachId: profile.id,
      sourceDestinationId: inputs.destinationId,
      destinationId,
    };
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === destinationId)) {
      report.discoveries.push({
        id: destinationId,
        name: profile.name,
        kind: "forest-approach-followup",
        sourceDestinationId: inputs.destinationId,
        approachId: profile.id,
      });
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "forest-approach" && Array.isArray(entry.causes) && entry.causes.includes(destinationId))) {
      report.log.push({
        minute: 74,
        time: "",
        type: "forest-approach",
        text: profile.reportText,
        causes: [DESTINATION_ID, `forest-approach:${profile.id}`, destinationId],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "forest-approach" && Array.isArray(entry.causes) && entry.causes.includes(destinationId)) || report.notableEvent;
    return report;
  }

  function unlockFollowup(state, report) {
    const choice = report && report.forestApproach;
    if (!state || !choice || !APPROACHES[choice.approachId]) return null;
    const profile = APPROACHES[choice.approachId];
    if (!Array.isArray(state.destinations)) state.destinations = [];
    let destination = state.destinations.find((item) => item && item.id === choice.destinationId);
    if (!destination) {
      const source = state.destinations.find((item) => item && item.id === choice.sourceDestinationId) || {};
      destination = {
        id: choice.destinationId,
        name: profile.name,
        family: source.family || "forest",
        dangerTags: [...profile.dangerTags],
        opportunityTags: [...profile.opportunityTags],
        durationMs: Math.max(60000, Math.round((Number(source.durationMs) || 300000) * profile.durationFactor)),
        forestLead: { sourceDestinationId: choice.sourceDestinationId, approachId: profile.id },
      };
      state.destinations.push(destination);
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(destination.id)) state.discoveredDestinationIds.push(destination.id);
    report.forestApproachApplied = true;
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

  function choiceItem(document, profile) {
    const label = document.createElement("label");
    label.className = "expedition-choice__item";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "forest-approach";
    input.value = profile.id;
    input.required = true;
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
    const existing = form.querySelector("[data-expedition-forest-choice]");
    if (currentDestination(form) !== DESTINATION_ID) {
      selectedApproach = null;
      if (existing) existing.remove();
      return Boolean(existing);
    }
    if (existing) return false;

    selectedApproach = null;
    const fieldset = document.createElement("fieldset");
    fieldset.className = "expedition-choice expedition-choice--forest";
    fieldset.dataset.expeditionForestChoice = "true";
    const legend = document.createElement("legend");
    legend.textContent = "灰の森で何を優先する？";
    fieldset.appendChild(legend);
    fieldset.appendChild(choiceItem(document, APPROACHES[FOLLOW_HOWL]));
    fieldset.appendChild(choiceItem(document, APPROACHES[MARK_TRAIL]));
    const destinationInput = form.querySelector('input[name="destination"]:checked');
    const destinationGroup = destinationInput && destinationInput.closest ? destinationInput.closest("fieldset") : null;
    if (destinationGroup && typeof destinationGroup.insertAdjacentElement === "function") destinationGroup.insertAdjacentElement("afterend", fieldset);
    else form.prepend(fieldset);
    return true;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__forestApproachInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithForestApproach(state, input, nowMs) {
      const requested = selectedApproach;
      const next = baseDispatch(state, input, nowMs);
      const inputs = next && next.activeExpedition && next.activeExpedition.inputs;
      if (inputs && inputs.destinationId === DESTINATION_ID && APPROACHES[requested]) inputs.forestApproach = requested;
      selectedApproach = null;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithForestApproach(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithForestApproach(state, report) {
      const applied = baseApplyReport(state, report);
      unlockFollowup(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithForestApproach(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        unlockFollowup(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__forestApproachInstalled = true;
    return true;
  }

  function installUi(root) {
    if (!root || !root.document) return false;
    const sync = () => syncChoice(root);
    sync();
    if (root.__forestApproachUiInstalled) return true;
    if (typeof root.MutationObserver === "function" && root.document.body) {
      const observer = new root.MutationObserver(sync);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    if (typeof root.document.addEventListener === "function") {
      root.document.addEventListener("change", (event) => {
        if (event && event.target && event.target.name === "destination") sync();
      });
    }
    root.__forestApproachUiInstalled = true;
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
    FOLLOW_HOWL,
    MARK_TRAIL,
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