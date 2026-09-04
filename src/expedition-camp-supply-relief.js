(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionCampSupplyRelief = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createCampSupplyRelief() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const SUPPLY_ID = "abandoned-camp-supplies";
  const SUPPLY_EQUIPMENT = Object.freeze({
    id: SUPPLY_ID,
    name: "野営跡の補給品",
    tags: Object.freeze(["supply", "fatigue-relief", "consumable"]),
  });
  const RELIEVED_RECOVERY_MS = 2 * 60 * 1000;

  function readState(root) {
    try {
      const raw = root && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function reportContainsSupply(report) {
    return Boolean(report && report.outcome === "success" && Array.isArray(report.loot)
      && report.loot.some((item) => item && item.id === SUPPLY_ID));
  }

  function unlockSupplyEquipment(state, report) {
    if (!state || !reportContainsSupply(report)) return state;
    if (!Array.isArray(state.equipment)) state.equipment = [];
    if (!state.equipment.some((item) => item && item.id === SUPPLY_ID)) {
      state.equipment.push({ id: SUPPLY_EQUIPMENT.id, name: SUPPLY_EQUIPMENT.name, tags: Array.from(SUPPLY_EQUIPMENT.tags) });
    }
    return state;
  }

  function ownsSupply(state) {
    return Boolean(state && (
      Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === SUPPLY_ID)
      || Array.isArray(state.equipment) && state.equipment.some((item) => item && item.id === SUPPLY_ID)
    ));
  }

  function qualifiesForFieldCare(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && inputs.fieldCareReserve === true
      && Array.isArray(inputs.equipmentIds)
      && inputs.equipmentIds.includes(SUPPLY_ID)
      && Array.isArray(report.injuries)
      && report.injuries.length
      && !report.fieldCareUsed
    );
  }

  function decorateFieldCareReport(report, expedition, state) {
    if (!qualifiesForFieldCare(report, expedition)) return report;
    const companionId = report.injuries.shift();
    const companion = state && Array.isArray(state.companions)
      ? state.companions.find((item) => item && item.id === companionId)
      : null;
    const companionName = companion && companion.name || companionId;
    report.fieldCareUsed = { equipmentId: SUPPLY_ID, companionId, companionName };
    if (!Array.isArray(report.log)) report.log = [];
    const injuryEntry = report.log.find((entry) => entry && entry.type === "injury" && String(entry.text || "").includes(companionName));
    const minute = Number.isFinite(injuryEntry && injuryEntry.minute) ? injuryEntry.minute + 1 : 109;
    const entry = {
      minute,
      time: injuryEntry && injuryEntry.time || "",
      type: "field-care",
      text: `${companionName}の傷を《${SUPPLY_EQUIPMENT.name}》でその場で処置した。帰還後の負傷を免れた。`,
      causes: [SUPPLY_ID, companionId, "field-care"],
    };
    report.log.push(entry);
    report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    report.notableEvent = entry;
    return report;
  }

  function qualifiesForRelief(report, expedition) {
    const inputs = expedition && expedition.inputs;
    return Boolean(
      report
      && inputs
      && ["success", "early-return"].includes(report.outcome)
      && !report.fieldCareUsed
      && inputs.pace === "forced"
      && Array.isArray(inputs.equipmentIds)
      && inputs.equipmentIds.includes(SUPPLY_ID)
      && Array.isArray(report.forcedMarchFatigueIds)
      && report.forcedMarchFatigueIds.length
    );
  }

  function decorateReport(report, expedition) {
    if (!qualifiesForRelief(report, expedition)) return report;
    report.forcedMarchSupplyRelief = {
      equipmentId: SUPPLY_ID,
      recoveryMs: RELIEVED_RECOVERY_MS,
    };
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "forced-march-supply-relief")) {
      report.log.push({
        minute: 110,
        time: "",
        type: "forced-march-supply-relief",
        text: "野営跡の補給品を使い切り、強行軍の疲労を抑えた。休養は約2分で済みそうだ。",
        causes: ["forced-march", SUPPLY_ID, "fatigue-relief"],
      });
      report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    }
    return report;
  }

  function consumeOneSupply(state) {
    if (!state) return state;
    if (Array.isArray(state.securedLoot)) {
      const index = state.securedLoot.findIndex((item) => item && item.id === SUPPLY_ID);
      if (index >= 0) state.securedLoot.splice(index, 1);
    }
    const stillOwned = Array.isArray(state.securedLoot) && state.securedLoot.some((item) => item && item.id === SUPPLY_ID);
    if (!stillOwned && Array.isArray(state.equipment)) {
      state.equipment = state.equipment.filter((item) => !item || item.id !== SUPPLY_ID);
    }
    return state;
  }

  function applyFieldCare(state, report) {
    if (!state || !report || !report.fieldCareUsed || report.fieldCareConsumed) return state;
    consumeOneSupply(state);
    report.fieldCareConsumed = true;
    return state;
  }

  function applySupplyRelief(state, report) {
    if (!state || !report || !report.forcedMarchSupplyRelief) return state;
    const completedAt = Number.isFinite(Number(report.completedAt)) ? Number(report.completedAt) : Date.now();
    const targetUntil = completedAt + RELIEVED_RECOVERY_MS;
    const ids = new Set(Array.isArray(report.forcedMarchFatigueIds) ? report.forcedMarchFatigueIds : []);
    if (Array.isArray(state.companions)) {
      for (const companion of state.companions) {
        if (!companion || !ids.has(companion.id) || companion.condition !== "recovering") continue;
        const currentUntil = Number(companion.recoveryUntil);
        if (!Number.isFinite(currentUntil) || currentUntil > targetUntil) companion.recoveryUntil = targetUntil;
      }
    }
    consumeOneSupply(state);
    report.forcedMarchSupplyConsumed = true;
    return state;
  }

  function selectedFieldCare(doc) {
    const selected = doc && doc.querySelector('input[name="fieldCareReserve"]:checked');
    return Boolean(selected && selected.value === "use");
  }

  function createFieldCareGroup(doc) {
    if (!doc) return null;
    const group = doc.createElement("fieldset");
    group.className = "expedition-choice expedition-field-care-choice";
    group.dataset.fieldCareChoice = "true";
    const legend = doc.createElement("legend");
    legend.textContent = "補給品の使い道";
    group.append(legend);

    const choices = [
      ["keep", "補給品を温存する", "強行軍や、もっと危険な遠征のために残す", true],
      ["use", "負傷時の応急処置に回す", "負傷が出た時だけ1つ使い、最初の負傷1件をその場で処置する", false],
    ];
    for (const [value, title, description, checked] of choices) {
      const label = doc.createElement("label");
      label.className = "expedition-choice__item";
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "fieldCareReserve";
      input.value = value;
      input.checked = checked;
      const body = doc.createElement("span");
      const strong = doc.createElement("strong");
      strong.textContent = title;
      const small = doc.createElement("small");
      small.textContent = description;
      body.append(strong, small);
      label.append(input, body);
      group.append(label);
    }
    return group;
  }

  function enhancePrepare(root) {
    const doc = root && root.document;
    const form = doc && doc.querySelector("#expedition-folio form.expedition-prepare");
    if (!form || form.querySelector("[data-field-care-choice]") || !ownsSupply(readState(root))) return false;
    const group = createFieldCareGroup(doc);
    if (!group) return false;
    const equipmentGroup = Array.from(form.querySelectorAll("fieldset.expedition-choice"))
      .find((field) => field.querySelector("legend")?.textContent.trim() === "装備");
    if (equipmentGroup) equipmentGroup.insertAdjacentElement("afterend", group);
    else form.append(group);
    group.addEventListener("change", (event) => {
      if (!event.target || event.target.name !== "fieldCareReserve" || event.target.value !== "use") return;
      const supply = form.querySelector(`input[name="equipment"][value="${SUPPLY_ID}"]`);
      if (supply) supply.checked = true;
    });
    return true;
  }

  function syncStoredReport(state, report) {
    if (!state || !report || !Array.isArray(state.completedReports)) return;
    const stored = state.completedReports.find((item) => item && item.expeditionId === report.expeditionId);
    if (!stored || stored === report) return;
    Object.assign(stored, JSON.parse(JSON.stringify(report)));
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    const forcedMarch = root && root.CrownlessExpeditionForcedMarch;
    const campfire = root && root.CrownlessExpeditionCampfireObjectives;
    if (!system || !forcedMarch || !campfire || !system.__forcedMarchInstalled) return false;
    if (system.__campSupplyReliefInstalled) return true;

    const baseDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithCampSupplyChoice(state, input, nowMs) {
      const wantsFieldCare = selectedFieldCare(root.document) || Boolean(input && input.fieldCareReserve);
      const selectedEquipment = input && Array.isArray(input.equipmentIds) ? input.equipmentIds : [];
      const next = baseDispatch(state, input, nowMs);
      if (wantsFieldCare && selectedEquipment.includes(SUPPLY_ID) && next.activeExpedition && next.activeExpedition.inputs) {
        next.activeExpedition.inputs.fieldCareReserve = true;
      }
      return next;
    };

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithCampSupplyRelief(expedition, state) {
      const report = decorateFieldCareReport(baseResolve(expedition, state), expedition, state);
      return decorateReport(report, expedition);
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithCampSupplyRelief(state, report) {
      const wasApplied = Boolean(state && Array.isArray(state.appliedExpeditionIds) && state.appliedExpeditionIds.includes(report && report.expeditionId));
      const applied = baseApplyReport(state, report);
      if (!wasApplied) {
        unlockSupplyEquipment(applied, report);
        applyFieldCare(applied, report);
        applySupplyRelief(applied, report);
      }
      syncStoredReport(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithCampSupplyRelief(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const wasApplied = Boolean(state && Array.isArray(state.appliedExpeditionIds) && expedition && state.appliedExpeditionIds.includes(expedition.id));
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateFieldCareReport(advanced.report, expedition, state);
        decorateReport(advanced.report, expedition);
        if (!wasApplied) {
          unlockSupplyEquipment(advanced.state, advanced.report);
          applyFieldCare(advanced.state, advanced.report);
          applySupplyRelief(advanced.state, advanced.report);
        }
        syncStoredReport(advanced.state, advanced.report);
      }
      return advanced;
    };

    system.__campSupplyReliefInstalled = true;
    return true;
  }

  function install(root) {
    if (!root) return false;
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      installSystemHooks(root);
      enhancePrepare(root);
      if (!root.CrownlessExpeditionSystem && root.setTimeout && attempts < 60) root.setTimeout(sync, 50);
    };
    sync();
    if (root.MutationObserver && root.document && root.document.body) {
      const observer = new root.MutationObserver(() => enhancePrepare(root));
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    return true;
  }

  return {
    SUPPLY_ID,
    SUPPLY_EQUIPMENT,
    RELIEVED_RECOVERY_MS,
    reportContainsSupply,
    unlockSupplyEquipment,
    ownsSupply,
    qualifiesForFieldCare,
    decorateFieldCareReport,
    applyFieldCare,
    qualifiesForRelief,
    decorateReport,
    consumeOneSupply,
    applySupplyRelief,
    selectedFieldCare,
    createFieldCareGroup,
    enhancePrepare,
    syncStoredReport,
    installSystemHooks,
    install,
  };
});