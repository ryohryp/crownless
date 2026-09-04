(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionBanditCaptive = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createBanditCaptive() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const CAPTIVE_ID = "bandit-captured-scout";
  const INTERROGATE_DESTINATION = Object.freeze({
    id: "bandit-scout-supply-route",
    name: "斥候が吐いた補給路",
    family: "road",
    dangerTags: Object.freeze(["bandit", "ambush", "alerted"]),
    opportunityTags: Object.freeze(["supplies", "intel", "high-risk"]),
    durationMs: 5 * 60 * 1000,
  });
  const RELEASE_DESTINATION = Object.freeze({
    id: "bandit-scout-mercy-path",
    name: "斥候が残した見逃し道",
    family: "forest",
    dangerTags: Object.freeze(["bandit", "thin-watch"]),
    opportunityTags: Object.freeze(["route", "safe-passage", "intel"]),
    durationMs: 4 * 60 * 1000,
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function isBanditSuccess(report) {
    return Boolean(report && report.outcome === "success" && report.signalEncounter && report.signalEncounter.kind === "bandit-ambush");
  }

  function canCapture(state, report) {
    return Boolean(state && isBanditSuccess(report) && !state.banditCaptive && !state.banditCaptiveHistory);
  }

  function captureScout(state, report) {
    if (!canCapture(state, report)) return state;
    state.banditCaptive = {
      id: CAPTIVE_ID,
      status: "unresolved",
      sourceExpeditionId: report.expeditionId || "",
      sourceDestinationId: report.destinationId || "",
    };
    state.banditCaptiveHistory = { captured: true, sourceExpeditionId: report.expeditionId || "" };
    report.banditCaptive = clone(state.banditCaptive);
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "captive" && Array.isArray(entry.causes) && entry.causes.includes(CAPTIVE_ID))) {
      report.log.push({
        minute: 108,
        time: "",
        type: "captive",
        text: "盗賊を退けたあと、逃げ遅れた斥候を一人捕えた。灰炉へ戻れば、尋問してから解放するか、すぐ解放するか決められる。",
        causes: [CAPTIVE_ID, "bandit", "adapt-choice"],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    return state;
  }

  function ensureDestination(state, definition) {
    if (!Array.isArray(state.destinations)) state.destinations = [];
    if (!state.destinations.some((item) => item && item.id === definition.id)) state.destinations.push(clone(definition));
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(definition.id)) state.discoveredDestinationIds.push(definition.id);
  }

  function resolveCaptive(stateInput, choice) {
    if (!stateInput || !stateInput.banditCaptive || stateInput.banditCaptive.status !== "unresolved") return stateInput;
    if (choice !== "interrogate" && choice !== "release") return stateInput;
    const state = clone(stateInput);
    const definition = choice === "interrogate" ? INTERROGATE_DESTINATION : RELEASE_DESTINATION;
    ensureDestination(state, definition);
    state.banditCaptive.status = "resolved";
    state.banditCaptive.choice = choice;
    state.banditCaptive.destinationId = definition.id;
    state.lastBanditCaptiveDecision = {
      choice,
      destinationId: definition.id,
      text: choice === "interrogate"
        ? "斥候から補給路を聞き出してから解放した。危険だが、盗賊の物資へ先回りできる。"
        : "斥候をすぐ解放した。彼は追手の薄い見逃し道を残して去った。",
    };
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (stored && stored !== report) Object.assign(stored, clone(report));
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system) return false;
    if (system.__banditCaptiveInstalled) return true;
    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithBanditCaptive(state, report) {
      const applied = baseApplyReport(state, report);
      captureScout(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };
    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithBanditCaptive(state, nowMs) {
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report) {
        captureScout(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };
    system.__banditCaptiveInstalled = true;
    return true;
  }

  function readState(root) {
    try {
      const raw = root && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function writeState(root, state) {
    try {
      if (!root || !root.localStorage) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) { return false; }
  }

  function createChoiceGroup(doc, state) {
    if (!doc || !state || !state.banditCaptive || state.banditCaptive.status !== "unresolved") return null;
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-bandit-captive-choice";
    group.dataset.banditCaptiveChoice = "true";
    const legend = doc.createElement("legend");
    legend.textContent = "捕えた盗賊斥候をどうする？";
    const intro = doc.createElement("p");
    intro.textContent = "どちらを選ぶかで、次に追える道が変わる。今は決めずに温存してもいい。";
    group.append(legend, intro);
    const choices = [
      ["interrogate", "尋問してから解放", "危険な補給路を聞き出す"],
      ["release", "すぐ解放", "敵意を抑え、見張りの薄い道を残してもらう"],
    ];
    choices.forEach(([id, title, detail]) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "expedition-secondary";
      button.dataset.banditCaptive = id;
      button.textContent = `${title} — ${detail}`;
      group.append(button);
    });
    return group;
  }

  function enhancePrepare(root) {
    const doc = root && root.document;
    const form = doc && doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form || form.querySelector("[data-bandit-captive-choice]")) return false;
    const group = createChoiceGroup(doc, readState(root));
    if (!group) return false;
    const actions = form.querySelector(".expedition-actions");
    if (actions) actions.insertAdjacentElement("beforebegin", group); else form.append(group);
    group.addEventListener("click", (event) => {
      const button = event.target && event.target.closest && event.target.closest("[data-bandit-captive]");
      if (!button) return;
      const current = readState(root);
      const next = resolveCaptive(current, button.dataset.banditCaptive);
      if (next === current || !writeState(root, next)) return;
      if (root.location && typeof root.location.reload === "function") root.location.reload();
    });
    return true;
  }

  function install(root) {
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const hooked = installSystemHooks(root);
      enhancePrepare(root);
      if (!hooked && root && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    if (root && root.MutationObserver && root.document && root.document.body) {
      const observer = new root.MutationObserver(() => enhancePrepare(root));
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    return true;
  }

  return {
    STORAGE_KEY,
    CAPTIVE_ID,
    INTERROGATE_DESTINATION,
    RELEASE_DESTINATION,
    isBanditSuccess,
    canCapture,
    captureScout,
    resolveCaptive,
    createChoiceGroup,
    installSystemHooks,
    install,
  };
});
