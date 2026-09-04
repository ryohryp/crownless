(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionLootAppraisal = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionLootAppraisal() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const MARKED_LOOT = Object.freeze({
    id: "bandit-notched-cleaver",
    name: "刻印のある盗賊の鉈",
    tags: Object.freeze(["clue-loot", "bandit-mark", "valuable"]),
  });

  const APPRAISALS = Object.freeze({
    marco: Object.freeze({
      npcId: "marco",
      npcName: "マルコ",
      title: "荷印として読んでもらう",
      description: "商人の目で刻印を読み、盗賊が荷を集める裏街道を探る。",
      destination: Object.freeze({
        id: "bandit-toll-backroad",
        name: "徴収印の残る裏街道",
        family: "road",
        dangerTags: Object.freeze(["bandit", "ambush"]),
        opportunityTags: Object.freeze(["route", "rumor", "trade"]),
        durationMs: 4 * 60 * 1000,
      }),
      reading: "マルコは刃元の刻印を荷の徴収印だと見抜いた。盗賊が獲物を集める裏街道があるらしい。",
    }),
    edgar: Object.freeze({
      npcId: "edgar",
      npcName: "エドガー",
      title: "研ぎ跡から読んでもらう",
      description: "武具職人の目で刃を読み、盗賊が武器を直す岩陰を探る。",
      destination: Object.freeze({
        id: "bandit-repair-shelter",
        name: "打ち直し跡のある岩陰",
        family: "ruin",
        dangerTags: Object.freeze(["bandit", "collapse"]),
        opportunityTags: Object.freeze(["salvage", "weapon", "trace"]),
        durationMs: 4 * 60 * 1000,
      }),
      reading: "エドガーは刃こぼれの直し方が同じだと気づいた。盗賊が武器を打ち直す岩陰が近くにある。",
    }),
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function destinationFor(state, expedition) {
    if (!state || !expedition || !expedition.inputs || !Array.isArray(state.destinations)) return null;
    return state.destinations.find((item) => item && item.id === expedition.inputs.destinationId) || null;
  }

  function isBanditDestination(destination) {
    return Boolean(destination && Array.isArray(destination.dangerTags) && destination.dangerTags.includes("bandit"));
  }

  function hasMarkedLoot(state) {
    return Boolean(state && Array.isArray(state.securedLoot)
      && state.securedLoot.some((item) => item && item.id === MARKED_LOOT.id));
  }

  function unappraisedMarkedLoot(state) {
    if (!state || !Array.isArray(state.securedLoot)) return null;
    return state.securedLoot.find((item) => item && item.id === MARKED_LOOT.id && !item.appraisedBy) || null;
  }

  function decorateMarkedLoot(report, expedition, state) {
    if (!report || !expedition || report.outcome !== "success" || hasMarkedLoot(state)) return report;
    const destination = destinationFor(state, expedition);
    if (!isBanditDestination(destination)) return report;

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === MARKED_LOOT.id)) {
      report.loot.push({
        id: MARKED_LOOT.id,
        name: MARKED_LOOT.name,
        tags: Array.from(MARKED_LOOT.tags),
        originDestinationId: destination.id,
        originName: destination.name,
      });
    }
    report.lootAppraisalLead = {
      lootId: MARKED_LOOT.id,
      originDestinationId: destination.id,
      status: "unappraised",
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "clue-loot" && entry.causes && entry.causes.includes(MARKED_LOOT.id))) {
      report.log.push({
        minute: 107,
        time: "",
        type: "clue-loot",
        text: `戦利品の中に《${MARKED_LOOT.name}》があった。刃元の刻印はただの傷ではなさそうだ。灰炉の誰かなら読めるかもしれない。`,
        causes: [MARKED_LOOT.id, "bandit", "loot-appraisal"],
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    return report;
  }

  function persistMarkedLoot(state, report) {
    if (!state || !report || !Array.isArray(report.loot)) return state;
    const loot = report.loot.find((item) => item && item.id === MARKED_LOOT.id);
    if (!loot) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    if (!state.securedLoot.some((item) => item && item.id === MARKED_LOOT.id)) {
      state.securedLoot.push({ ...loot, sourceExpeditionId: report.expeditionId });
    }
    return state;
  }

  function appraiseMarkedLoot(stateInput, npcId) {
    const appraisal = APPRAISALS[npcId];
    if (!stateInput || !appraisal) return stateInput;
    const state = clone(stateInput);
    const loot = unappraisedMarkedLoot(state);
    if (!loot) return stateInput;

    loot.appraisedBy = appraisal.npcId;
    loot.appraisedByName = appraisal.npcName;
    loot.appraisalText = appraisal.reading;
    loot.followupDestinationId = appraisal.destination.id;

    if (!Array.isArray(state.destinations)) state.destinations = [];
    if (!state.destinations.some((item) => item && item.id === appraisal.destination.id)) {
      state.destinations.push(clone(appraisal.destination));
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(appraisal.destination.id)) {
      state.discoveredDestinationIds.push(appraisal.destination.id);
    }
    state.lastLootAppraisal = {
      lootId: MARKED_LOOT.id,
      npcId: appraisal.npcId,
      npcName: appraisal.npcName,
      destinationId: appraisal.destination.id,
      text: appraisal.reading,
    };
    return state;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    Object.assign(stored, clone(report));
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system) return false;
    if (system.__lootAppraisalInstalled) return true;

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithLootAppraisal(expedition, state) {
      return decorateMarkedLoot(baseResolve(expedition, state), expedition, state);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithLootAppraisal(state, report) {
      const applied = baseApplyReport(state, report);
      persistMarkedLoot(applied, report);
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithLootAppraisal(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateMarkedLoot(advanced.report, expedition, state);
        persistMarkedLoot(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__lootAppraisalInstalled = true;
    return true;
  }

  function readState(root) {
    try {
      const raw = root && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeState(root, state) {
    try {
      if (!root || !root.localStorage) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  function createAppraisalGroup(doc, state) {
    if (!doc || !unappraisedMarkedLoot(state)) return null;
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-loot-appraisal-choice";
    group.dataset.lootAppraisalChoice = "true";

    const legend = doc.createElement("legend");
    legend.textContent = `《${MARKED_LOOT.name}》を誰に見せる？`;
    group.append(legend);

    const intro = doc.createElement("p");
    intro.textContent = "刻印の読み方で、追える手掛かりが変わる。今は見せずに温存してもいい。";
    group.append(intro);

    Object.values(APPRAISALS).forEach((appraisal) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "expedition-secondary";
      button.dataset.lootAppraise = appraisal.npcId;
      button.textContent = `${appraisal.npcName}に見せる — ${appraisal.title}`;
      button.title = appraisal.description;
      group.append(button);
    });
    return group;
  }

  function enhancePrepare(root) {
    const doc = root && root.document;
    const form = doc && doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form || form.querySelector("[data-loot-appraisal-choice]")) return false;
    const state = readState(root);
    const group = createAppraisalGroup(doc, state);
    if (!group) return false;

    const firstActions = form.querySelector(".expedition-actions");
    if (firstActions) firstActions.insertAdjacentElement("beforebegin", group);
    else form.append(group);

    group.addEventListener("click", (event) => {
      const button = event.target && event.target.closest && event.target.closest("[data-loot-appraise]");
      if (!button) return;
      const current = readState(root);
      const next = appraiseMarkedLoot(current, button.dataset.lootAppraise);
      if (next === current || !writeState(root, next)) return;
      if (root.location && typeof root.location.reload === "function") root.location.reload();
    });
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const hooked = installSystemHooks(root);
      enhancePrepare(root);
      if (!hooked && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    if (root.MutationObserver && root.document && root.document.body) {
      const observer = new root.MutationObserver(() => enhancePrepare(root));
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    return true;
  }

  return {
    STORAGE_KEY,
    MARKED_LOOT,
    APPRAISALS,
    destinationFor,
    isBanditDestination,
    hasMarkedLoot,
    unappraisedMarkedLoot,
    decorateMarkedLoot,
    persistMarkedLoot,
    appraiseMarkedLoot,
    createAppraisalGroup,
    enhancePrepare,
    installSystemHooks,
    install,
  };
});
