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
  const CAMP_FOCUS_TRACE = "trace";
  const CAMP_FOCUS_TREAT = "treat";
  let selectedStay = NORMAL_STAY;
  let selectedCampFocus = CAMP_FOCUS_TRACE;

  function normalizeStay(value) {
    return value === FIELD_CAMP ? FIELD_CAMP : NORMAL_STAY;
  }

  function normalizeCampFocus(value) {
    return value === CAMP_FOCUS_TREAT ? CAMP_FOCUS_TREAT : CAMP_FOCUS_TRACE;
  }

  function setSelectedStay(value) {
    selectedStay = normalizeStay(value);
    return selectedStay;
  }

  function getSelectedStay() {
    return selectedStay;
  }

  function setSelectedCampFocus(value) {
    selectedCampFocus = normalizeCampFocus(value);
    return selectedCampFocus;
  }

  function getSelectedCampFocus() {
    return selectedCampFocus;
  }

  function dispatchInputForStay(state, input, stayValue, campFocusValue) {
    const inputCopy = { ...(input || {}) };
    const stayPlan = normalizeStay(stayValue);
    const campFocus = normalizeCampFocus(campFocusValue);
    if (stayPlan !== FIELD_CAMP || Number.isFinite(inputCopy.durationMs)) return { input: inputCopy, stayPlan, campFocus };
    const destination = state && Array.isArray(state.destinations)
      ? state.destinations.find((item) => item && item.id === inputCopy.destinationId)
      : null;
    if (destination && Number.isFinite(destination.durationMs)) {
      inputCopy.durationMs = Math.max(0, Math.round(destination.durationMs * CAMP_DURATION_RATIO));
    }
    return { input: inputCopy, stayPlan, campFocus };
  }

  function isFieldCamp(expedition) {
    return Boolean(expedition && expedition.inputs && expedition.inputs.stayPlan === FIELD_CAMP);
  }

  function campFocusFor(expedition) {
    return normalizeCampFocus(expedition && expedition.inputs && expedition.inputs.campFocus);
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

  function treatOneInjury(report) {
    if (!report || !["success", "early-return"].includes(report.outcome)) return null;
    if (Array.isArray(report.campTreatedIds) && report.campTreatedIds.length) return report.campTreatedIds[0] || null;
    if (!Array.isArray(report.injuries) || !report.injuries.length) return null;
    const treatedId = report.injuries[0];
    report.injuries = report.injuries.filter((id, index) => index !== 0 || id !== treatedId);
    report.campTreatedIds = [treatedId];
    return treatedId;
  }

  function decorateReport(report, expedition) {
    if (!report || !isFieldCamp(expedition)) return report;
    const focus = campFocusFor(expedition);
    report.stayPlan = FIELD_CAMP;
    report.campFocus = focus;

    if (focus === CAMP_FOCUS_TREAT) {
      const treatedId = treatOneInjury(report);
      if (!Array.isArray(report.log)) report.log = [];
      if (!report.log.some((entry) => entry && entry.type === "field-camp-treatment")) {
        const text = treatedId
          ? "野営中は奥の痕跡を追わず、負傷者の手当てを優先した。帰路につく前に一人の傷を落ち着かせた。"
          : "野営中は奥の痕跡を追わず、休養と手当てを優先した。新しい痕跡は得なかった。";
        report.log.push({
          minute: 108,
          time: "",
          type: "field-camp-treatment",
          text,
          causes: treatedId ? ["field-camp", "treatment", "injury-stabilized", treatedId] : ["field-camp", "treatment", "rest"],
        });
        report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
      }
      return report;
    }

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
      const prepared = dispatchInputForStay(state, input, selectedStay, selectedCampFocus);
      const next = baseDispatch(state, prepared.input, nowMs);
      if (next && next.activeExpedition && next.activeExpedition.inputs) {
        next.activeExpedition.inputs.stayPlan = prepared.stayPlan;
        next.activeExpedition.inputs.campFocus = prepared.campFocus;
      }
      selectedStay = NORMAL_STAY;
      selectedCampFocus = CAMP_FOCUS_TRACE;
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithFieldCamp(expedition, state) {
      return decorateReport(baseResolve(expedition, state), expedition);
    };

    system.__fieldCampInstalled = true;
    return true;
  }

  function choiceItem(document, name, value, title, copy, checked, onChange) {
    const label = document.createElement("label");
    label.className = "expedition-choice__item";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = value;
    input.checked = checked;
    input.addEventListener("change", () => {
      if (input.checked) onChange(input.value);
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

  function injectStayChoice(root) {
    const document = root && root.document;
    if (!document) return false;
    const form = document.querySelector("form.expedition-prepare");
    if (!form) return false;

    let stayFieldset = form.querySelector("[data-expedition-stay-plan]");
    if (!stayFieldset) {
      selectedStay = NORMAL_STAY;
      stayFieldset = document.createElement("fieldset");
      stayFieldset.className = "expedition-choice expedition-choice--stay";
      stayFieldset.dataset.expeditionStayPlan = "true";
      const legend = document.createElement("legend");
      legend.textContent = "現地での過ごし方";
      stayFieldset.appendChild(legend);
      stayFieldset.appendChild(choiceItem(document, "stay-plan", NORMAL_STAY, "通常滞在", "予定どおり探索して帰還する", true, setSelectedStay));
      stayFieldset.appendChild(choiceItem(document, "stay-plan", FIELD_CAMP, "現地で野営", "帰還は約1.5倍遅くなるが、野営中の優先事項を選べる", false, setSelectedStay));

      const pace = form.querySelector("[data-expedition-march-pace]");
      if (pace) pace.insertAdjacentElement("afterend", stayFieldset);
      else form.appendChild(stayFieldset);
    }

    if (!form.querySelector("[data-expedition-camp-focus]")) {
      selectedCampFocus = CAMP_FOCUS_TRACE;
      const focusFieldset = document.createElement("fieldset");
      focusFieldset.className = "expedition-choice expedition-choice--camp-focus";
      focusFieldset.dataset.expeditionCampFocus = "true";
      const legend = document.createElement("legend");
      legend.textContent = "野営中の優先";
      focusFieldset.appendChild(legend);
      focusFieldset.appendChild(choiceItem(document, "camp-focus", CAMP_FOCUS_TRACE, "痕跡を追う", "探索成功時、さらに奥へ続く手掛かりを狙う", true, setSelectedCampFocus));
      focusFieldset.appendChild(choiceItem(document, "camp-focus", CAMP_FOCUS_TREAT, "傷を手当てする", "追加の手掛かりを諦め、帰還前に負傷者1人の安定化を試みる", false, setSelectedCampFocus));
      stayFieldset.insertAdjacentElement("afterend", focusFieldset);
    }
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
    CAMP_FOCUS_TRACE,
    CAMP_FOCUS_TREAT,
    normalizeStay,
    normalizeCampFocus,
    setSelectedStay,
    getSelectedStay,
    setSelectedCampFocus,
    getSelectedCampFocus,
    dispatchInputForStay,
    isFieldCamp,
    campFocusFor,
    campDiscovery,
    treatOneInjury,
    decorateReport,
    installSystemHooks,
    injectStayChoice,
    installUi,
    install,
  };
});