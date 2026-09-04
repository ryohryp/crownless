(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionRescueSalvage = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionRescueSalvage() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const RESCUE_SALVAGE_ID = "rescue-greedy-salvage";
  const RESCUE_SALVAGE_LOOT_ID = "missing-companion-pack";
  const RESCUE_SALVAGE_LOOT_NAME = "失踪者の置き荷";
  const RESCUE_FAVOR_ID = "rescued-companion-favor";

  function readState(root) {
    try {
      const raw = root && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function qualifies(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && inputs.rescueTargetId
      && inputs.policyId === "greedy"
      && report.outcome === "success"
      && report.rescueResolved === true
    );
  }

  function decorateReport(report, expedition) {
    if (!report || !expedition || !expedition.inputs || !expedition.inputs.rescueTargetId) return report;
    report.rescueSalvaged = qualifies(report, expedition);
    if (!report.rescueSalvaged) return report;

    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === RESCUE_SALVAGE_LOOT_ID)) {
      report.loot.push({ id: RESCUE_SALVAGE_LOOT_ID, name: RESCUE_SALVAGE_LOOT_NAME, count: 1 });
    }

    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((item) => item && item.type === "rescue-salvage" && Array.isArray(item.causes) && item.causes.includes(RESCUE_SALVAGE_ID));
    if (!entry) {
      const rescueEntry = report.log.find((item) => item && item.type === "rescue");
      entry = {
        minute: Number.isFinite(rescueEntry && rescueEntry.minute) ? rescueEntry.minute + 2 : 108,
        time: rescueEntry && rescueEntry.time || "",
        type: "rescue-salvage",
        text: "仲間を見つけたあとも失踪地点を探り、置き去りになっていた荷を回収した。危険な滞在を延ばしたぶん、持ち帰る物が増えた。",
        causes: [RESCUE_SALVAGE_ID, RESCUE_SALVAGE_LOOT_ID, "greedy"],
      };
      report.log.push(entry);
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    report.notableEvent = entry;
    return report;
  }

  function applyState(state, report) {
    if (!state || !report || report.rescueSalvaged !== true || !report.expeditionId) return state;
    if (!Array.isArray(state.securedLoot)) state.securedLoot = [];
    const exists = state.securedLoot.some((item) => item && item.sourceExpeditionId === report.expeditionId && item.id === RESCUE_SALVAGE_LOOT_ID);
    if (!exists) {
      state.securedLoot.push({ id: RESCUE_SALVAGE_LOOT_ID, name: RESCUE_SALVAGE_LOOT_NAME, count: 1, sourceExpeditionId: report.expeditionId });
    }
    return state;
  }

  function grantRescueFavor(state, report) {
    if (!state || !report || report.rescueResolved !== true || !report.rescueCompanionId || !Array.isArray(state.companions)) return state;
    const companion = state.companions.find((item) => item && item.id === report.rescueCompanionId);
    if (!companion) return state;
    if (!companion.rescueFavor || companion.rescueFavor.available !== true) {
      companion.rescueFavor = {
        id: `${RESCUE_FAVOR_ID}:${companion.id}:${report.expeditionId || "rescue"}`,
        available: true,
        sourceReportId: report.expeditionId || "",
        sourceDestinationId: report.destinationId || "",
        sourceDestinationName: report.destinationName || "救助地点"
      };
    }
    return state;
  }

  function favorRouteId(companionId, sourceReportId) {
    return `rescue-favor-route:${companionId}:${sourceReportId || "rescue"}`;
  }

  function qualifiesForFavorUse(report, expedition, state) {
    const inputs = expedition && expedition.inputs;
    const companionId = inputs && inputs.rescueFavorCompanionId;
    if (!report || !inputs || !companionId || report.outcome !== "success") return false;
    if (!Array.isArray(inputs.companionIds) || !inputs.companionIds.includes(companionId)) return false;
    const companion = state && Array.isArray(state.companions) ? state.companions.find((item) => item && item.id === companionId) : null;
    return Boolean(companion && companion.rescueFavor && companion.rescueFavor.available === true);
  }

  function decorateFavorReport(report, expedition, state) {
    if (!qualifiesForFavorUse(report, expedition, state)) return report;
    const companionId = expedition.inputs.rescueFavorCompanionId;
    const companion = state.companions.find((item) => item && item.id === companionId);
    const favor = companion.rescueFavor;
    const routeId = favorRouteId(companionId, favor.sourceReportId);
    const routeName = `${companion.name || companionId}が教えた帰り道`;
    report.rescueFavorUsed = {
      id: favor.id,
      companionId,
      companionName: companion.name || companionId,
      routeId,
      routeName,
      sourceReportId: favor.sourceReportId || ""
    };
    if (!Array.isArray(report.discoveries)) report.discoveries = [];
    if (!report.discoveries.some((item) => item && item.id === routeId)) {
      report.discoveries.push({ id: routeId, name: routeName, kind: "route", sourceDestinationId: report.destinationId });
    }
    if (!Array.isArray(report.log)) report.log = [];
    let entry = report.log.find((item) => item && item.type === "rescue-favor" && Array.isArray(item.causes) && item.causes.includes(favor.id));
    if (!entry) {
      const nearby = report.log.at(-1);
      entry = {
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 109,
        time: nearby && nearby.time || "",
        type: "rescue-favor",
        text: `${companion.name || "救助した仲間"}が「あの時の借りだ」と地形を読み、危険を避けて戻れる道を教えた。《${routeName}》を次の遠征先として使える。`,
        causes: [favor.id, routeId, companionId]
      };
      report.log.push(entry);
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    report.notableEvent = entry;
    return report;
  }

  function applyFavorState(state, report) {
    const used = report && report.rescueFavorUsed;
    if (!state || !used || !used.companionId) return state;
    const companion = Array.isArray(state.companions) ? state.companions.find((item) => item && item.id === used.companionId) : null;
    if (companion && companion.rescueFavor && companion.rescueFavor.id === used.id) {
      companion.rescueFavor.available = false;
      companion.rescueFavor.usedByExpeditionId = report.expeditionId || "";
    }
    if (!Array.isArray(state.destinations)) state.destinations = [];
    if (!state.destinations.some((item) => item && item.id === used.routeId)) {
      const source = state.destinations.find((item) => item && item.id === report.destinationId) || {};
      state.destinations.push({
        id: used.routeId,
        name: used.routeName,
        family: source.family || "forest",
        dangerTags: ["known-route"],
        opportunityTags: ["route", "safe-return"],
        durationMs: Math.max(0, Number(source.durationMs) || 180000),
        sourceDestinationId: report.destinationId || ""
      });
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(used.routeId)) state.discoveredDestinationIds.push(used.routeId);
    return state;
  }

  function availableFavors(state) {
    return state && Array.isArray(state.companions)
      ? state.companions.filter((item) => item && item.rescueFavor && item.rescueFavor.available === true)
      : [];
  }

  function selectedFavorCompanion(doc) {
    const selected = doc && doc.querySelector('input[name="rescueFavor"]:checked');
    return selected && selected.value ? selected.value : null;
  }

  function createFavorGroup(doc, companions) {
    if (!doc || !companions.length) return null;
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-rescue-favor-choice";
    group.dataset.rescueFavorChoice = "true";
    const legend = doc.createElement("legend");
    legend.textContent = "救助の恩";
    group.append(legend);

    const keepLabel = doc.createElement("label");
    keepLabel.className = "expedition-choice__item";
    const keep = doc.createElement("input");
    keep.type = "radio";
    keep.name = "rescueFavor";
    keep.value = "";
    keep.checked = true;
    const keepBody = doc.createElement("span");
    const keepStrong = doc.createElement("strong");
    keepStrong.textContent = "恩は温存する";
    const keepSmall = doc.createElement("small");
    keepSmall.textContent = "必要な遠征まで、借りを返してもらわない";
    keepBody.append(keepStrong, keepSmall);
    keepLabel.append(keep, keepBody);
    group.append(keepLabel);

    companions.forEach((companion) => {
      const label = doc.createElement("label");
      label.className = "expedition-choice__item";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "rescueFavor";
      input.value = companion.id;
      const body = doc.createElement("span");
      const strong = doc.createElement("strong");
      strong.textContent = `${companion.name || companion.id}の恩を頼む`;
      const small = doc.createElement("small");
      small.textContent = "本人を編成して生還すれば、その経験から新しい安全路を1本見つける";
      body.append(strong, small);
      label.append(input, body);
      group.append(label);
    });
    return group;
  }

  function enhancePrepare(root) {
    const doc = root && root.document;
    const form = doc && doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form || form.querySelector("[data-rescue-favor-choice]")) return false;
    const companions = availableFavors(readState(root));
    const group = createFavorGroup(doc, companions);
    if (!group) return false;
    const companionGroup = Array.from(form.querySelectorAll("fieldset.expedition-choice"))
      .find((field) => field.querySelector("legend")?.textContent.trim() === "仲間");
    if (companionGroup) companionGroup.insertAdjacentElement("afterend", group);
    else form.append(group);
    group.addEventListener("change", (event) => {
      if (!event.target || event.target.name !== "rescueFavor" || !event.target.value) return;
      const input = form.querySelector(`input[name="companion"][value="${event.target.value}"]`);
      if (input) input.checked = true;
    });
    return true;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return state;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return state;
    Object.assign(stored, JSON.parse(JSON.stringify(report)));
    return state;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__rescueSalvageInstalled) return Boolean(system);
    if (!system.__rescueLoopInstalled) return false;

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithRescueFavor(state, input, nowMs) {
      const requested = selectedFavorCompanion(root.document) || input && input.rescueFavorCompanionId || null;
      const available = requested && availableFavors(state).some((item) => item.id === requested);
      const members = input && Array.isArray(input.companionIds) ? input.companionIds : [];
      const next = baseDispatch(state, input, nowMs);
      if (available && members.includes(requested) && next.activeExpedition && next.activeExpedition.inputs) {
        next.activeExpedition.inputs.rescueFavorCompanionId = requested;
      }
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithRescueSalvage(expedition, state) {
      const report = decorateReport(baseResolve(expedition, state), expedition);
      return decorateFavorReport(report, expedition, state);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithRescueSalvage(state, report) {
      const applied = baseApplyReport(state, report);
      applyState(applied, report);
      grantRescueFavor(applied, report);
      applyFavorState(applied, report);
      return syncStoredReport(applied, report);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithRescueSalvage(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        decorateFavorReport(advanced.report, expedition, state);
        applyState(advanced.state, advanced.report);
        grantRescueFavor(advanced.state, advanced.report);
        applyFavorState(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__rescueSalvageInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      installSystemHooks(root);
      enhancePrepare(root);
      if (!root.CrownlessExpeditionSystem && root.setTimeout && attempts < 40) root.setTimeout(sync, 50);
    };
    sync();
    if (root.MutationObserver && root.document && root.document.body) {
      const observer = new root.MutationObserver(() => enhancePrepare(root));
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    return true;
  }

  return {
    RESCUE_SALVAGE_ID,
    RESCUE_SALVAGE_LOOT_ID,
    RESCUE_SALVAGE_LOOT_NAME,
    RESCUE_FAVOR_ID,
    qualifies,
    decorateReport,
    applyState,
    grantRescueFavor,
    favorRouteId,
    qualifiesForFavorUse,
    decorateFavorReport,
    applyFavorState,
    availableFavors,
    createFavorGroup,
    enhancePrepare,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});