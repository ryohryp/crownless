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
  let selectedPreparation = "scout";

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

  // Rebuilding a village reveals a distinct, repeatable expedition instead of a cosmetic flag.
  function unlockRestoredRoute(state, stage) {
    if (!state || !Array.isArray(state.destinations)) return null;
    const watchfire = stage === "watchfire";
    const id = watchfire ? "village-restored:watch-road" : "village-restored:ore-trail";
    let route = state.destinations.find((item) => item && item.id === id);
    if (!route) {
      route = {
        id,
        name: watchfire ? "見張り火の巡回街道" : "復旧した鉱石運搬路",
        family: watchfire ? "village" : "cave",
        dangerTags: watchfire ? ["bandit", "unknown"] : ["dark", "fall"],
        opportunityTags: watchfire ? ["survivor", "rumor", "contact"] : ["ore", "salvage", "passage"],
        durationMs: watchfire ? 300000 : 360000,
        villageRestoredRoute: stage,
      };
      state.destinations.push(route);
    }
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(id)) state.discoveredDestinationIds.push(id);
    return route;
  }

  // A successful return from a discovered lead permanently changes the original village.
  // The world change is stored on the existing destination, not a parallel timer or save.
  function restoreVillage(state, report, expedition) {
    const destinationId = (expedition && expedition.inputs && expedition.inputs.destinationId) || (report && report.destinationId);
    const lead = state && Array.isArray(state.destinations)
      && state.destinations.find((item) => item && item.id === destinationId && item.villageLead);
    if (!lead || !report || report.outcome !== "success") return null;
    const source = state.destinations.find((item) => item && item.id === lead.villageLead.sourceDestinationId);
    if (!source || source.id !== DESTINATION_ID) return null;
    const stage = lead.villageLead.approachId === RING ? "watchfire" : "storehouse";
    if (source.villageRestoration === stage) { unlockRestoredRoute(state, stage); return source; }
    source.villageRestoration = stage;
    source.name = stage === "watchfire" ? "見張り火の灯る村" : "物資庫を取り戻した村";
    source.opportunityTags = Array.from(new Set([
      ...(Array.isArray(source.opportunityTags) ? source.opportunityTags : []),
      ...(stage === "watchfire" ? ["survivor", "contact", "safe-camp"] : ["salvage", "supplies", "workshop"]),
    ]));
    source.dangerTags = (Array.isArray(source.dangerTags) ? source.dangerTags : [])
      .filter((tag) => tag !== (stage === "watchfire" ? "bandit" : "collapse"));
    const route = unlockRestoredRoute(state, stage);
    report.villageRestoration = { stage, destinationId: source.id, name: source.name, routeId: route.id };
    if (!Array.isArray(report.log)) report.log = [];
    report.log.push({
      minute: 75, time: "", type: "village-restoration",
      text: stage === "watchfire"
        ? "救出した人々が見張り火を灯した。再訪した村には仲間と安全な野営地がある。"
        : "地下蔵の物資で村の物資庫と作業場が復旧した。再訪時には補給を期待できる。",
      causes: [source.id, destinationId],
    });
    return source;
  }

  // Clearing the newly opened road builds a lasting village facility.
  // Repeating a cleared road does not multiply the facility or its rewards.
  function upgradeVillageFromRoad(state, report) {
    if (!state || !report || report.outcome !== "success" || !Array.isArray(state.destinations)) return null;
    const route = state.destinations.find((item) => item && item.id === report.destinationId && item.villageRestoredRoute);
    const village = state.destinations.find((item) => item && item.id === DESTINATION_ID);
    if (!route || !village || village.villageRestoration !== route.villageRestoredRoute) return null;
    const facility = route.villageRestoredRoute === "watchfire" ? "watchtower" : "forge";
    if (village.villageFacility === facility) return village;
    village.villageFacility = facility;
    village.opportunityTags = Array.from(new Set([...(village.opportunityTags || []),
      facility === "watchtower" ? "scouting" : "smithing"]));
    report.villageFacility = { id: facility, villageId: DESTINATION_ID };
    if (!Array.isArray(report.log)) report.log = [];
    report.log.push({ minute: 103, time: "", type: "village-facility",
      text: facility === "watchtower"
        ? "巡回街道を確保し、村に見張り台が建った。次の再訪では斥候の地図を持ち帰れる。"
        : "鉱石運搬路を確保し、村の鍛冶場が稼働した。次の再訪では鍛造部材を持ち帰れる。",
      causes: [DESTINATION_ID, route.id, facility] });
    return village;
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
    const restored = root.CrownlessExpeditionSystem && root.CrownlessExpeditionSystem.__villageBellRestoration;
    const preparation = form.querySelector("[data-village-preparation]");
    if (currentDestination(form) !== DESTINATION_ID) {
      selectedApproach = QUIET;
      if (existing) existing.remove();
      if (preparation) preparation.remove();
      return Boolean(existing || preparation);
    }
    if (restored) {
      if (existing) existing.remove();
      if (preparation) return false;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "expedition-choice expedition-choice--village";
      fieldset.dataset.villagePreparation = "true";
      const legend = document.createElement("legend");
      legend.textContent = "復興した村で遠征の準備";
      fieldset.appendChild(legend);
      for (const [value, title, copy] of [["scout", "見張り隊に偵察を頼む", "盗賊の奇襲に備えて先手を取る。"], ["supplies", "物資庫で応急手当を整える", "戦闘中に負傷を回復する。"]]) {
        const label = document.createElement("label");
        label.className = "expedition-choice__item";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "village-preparation"; input.value = value;
        input.checked = value === selectedPreparation;
        input.addEventListener("change", () => { if (input.checked) selectedPreparation = value; });
        const body = document.createElement("span");
        const strong = document.createElement("strong"); strong.textContent = title;
        const small = document.createElement("small"); small.textContent = copy;
        body.append(strong, small); label.append(input, body); fieldset.append(label);
      }
      form.appendChild(fieldset);
      return true;
    }
    if (preparation) preparation.remove();
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
      system.__villageBellRestoration = next.destinations.find((item) => item.id === DESTINATION_ID)?.villageRestoration || null;
      const inputs = next && next.activeExpedition && next.activeExpedition.inputs;
      if (inputs && inputs.destinationId === DESTINATION_ID) {
        const village = state && state.destinations && state.destinations.find((item) => item.id === DESTINATION_ID);
        if (village && village.villageRestoration) inputs.villagePreparation = selectedPreparation;
        else inputs.villageApproach = normalizeApproach(requested);
      }
      selectedApproach = QUIET;
      return next;
    };

    function rewardRevisit(state, report) {
      const destination = state && Array.isArray(state.destinations)
        && state.destinations.find((item) => item && item.id === report.destinationId);
      if (report.outcome !== "success" || !destination || destination.id !== DESTINATION_ID || !destination.villageRestoration) return;
      const supplies = destination.villageFacility === "watchtower"
        ? { id: "village-scout-map", name: "見張り台の斥候地図", tags: ["map", "scouting", "supplies"] }
        : destination.villageFacility === "forge"
          ? { id: "village-forged-parts", name: "鍛冶場の鍛造部材", tags: ["ore", "metal", "craft"] }
          : destination.villageRestoration === "watchfire"
            ? { id: "village-watchfire-herbs", name: "見張り火の薬草包み", tags: ["herbs", "supplies"] }
            : { id: "village-storehouse-ore", name: "復興物資庫の鍛造材", tags: ["ore", "supplies"] };
      if (!Array.isArray(report.loot)) report.loot = [];
      if (report.loot.some((item) => item && item.id === supplies.id)) return;
      report.loot.push(supplies);
      if (!Array.isArray(report.log)) report.log = [];
      report.log.push({
        minute: 101, time: "", type: "village-supplies",
        text: `復興した村から${supplies.name}を受け取った。帰還して倉庫に持ち帰る。`,
        causes: [destination.id, supplies.id],
      });
    }

    // Restored roads have different reasons to return: rescue supplies or mining ore.
    // Loot is attached before the base engine banks the successful report.
    function rewardRestoredRoad(state, report) {
      if (!report || report.outcome !== "success" || !Array.isArray(state && state.destinations)) return;
      const route = state.destinations.find((item) => item && item.id === report.destinationId && item.villageRestoredRoute);
      if (!route) return;
      const item = route.villageRestoredRoute === "watchfire"
        ? { id: "watch-road-medicine", name: "巡回街道の救護薬材", tags: ["herbs", "medicine", "supplies"] }
        : { id: "ore-trail-iron", name: "鉱石運搬路の良質鉄鉱", tags: ["ore", "metal", "craft"] };
      if (!Array.isArray(report.loot)) report.loot = [];
      if (report.loot.some((loot) => loot && loot.id === item.id)) return;
      report.loot.push(item);
      if (!Array.isArray(report.log)) report.log = [];
      report.log.push({
        minute: 102, time: "", type: "restored-road-loot",
        text: `${route.name}を踏破し、${item.name}を確保した。生還すれば拠点で利用できる。`,
        causes: [route.id, item.id],
      });
    }

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithVillageChoice(expedition, state) {
      const preparation = expedition && expedition.inputs && expedition.inputs.villagePreparation;
      const village = state && state.destinations && state.destinations.find((item) => item.id === DESTINATION_ID);
      let preparedState = state;
      let preparedExpedition = expedition;
      if (village && village.villageRestoration && expedition.inputs.destinationId === DESTINATION_ID && ["scout", "supplies"].includes(preparation)) {
        const tag = preparation === "scout" ? "conceal" : "heal";
        const gearId = "village-preparation-" + preparation;
        preparedState = { ...state, equipment: [...state.equipment, { id: gearId, name: "村の支援", tags: [tag] }] };
        preparedExpedition = { ...expedition, inputs: { ...expedition.inputs, equipmentIds: [...expedition.inputs.equipmentIds, gearId] } };
      }
      const report = decorateReport(baseResolve(preparedExpedition, preparedState), expedition);
      if (preparedExpedition !== expedition) {
        report.villagePreparation = preparation;
        report.log.unshift({ minute: 0, time: "", type: "village-preparation", text: preparation === "scout" ? "村の見張り隊が盗賊の動きを教えてくれた。" : "復興した村の物資庫で応急手当を整えた。", causes: ["village-preparation-" + preparation] });
      }
      rewardRevisit(state, report);
      rewardRestoredRoad(state, report);
      return report;
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithVillageChoice(state, report) {
      rewardRevisit(state, report);
      rewardRestoredRoad(state, report);
      const applied = baseApplyReport(state, report);
      unlockFollowup(applied, report);
      restoreVillage(applied, report);
      upgradeVillageFromRoad(applied, report);
      syncStoredReport(applied, report);
      system.__villageBellRestoration = applied.destinations.find((item) => item.id === DESTINATION_ID)?.villageRestoration || null;
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithVillageChoice(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) {
        decorateReport(advanced.report, expedition);
        rewardRevisit(state, advanced.report);
        rewardRestoredRoad(state, advanced.report);
        // advance() has already banked the base report; bank sidecar road loot once.
        if (advanced.report.outcome === "success" && Array.isArray(advanced.state.securedLoot)) {
          const routeLoot = advanced.report.loot.find((item) => item && ["watch-road-medicine", "ore-trail-iron"].includes(item.id));
          if (routeLoot && !advanced.state.securedLoot.some((item) => item.id === routeLoot.id && item.sourceExpeditionId === advanced.report.expeditionId)) {
            advanced.state.securedLoot.push({ ...routeLoot, sourceExpeditionId: advanced.report.expeditionId });
          }
        }
        if (advanced.report.outcome === "success" && advanced.report.destinationId === DESTINATION_ID && advanced.report.loot.some((item) => item && item.id.startsWith("village-"))) {
          const bonus = advanced.report.loot.find((item) => item && item.id.startsWith("village-"));
          if (!advanced.state.securedLoot.some((item) => item.sourceExpeditionId === advanced.report.expeditionId && item.id === bonus.id)) advanced.state.securedLoot.push({ ...bonus, sourceExpeditionId: advanced.report.expeditionId });
        }
        unlockFollowup(advanced.state, advanced.report);
        restoreVillage(advanced.state, advanced.report, expedition);
        upgradeVillageFromRoad(advanced.state, advanced.report);
        syncStoredReport(advanced.state, advanced.report);
      }
      system.__villageBellRestoration = advanced.state?.destinations?.find((item) => item.id === DESTINATION_ID)?.villageRestoration || null;
      return advanced;
    };

    system.__villageBellInstalled = true;
    // UI checks the currently saved destination, refreshed on each state transition.
    const baseNormalize = system.normalizeState.bind(system);
    system.normalizeState = function normalizeWithVillageRestoration(input) {
      const next = baseNormalize(input);
      system.__villageBellRestoration = next.destinations.find((item) => item.id === DESTINATION_ID)?.villageRestoration || null;
      return next;
    };
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
    restoreVillage,
    unlockRestoredRoute,
    upgradeVillageFromRoad,
    syncStoredReport,
    currentDestination,
    syncChoice,
    installSystemHooks,
    installUi,
    install,
  };
});