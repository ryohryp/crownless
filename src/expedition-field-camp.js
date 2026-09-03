(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionFieldCamp = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionFieldCamp() {
  "use strict";

  const NORMAL_STAY = "normal";
  const FIELD_CAMP = "field-camp";
  const CAMP_DURATION_RATIO = 1.5;
  let selectedStay = NORMAL_STAY;

  function normalizeStay(value) {
    return value === FIELD_CAMP ? FIELD_CAMP : NORMAL_STAY;
  }

  function setSelectedStay(value) {
    selectedStay = normalizeStay(value);
    return selectedStay;
  }

  function getSelectedStay() {
    return selectedStay;
  }

  function dispatchInputForStay(state, input, stayValue) {
    const inputCopy = { ...(input || {}) };
    const stayPlan = normalizeStay(stayValue);
    if (stayPlan !== FIELD_CAMP || Number.isFinite(inputCopy.durationMs)) return { input: inputCopy, stayPlan };
    const destination = state && Array.isArray(state.destinations)
      ? state.destinations.find((item) => item && item.id === inputCopy.destinationId)
      : null;
    if (destination && Number.isFinite(destination.durationMs)) {
      inputCopy.durationMs = Math.max(0, Math.round(destination.durationMs * CAMP_DURATION_RATIO));
    }
    return { input: inputCopy, stayPlan };
  }

  function isFieldCamp(expedition) {
    return Boolean(expedition && expedition.inputs && expedition.inputs.stayPlan === FIELD_CAMP);
  }

  function campDiscovery(expedition) {
    const destinationId = expedition && expedition.inputs && expedition.inputs.destinationId;
    if (!destinationId) return null;
    return {
      id: `camp-observation:${destinationId}:${expedition.id || "expedition"}`,
      name: "野営中に見つけた、さらに奥へ続く痕跡",
      sourceDestinationId: destinationId,
      kind: "camp-observation",
    };
  }

  function decorateReport(report, expedition) {
    if (!report || !isFieldCamp(expedition)) return report;
    report.stayPlan = FIELD_CAMP;
    const objective = expedition && expedition.inputs && expedition.inputs.objective;
    if (report.outcome !== "success" || objective !== "explore") return report;

    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    const discovery = campDiscovery(expedition);
    if (discovery && !report.discoveries.some((item) => item && item.id === discovery.id)) {
      report.discoveries.push(discovery);
    }

    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "field-camp-observation")) {
      report.log.push({
        minute: 108,
        time: "",
        type: "field-camp-observation",
        text: "帰還を急がず現地で野営した。夜明け前、さらに奥へ続く痕跡を見つけた。",
        causes: ["field-camp", "longer-wait", "extra-clue"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__fieldCampInstalled) return Boolean(system);

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithStayPlan(state, input, nowMs) {
      const prepared = dispatchInputForStay(state, input, selectedStay);
      const next = baseDispatch(state, prepared.input, nowMs);
      if (next && next.activeExpedition && next.activeExpedition.inputs) next.activeExpedition.inputs.stayPlan = prepared.stayPlan;
      selectedStay = NORMAL_STAY;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithFieldCamp(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    system.__fieldCampInstalled = true;
    return true;
  }

  function injectStayChoice(root) {
    const document = root && root.document;
    if (!document) return false;
    const form = document.querySelector("form.expedition-prepare");
    if (!form || form.querySelector("[data-expedition-stay-plan]")) return Boolean(form);

    selectedStay = NORMAL_STAY;
    const fieldset = document.createElement("fieldset");
    fieldset.className = "expedition-choice expedition-choice--stay";
    fieldset.dataset.expeditionStayPlan = "true";
    const legend = document.createElement("legend");
    legend.textContent = "現地での過ごし方";
    fieldset.appendChild(legend);

    [
      { id: NORMAL_STAY, name: "通常滞在", copy: "予定どおり探索して帰還する" },
      { id: FIELD_CAMP, name: "現地で野営", copy: "帰還は約1.5倍遅くなるが、探索成功時に追加の手掛かりを狙う" },
    ].forEach((choice) => {
      const label = document.createElement("label");
      label.className = "expedition-choice__item";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "stay-plan";
      input.value = choice.id;
      input.checked = choice.id === NORMAL_STAY;
      input.addEventListener("change", () => {
        if (input.checked) setSelectedStay(input.value);
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

    const pace = form.querySelector("[data-expedition-march-pace]");
    if (pace) pace.insertAdjacentElement("afterend", fieldset);
    else form.appendChild(fieldset);
    return true;
  }

  function installUi(root) {
    if (!root || !root.document) return false;
    injectStayChoice(root);
    if (root.__fieldCampUiObserverInstalled) return true;
    const Observer = root.MutationObserver;
    if (typeof Observer !== "function") return true;
    const observer = new Observer(() => injectStayChoice(root));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.__fieldCampUiObserverInstalled = true;
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
    NORMAL_STAY,
    FIELD_CAMP,
    CAMP_DURATION_RATIO,
    normalizeStay,
    setSelectedStay,
    getSelectedStay,
    dispatchInputForStay,
    isFieldCamp,
    campDiscovery,
    decorateReport,
    installSystemHooks,
    injectStayChoice,
    installUi,
    install,
  };
});