(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionNightWatch = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionNightWatch() {
  "use strict";

  const FIELD_CAMP = "field-camp";
  const NONE = "none";
  const COMPANION_NAMES = Object.freeze({ mira: "ミラ", ed: "エド", sella: "セラ" });
  let selectedNightWatchId = NONE;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function setSelectedNightWatch(value) {
    selectedNightWatchId = Object.prototype.hasOwnProperty.call(COMPANION_NAMES, value) ? value : NONE;
    return selectedNightWatchId;
  }

  function getSelectedNightWatch() {
    return selectedNightWatchId;
  }

  function nightWatchProfile(companionId) {
    if (companionId === "mira") {
      return {
        companionId: "mira",
        companionName: "ミラ",
        suffix: "dew-trail",
        name: "ミラが見つけた夜露の獣道",
        dangerTags: ["beast", "thicket"],
        opportunityTags: ["herbs", "tracks", "night-watch"],
        reportText: "夜番のミラは、夜露が途切れる細い獣道に気づいた。薬草の匂いも混じる。夜明けに、次に追える道として皆へ伝えた。",
      };
    }
    if (companionId === "ed") {
      return {
        companionId: "ed",
        companionName: "エド",
        suffix: "work-road",
        name: "エドが見つけた崩れた作業道",
        dangerTags: ["collapse"],
        opportunityTags: ["salvage", "ore", "night-watch"],
        reportText: "夜番のエドは、暗がりに古い工具傷と運搬跡を見つけた。崩れかけているが、資材を運んだ作業道らしい。",
      };
    }
    if (companionId === "sella") {
      return {
        companionId: "sella",
        companionName: "セラ",
        suffix: "carrier-path",
        name: "セラが見つけた荷運びの裏道",
        dangerTags: ["bandit"],
        opportunityTags: ["rumor", "valuable", "night-watch"],
        reportText: "夜番のセラは、人目を避けて荷を運んだ新しい足跡を見つけた。表の道を外れた先に、誰かの出入りが続いている。",
      };
    }
    return null;
  }

  function followupId(sourceDestinationId, companionId) {
    const profile = nightWatchProfile(companionId);
    if (!profile || !sourceDestinationId) return null;
    return `night-watch:${profile.suffix}:${String(sourceDestinationId)}`;
  }

  function canResolveNightWatch(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && report.outcome === "success"
      && inputs
      && inputs.stayPlan === FIELD_CAMP
      && Array.isArray(inputs.companionIds)
      && inputs.companionIds.length === 2
      && inputs.companionIds.includes(inputs.nightWatchId)
      && nightWatchProfile(inputs.nightWatchId)
    );
  }

  function decorateReport(report, expedition) {
    if (!canResolveNightWatch(report, expedition)) return report;
    const inputs = expedition.inputs;
    const profile = nightWatchProfile(inputs.nightWatchId);
    const destinationId = followupId(inputs.destinationId, inputs.nightWatchId);
    if (!destinationId) return report;

    report.nightWatch = {
      companionId: profile.companionId,
      companionName: profile.companionName,
      sourceDestinationId: inputs.destinationId,
      destinationId,
    };
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === destinationId)) {
      report.discoveries.push({
        id: destinationId,
        name: profile.name,
        kind: "night-watch-followup",
        sourceDestinationId: inputs.destinationId,
        sourceCompanionId: profile.companionId,
      });
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "night-watch" && Array.isArray(entry.causes) && entry.causes.includes(destinationId))) {
      report.log.push({
        minute: 112,
        time: "",
        type: "night-watch",
        text: profile.reportText,
        causes: ["field-camp", "night-watch", profile.companionId, destinationId],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "night-watch" && Array.isArray(entry.causes) && entry.causes.includes(destinationId)) || report.notableEvent;
    return report;
  }

  function unlockNightWatchDestination(state, report) {
    const nightWatch = report && report.nightWatch;
    if (!state || !nightWatch) return null;
    const profile = nightWatchProfile(nightWatch.companionId);
    if (!profile) return null;
    if (!Array.isArray(state.destinations)) state.destinations = [];
    let destination = state.destinations.find((item) => item && item.id === nightWatch.destinationId);
    if (!destination) {
      const source = state.destinations.find((item) => item && item.id === nightWatch.sourceDestinationId) || {};
      destination = {
        id: nightWatch.destinationId,
        name: profile.name,
        family: source.family || "forest",
        dangerTags: [...profile.dangerTags],
        opportunityTags: [...profile.opportunityTags],
        durationMs: Math.max(60000, Math.round((Number(source.durationMs) || 180000) * 0.75)),
        nightWatchLead: {
          sourceDestinationId: nightWatch.sourceDestinationId,
          companionId: profile.companionId,
        },
      };
      state.destinations.push(destination);
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(destination.id)) state.discoveredDestinationIds.push(destination.id);
    report.nightWatchDiscoveryApplied = true;
    return destination;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    Object.assign(stored, clone(report));
  }

  function selectedCompanionIds(form) {
    if (!form || !form.querySelectorAll) return [];
    return Array.from(form.querySelectorAll('input[name="companion"]:checked'))
      .map((input) => input && input.value)
      .filter(Boolean)
      .slice(0, 2);
  }

  function selectedFieldCamp(form) {
    const input = form && form.querySelector ? form.querySelector('input[name="stay-plan"]:checked') : null;
    return Boolean(input && input.value === FIELD_CAMP);
  }

  function choiceItem(document, value, title, copy, checked) {
    const label = document.createElement("label");
    label.className = "expedition-choice__item";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "night-watch";
    input.value = value;
    input.checked = checked;
    input.addEventListener("change", () => {
      if (input.checked) setSelectedNightWatch(input.value);
    });
    const body = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const small = document.createElement("small");
    small.textContent = copy;
    body.append(strong, small);
    label.append(input, body);
    return label;
  }

  function syncNightWatchChoice(root) {
    const document = root && root.document;
    const form = document && document.querySelector ? document.querySelector("form.expedition-prepare") : null;
    if (!form) return false;
    const companions = selectedCompanionIds(form);
    const campSelected = selectedFieldCamp(form);
    const existing = form.querySelector("[data-expedition-night-watch]");
    if (!campSelected || companions.length !== 2) {
      setSelectedNightWatch(NONE);
      if (existing) existing.remove();
      return Boolean(existing);
    }

    const signature = companions.join("|");
    if (existing && existing.dataset.nightWatchParty === signature) return false;
    if (existing) existing.remove();
    setSelectedNightWatch(NONE);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "expedition-choice expedition-choice--night-watch";
    fieldset.dataset.expeditionNightWatch = "true";
    fieldset.dataset.nightWatchParty = signature;
    const legend = document.createElement("legend");
    legend.textContent = "野営の夜番";
    fieldset.appendChild(legend);
    fieldset.appendChild(choiceItem(document, NONE, "全員を休ませる", "夜の手掛かりは狙わず、二人とも休ませる", true));
    companions.forEach((id) => {
      const profile = nightWatchProfile(id);
      if (!profile) return;
      fieldset.appendChild(choiceItem(document, id, `${profile.companionName}に夜番を任せる`, `${profile.companionName}の目で夜の異変を探す。得られる手掛かりはこの一人分だけ`, false));
    });
    const campFocus = form.querySelector("[data-expedition-camp-focus]");
    if (campFocus && typeof campFocus.insertAdjacentElement === "function") campFocus.insertAdjacentElement("afterend", fieldset);
    else form.appendChild(fieldset);
    return true;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__nightWatchInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithNightWatch(state, input, nowMs) {
      const requestedWatch = selectedNightWatchId;
      const next = baseDispatch(state, input, nowMs);
      const inputs = next && next.activeExpedition && next.activeExpedition.inputs;
      if (inputs && inputs.stayPlan === FIELD_CAMP && Array.isArray(inputs.companionIds) && inputs.companionIds.length === 2 && inputs.companionIds.includes(requestedWatch)) {
        inputs.nightWatchId = requestedWatch;
      }
      selectedNightWatchId = NONE;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithNightWatch(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithNightWatch(state, report) {
      const applied = baseApplyReport(state, report);
      unlockNightWatchDestination(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithNightWatch(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        unlockNightWatchDestination(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__nightWatchInstalled = true;
    return true;
  }

  function installUi(root) {
    if (!root || !root.document) return false;
    const sync = () => syncNightWatchChoice(root);
    sync();
    if (root.__nightWatchUiInstalled) return true;
    if (typeof root.MutationObserver === "function" && root.document.body) {
      const observer = new root.MutationObserver(sync);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    if (typeof root.document.addEventListener === "function") {
      root.document.addEventListener("change", (event) => {
        const name = event && event.target && event.target.name;
        if (name === "companion" || name === "stay-plan") sync();
      });
    }
    root.__nightWatchUiInstalled = true;
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
    FIELD_CAMP,
    NONE,
    COMPANION_NAMES,
    setSelectedNightWatch,
    getSelectedNightWatch,
    nightWatchProfile,
    followupId,
    canResolveNightWatch,
    decorateReport,
    unlockNightWatchDestination,
    syncStoredReport,
    selectedCompanionIds,
    selectedFieldCamp,
    syncNightWatchChoice,
    installSystemHooks,
    installUi,
    install,
  };
});
