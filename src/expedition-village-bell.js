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
  let requestCrystalBeacon = false;
  let selectedPreparation = "scout";
  let requestForgePass = false;
  let selectedMineApproach = "safe";
  let selectedGrottoApproach = "lit";
  let selectedMirrorPath = "observe";

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

  // Spend one banked ore to forge a pass into a new, repeatable mine.
  function forgeMinePass(state) {
    const village = state && Array.isArray(state.destinations)
      && state.destinations.find((item) => item && item.id === DESTINATION_ID);
    if (!village || village.villageFacility !== "forge" || !Array.isArray(state.securedLoot)) return null;
    const id = "village-forge:sealed-mine";
    const existing = state.destinations.find((item) => item && item.id === id);
    if (existing) return existing;
    const index = state.securedLoot.findIndex((item) => item && item.id === "ore-trail-iron");
    if (index < 0) return null;
    const route = {
      id, name: "鍛造楔で開いた封鎖坑道", family: "cave",
      dangerTags: ["dark", "collapse", "unknown"],
      opportunityTags: ["rare-ore", "relic", "salvage"],
      durationMs: 420000, villageForgedPass: true,
    };
    state.securedLoot.splice(index, 1);
    state.destinations.push(route);
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(id)) state.discoveredDestinationIds.push(id);
    return route;
  }

  // Deep crystal is a one-time construction resource, not a finished weapon drop.
  // The beacon turns a previous mining success into a repeatable exploration route.
  function buildCrystalBeacon(state) {
    const village = state && Array.isArray(state.destinations)
      && state.destinations.find(item => item && item.id === DESTINATION_ID);
    if (!village || village.villageFacility !== "forge" || !Array.isArray(state.securedLoot)) return null;
    const id = "village-forge:crystal-grotto";
    const existing = state.destinations.find(item => item && item.id === id);
    if (existing) return existing;
    if (!state.destinations.some(item => item && item.id === "village-forge:sealed-mine")) return null;
    const index = state.securedLoot.findIndex(item => item && item.id === "sealed-mine-deep-crystal");
    if (index < 0) return null;
    const destination = {
      id, name: "深晶石の灯る隠し洞窟", family: "cave",
      dangerTags: ["dark", "unknown", "guardian"],
      opportunityTags: ["relic", "hidden-path", "crystal"],
      durationMs: 540000, villageCrystalBeacon: true,
    };
    state.securedLoot.splice(index, 1);
    state.destinations.push(destination);
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(id)) state.discoveredDestinationIds.push(id);
    village.villageCrystalBeacon = true;
    return destination;
  }

  function prepareMineDelve(state, expedition, approach) {
    if (!state || !expedition?.inputs || expedition.inputs.destinationId !== "village-forge:sealed-mine" || !["deep", "unstable", "shored"].includes(approach) || !Array.isArray(state.securedLoot)) return false;
    const index = state.securedLoot.findIndex(item => item?.id === (approach === "shored" ? "village-forged-parts" : "watch-road-medicine"));
    if (index < 0) return false;
    state.securedLoot.splice(index, 1);
    expedition.inputs.villageMineDelve = approach;
    if (approach === "unstable") expedition.inputs.policyId = "greedy"; // Two encounters, lower retreat threshold.
    return true;
  }

  // The recovered prism is a tool: angle it at the grotto wall to reveal a permanent chamber.
  // This is a one-time material decision; repeated visits never spend another prism.
  function revealMirrorChamber(state) {
    if (!state || !Array.isArray(state.destinations) || !Array.isArray(state.securedLoot)) return null;
    const grotto = state.destinations.find(item => item && item.id === "village-forge:crystal-grotto");
    if (!grotto) return null;
    const id = "village-forge:mirror-chamber";
    const existing = state.destinations.find(item => item && item.id === id);
    if (existing) return existing;
    const index = state.securedLoot.findIndex(item => item && item.id === "grotto-shadow-prism");
    if (index < 0) return null;
    state.securedLoot.splice(index, 1);
    const chamber = {
      id, name: "影晶が映す鏡の間", family: "cave",
      dangerTags: ["guardian", "reflection", "dark"],
      opportunityTags: ["relic", "crystal", "hidden-cache"],
      durationMs: 600000, villageMirrorChamber: true,
    };
    state.destinations.push(chamber);
    if (!Array.isArray(state.discoveredDestinationIds)) state.discoveredDestinationIds = [];
    if (!state.discoveredDestinationIds.includes(id)) state.discoveredDestinationIds.push(id);
    return chamber;
  }

  // A visible inscription lets players reason about the reflection rather than guess.
  function prepareMirrorPath(expedition, path, state) {
    if (!expedition?.inputs || expedition.inputs.destinationId !== "village-forge:mirror-chamber") return false;
    if (!["observe", "left", "center", "counter", "vault", "resonance"].includes(path)) return false;
    if (["vault", "resonance"].includes(path) && state && !state.destinations?.some(item => item.id === "village-forge:mirror-chamber" && item.villageMirrorVault)) return false;
    if (path === "resonance") {
      const index = state?.securedLoot?.findIndex(item => item?.id === "mirror-chamber-relic") ?? -1;
      if (index < 0) return false;
      state.securedLoot.splice(index, 1);
    }
    if (["left", "counter"].includes(path) && state && !state.destinations?.some(item => item.id === "village-forge:mirror-chamber" && item.villageMirrorInscription)) return false;
    expedition.inputs.villageMirrorPath = path;
    if (path === "center" || path === "vault") expedition.inputs.policyId = "greedy";
    return true;
  }

  function rewardMirrorPath(report, expedition) {
    if (!report || expedition?.inputs?.destinationId !== "village-forge:mirror-chamber") return false;
    const path = expedition.inputs.villageMirrorPath;
    if (!["left", "center", "counter", "vault", "resonance"].includes(path)) return false;
    if (!Array.isArray(report.log)) report.log = [];
    if (report.log.some(item => item?.type === "mirror-beam")) return false;
    const solved = path === "left" && report.outcome === "success";
    const vaultCleared = ["vault", "resonance"].includes(path) && report.outcome === "success";
    if (solved || vaultCleared) {
      if (!Array.isArray(report.loot)) report.loot = [];
      if (solved && !report.loot.some(item => item?.id === "mirror-chamber-relic")) {
        report.loot.push({ id: "mirror-chamber-relic", name: "鏡の間の反射核", tags: ["relic", "crystal", "craft"] });
      }
      if (vaultCleared && !report.loot.some(item => item?.id === "mirror-vault-essence")) report.loot.push({ id: "mirror-vault-essence", name: "鏡奥の光髄", tags: ["relic", "light", "craft"] });
    }
    report.log.push({ minute: 108, time: "", type: "mirror-beam",
      text: path === "resonance" ? vaultCleared ? "反射核を消費して封印の光を安定させ、連戦を避けて光髄を回収した。" : "反射核で封印を安定させたが、撤退して光髄を持ち帰れなかった。"
        : path === "vault" ? vaultCleared ? "反射核を共鳴させて鏡奥の封印を破り、光髄を持ち帰った。" : "鏡奥の封印を解いたが、守護者との連戦から撤退した。"
        : path === "counter" ? "刻印の反射角を利用して守護者の動きを読み、初撃を先制した。"
        : path === "left"
        ? solved ? "刻印に従い左鏡から奥鏡へ光を反射させ、反射核を回収した。" : "左鏡を照らしたが、撤退のため反射核は持ち帰れなかった。"
        : "正面の鏡が光を跳ね返し、守護者を刺激した。危険な連戦となった。",
      causes: ["village-forge:mirror-chamber", "mirror-path:" + path] });
    return true;
  }

  // Scouting the inscription is a first expedition stage; the solved route is a revisit.
  function discoverMirrorInscription(state, report, expedition) {
    if (!state?.destinations || report?.outcome !== "success" || expedition?.inputs?.destinationId !== "village-forge:mirror-chamber" || expedition.inputs.villageMirrorPath !== "observe") return false;
    const chamber = state.destinations.find(item => item.id === "village-forge:mirror-chamber");
    if (!chamber || chamber.villageMirrorInscription) return false;
    chamber.villageMirrorInscription = true;
    if (!Array.isArray(report.log)) report.log = [];
    report.log.push({ minute: 104, time: "", type: "mirror-inscription",
      text: "鏡の裏に刻まれた反射順序を記録した。次の遠征では左鏡から奥鏡へ光を導ける。",
      causes: ["mirror-inscription"] });
    return true;
  }

  function discoverMirrorVault(state, report, expedition) {
    if (!state?.destinations || report?.outcome !== "success" || expedition?.inputs?.destinationId !== "village-forge:mirror-chamber" || expedition.inputs.villageMirrorPath !== "left") return false;
    const chamber = state.destinations.find(item => item.id === "village-forge:mirror-chamber");
    if (!chamber || chamber.villageMirrorVault) return false;
    chamber.villageMirrorVault = true;
    if (!Array.isArray(report.log)) report.log = [];
    report.log.push({ minute: 109, time: "", type: "mirror-vault-discovered", text: "反射核が共鳴し、鏡の奥に封印された部屋を発見した。次回は危険な守護者に挑める。", causes: ["mirror-vault"] });
    return true;
  }

  // An optional dark detour turns the grotto into a risk/reward decision.
  function prepareGrottoDetour(expedition, approach, state) {
    if (!expedition?.inputs || expedition.inputs.destinationId !== "village-forge:crystal-grotto") return false;
    if (!["shadow", "mapped"].includes(approach)) return false;
    if (approach === "mapped") {
      const index = state?.securedLoot?.findIndex(item => item.id === "village-scout-map") ?? -1;
      if (index < 0) return false;
      state.securedLoot.splice(index, 1);
    }
    expedition.inputs.villageGrottoDetour = approach;
    expedition.inputs.policyId = approach === "mapped" ? "standard" : "greedy";
    return true;
  }

  function rewardGrottoDetour(report, expedition) {
    if (!report || report.outcome !== "success" || expedition?.inputs?.destinationId !== "village-forge:crystal-grotto" || !["shadow", "mapped"].includes(expedition.inputs.villageGrottoDetour)) return false;
    if (!Array.isArray(report.loot)) report.loot = [];
    if (report.loot.some(item => item?.id === "grotto-shadow-prism")) return false;
    report.loot.push({ id: "grotto-shadow-prism", name: "暗がりの影晶プリズム", tags: ["crystal", "rare-ore", "craft"] });
    if (!Array.isArray(report.log)) report.log = [];
    report.log.push({ minute: 105, time: "", type: "grotto-shadow-detour",
      text: "導光灯の届かない横穴を突破し、影晶プリズムを持ち帰った。",
      causes: ["village-forge:crystal-grotto", "grotto-shadow-prism"] });
    return true;
  }

  function rewardMineDelve(report, expedition) {
    if (!report || report.outcome !== "success" || expedition?.inputs?.destinationId !== "village-forge:sealed-mine" || !["deep", "unstable", "shored"].includes(expedition.inputs.villageMineDelve)) return false;
    if (!Array.isArray(report.loot)) report.loot = [];
    if (report.loot.some(item => item?.id === "sealed-mine-star-ore")) return false;
    report.loot.push({ id: "sealed-mine-star-ore", name: "封鎖坑道の星鉄鉱", tags: ["rare-ore", "metal", "craft"] });
    if (["unstable", "shored"].includes(expedition.inputs.villageMineDelve)) {
      report.loot.push({ id: "sealed-mine-deep-crystal", name: "崩落層の深晶石", tags: ["rare-ore", "crystal", "craft"] });
    }
    if (!Array.isArray(report.log)) report.log = [];
    report.log.push({ minute: 104, time: "", type: "mine-deep-delve", text: expedition.inputs.villageMineDelve === "unstable" ? "崩落寸前の坑道を強行突破し、星鉄鉱と深晶石を持ち帰った。" : expedition.inputs.villageMineDelve === "shored" ? "鍛造部材で崩落層を支え、強行突破せずに星鉄鉱と深晶石を持ち帰った。" : "救護薬材を使って深層へ潜り、星鉄鉱を確保した。", causes: ["village-forge:sealed-mine", "sealed-mine-star-ore"] });
    return true;
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
    const mineChoice = form.querySelector("[data-village-mine-choice]");
    if (currentDestination(form) === "village-forge:mirror-chamber") {
      for (const node of [existing, preparation, mineChoice, form.querySelector("[data-village-grotto-choice]")]) if (node) node.remove();
      if (form.querySelector("[data-village-mirror-choice]")) return false;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "expedition-choice expedition-choice--village";
      fieldset.dataset.villageMirrorChoice = "true";
      const legend = document.createElement("legend");
      legend.textContent = root.CrownlessExpeditionSystem?.__villageMirrorInscription ? "鏡の間：記録した刻印『左の鏡から奥へ』" : "鏡の間：まず鏡の裏の刻印を調査しよう";
      fieldset.appendChild(legend);
      for (const [value, title, copy] of [
        ["observe", "鏡を調べる", "危険を増やさず構造を確認する。"],
        ["left", "左鏡から奥鏡へ反射", "調査で記録した刻印を使い、反射核を回収。"],
        ["center", "正面の鏡を強引に照らす", "守護者を刺激して危険な連戦になる。"],
        ["counter", "鏡の反射で先制する", "刻印を利用して守護者の予兆を読み、戦闘の初撃を強化する。報酬は通常探索と同じ。"],
        ["vault", "鏡奥の封印に挑む", "反射攻略後に発見した封印へ。危険な連戦を突破すると光髄を回収。"],
        ["resonance", "反射核で封印を安定させる", "反射核を1個消費して危険な連戦を避け、光髄を狙う。"],
      ]) {
        const label = document.createElement("label");
        label.className = "expedition-choice__item";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "village-mirror-path"; input.value = value;
        input.disabled = (["left", "counter"].includes(value) && !root.CrownlessExpeditionSystem?.__villageMirrorInscription) || (["vault", "resonance"].includes(value) && !root.CrownlessExpeditionSystem?.__villageMirrorVault);
        input.checked = value === selectedMirrorPath;
        input.addEventListener("change", () => { if (input.checked) selectedMirrorPath = value; });
        const body = document.createElement("span");
        const strong = document.createElement("strong"); strong.textContent = title;
        const small = document.createElement("small"); small.textContent = copy;
        body.append(strong, small); label.append(input, body); fieldset.append(label);
      }
      form.appendChild(fieldset);
      return true;
    }
    const oldMirrorChoice = form.querySelector("[data-village-mirror-choice]");
    if (oldMirrorChoice) oldMirrorChoice.remove();
    if (currentDestination(form) === "village-forge:crystal-grotto") {
      if (existing) existing.remove();
      if (preparation) preparation.remove();
      if (mineChoice) mineChoice.remove();
      const old = form.querySelector("[data-village-grotto-choice]");
      if (old) return false;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "expedition-choice expedition-choice--village";
      fieldset.dataset.villageGrottoChoice = "true";
      const legend = document.createElement("legend");
      legend.textContent = "隠し洞窟：光を頼るか、暗がりへ進むか";
      fieldset.appendChild(legend);
      for (const [value, title, copy] of [
        ["lit", "導光灯の道を進む", "安全寄りの通常探索。素材を持ち帰ることを優先する。"],
        ["shadow", "光の届かない横穴へ", "強欲方針で二連戦。生還できれば希少な影晶プリズムを持ち帰る。"],
        ["mapped", "斥候地図で横穴を攻略", "見張り台の斥候地図を1枚消費。強欲方針を避けて影晶プリズムを狙う。"],
        ["mirror", "影晶プリズムで壁を照らす", "持ち帰った影晶プリズムを1個使い、鏡の間への隠し通路を恒久開放する。"],
      ]) {
        const label = document.createElement("label");
        label.className = "expedition-choice__item";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "village-grotto-approach"; input.value = value;
        input.checked = value === selectedGrottoApproach;
        input.addEventListener("change", () => { if (input.checked) selectedGrottoApproach = value; });
        const body = document.createElement("span");
        const strong = document.createElement("strong"); strong.textContent = title;
        const small = document.createElement("small"); small.textContent = copy;
        body.append(strong, small); label.append(input, body); fieldset.append(label);
      }
      form.appendChild(fieldset);
      return true;
    }
    const grottoChoice = form.querySelector("[data-village-grotto-choice]");
    if (grottoChoice) grottoChoice.remove();
    if (currentDestination(form) === "village-forge:sealed-mine") {
      if (existing) existing.remove();
      if (preparation) preparation.remove();
      if (mineChoice) return false;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "expedition-choice expedition-choice--village";
      fieldset.dataset.villageMineChoice = "true";
      const legend = document.createElement("legend");
      legend.textContent = "封鎖坑道：どこまで潜る？";
      fieldset.appendChild(legend);
      for (const [value, title, copy] of [
        ["safe", "安全な採掘路", "物資を温存して通常探索。"],
        ["shored", "坑道を補強して深晶石を採る", "鍛冶場の鍛造部材1個を消費。強欲二連戦を避け、成功すれば星鉄鉱と深晶石を持ち帰る。"],
        ["deep", "星鉄の深層へ", "巡回街道の救護薬材1個を出発時に消費。生還すれば星鉄鉱を獲得。"],
        ["unstable", "崩落寸前の横坑を強行", "救護薬材1個を消費。強欲方針で必ず2戦に挑み、撤退判断も遅くなる。生還できれば星鉄鉱と深晶石を確保。"],
      ]) {
        const label = document.createElement("label");
        label.className = "expedition-choice__item";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "village-mine-approach"; input.value = value;
        input.checked = value === selectedMineApproach;
        input.addEventListener("change", () => { if (input.checked) selectedMineApproach = value; });
        const body = document.createElement("span");
        const strong = document.createElement("strong"); strong.textContent = title;
        const small = document.createElement("small"); small.textContent = copy;
        body.append(strong, small); label.append(input, body); fieldset.append(label);
      }
      form.appendChild(fieldset);
      return true;
    }
    if (mineChoice) mineChoice.remove();
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
      if (root.CrownlessExpeditionSystem.__villageBellFacility === "forge") {
        const beacon = document.createElement("label");
        beacon.className = "expedition-choice__item";
        const beaconInput = document.createElement("input");
        beaconInput.type = "checkbox"; beaconInput.name = "village-crystal-beacon";
        beaconInput.checked = requestCrystalBeacon;
        beaconInput.addEventListener("change", () => { requestCrystalBeacon = beaconInput.checked; });
        const beaconDescription = document.createElement("span");
        beaconDescription.textContent = "深晶石1個で導光灯を建設し、隠し洞窟への再訪路を開く";
        beacon.append(beaconInput, beaconDescription);
        fieldset.append(beacon);
        const craft = document.createElement("label");
        craft.className = "expedition-choice__item";
        const input = document.createElement("input");
        input.type = "checkbox"; input.name = "village-forge-pass";
        input.checked = requestForgePass;
        input.addEventListener("change", () => { requestForgePass = input.checked; });
        const description = document.createElement("span");
        description.textContent = "良質鉄鉱1個を鍛造楔に加工し、封鎖坑道を開く";
        craft.append(input, description);
        fieldset.append(craft);
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
      system.__villageBellFacility = next.destinations.find((item) => item.id === DESTINATION_ID)?.villageFacility || null;
      if (requestForgePass && next.activeExpedition && next.activeExpedition.inputs.destinationId === DESTINATION_ID) {
        const opened = forgeMinePass(next);
        if (opened) next.activeExpedition.inputs.forgedMinePass = opened.id;
      }
      requestForgePass = false;
      if (requestCrystalBeacon && next.activeExpedition && next.activeExpedition.inputs.destinationId === DESTINATION_ID) {
        const opened = buildCrystalBeacon(next);
        if (opened) next.activeExpedition.inputs.crystalBeaconBuilt = opened.id;
      }
      requestCrystalBeacon = false;
      if (next.activeExpedition) prepareMineDelve(next, next.activeExpedition, selectedMineApproach);
      selectedMineApproach = "safe";
      if (next.activeExpedition && next.activeExpedition.inputs.destinationId === "village-forge:crystal-grotto" && selectedGrottoApproach === "mirror") {
        const chamber = revealMirrorChamber(next);
        if (chamber) next.activeExpedition.inputs.villageMirrorChamberOpened = chamber.id;
      }
      if (next.activeExpedition) prepareGrottoDetour(next.activeExpedition, selectedGrottoApproach, next);
      selectedGrottoApproach = "lit";
      if (next.activeExpedition) prepareMirrorPath(next.activeExpedition, selectedMirrorPath, next);
      selectedMirrorPath = "observe";
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
      if (expedition?.inputs?.destinationId === "village-forge:mirror-chamber" && expedition.inputs.villageMirrorPath === "counter" && state?.destinations?.some(item => item.id === "village-forge:mirror-chamber" && item.villageMirrorInscription)) {
        const gearId = "mirror-countershot-temporary";
        preparedState = { ...preparedState, equipment: [...preparedState.equipment, { id: gearId, name: "反射による先制", tags: ["ranged"] }] };
        preparedExpedition = { ...preparedExpedition, inputs: { ...preparedExpedition.inputs, equipmentIds: [...preparedExpedition.inputs.equipmentIds, gearId] } };
      }
      const report = decorateReport(baseResolve(preparedExpedition, preparedState), expedition);
      if (preparedExpedition !== expedition) {
        report.villagePreparation = preparation;
        report.log.unshift({ minute: 0, time: "", type: "village-preparation", text: preparation === "scout" ? "村の見張り隊が盗賊の動きを教えてくれた。" : "復興した村の物資庫で応急手当を整えた。", causes: ["village-preparation-" + preparation] });
      }
      rewardRevisit(state, report);
      rewardRestoredRoad(state, report);
      rewardMineDelve(report, expedition);
      rewardGrottoDetour(report, expedition);
      rewardMirrorPath(report, expedition);
      return report;
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithVillageChoice(state, report) {
      rewardRevisit(state, report);
      rewardRestoredRoad(state, report);
      const expedition = state && state.activeExpedition;
      const applied = baseApplyReport(state, report);
      discoverMirrorInscription(applied, report, expedition);
      discoverMirrorVault(applied, report, expedition);
      unlockFollowup(applied, report);
      restoreVillage(applied, report);
      upgradeVillageFromRoad(applied, report);
      syncStoredReport(applied, report);
      system.__villageBellRestoration = applied.destinations.find((item) => item.id === DESTINATION_ID)?.villageRestoration || null;
      system.__villageMirrorVault = Boolean(applied.destinations.find(item => item.id === "village-forge:mirror-chamber")?.villageMirrorVault);
      system.__villageMirrorInscription = Boolean(applied.destinations.find(item => item.id === "village-forge:mirror-chamber")?.villageMirrorInscription);
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
        rewardMineDelve(advanced.report, expedition);
        rewardGrottoDetour(advanced.report, expedition);
        rewardMirrorPath(advanced.report, expedition);
        discoverMirrorInscription(advanced.state, advanced.report, expedition);
        discoverMirrorVault(advanced.state, advanced.report, expedition);
        // advance() has already banked the base report; bank sidecar road loot once.
        if (advanced.report.outcome === "success" && Array.isArray(advanced.state.securedLoot)) {
          for (const routeLoot of advanced.report.loot.filter((item) => item && ["watch-road-medicine", "ore-trail-iron", "sealed-mine-star-ore", "sealed-mine-deep-crystal", "grotto-shadow-prism", "mirror-chamber-relic", "mirror-vault-essence"].includes(item.id))) {
            if (!advanced.state.securedLoot.some((item) => item.id === routeLoot.id && item.sourceExpeditionId === advanced.report.expeditionId)) {
              advanced.state.securedLoot.push({ ...routeLoot, sourceExpeditionId: advanced.report.expeditionId });
            }
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
      system.__villageMirrorVault = Boolean(advanced.state?.destinations?.find(item => item.id === "village-forge:mirror-chamber")?.villageMirrorVault);
      system.__villageMirrorInscription = Boolean(advanced.state?.destinations?.find(item => item.id === "village-forge:mirror-chamber")?.villageMirrorInscription);
      return advanced;
    };

    system.__villageBellInstalled = true;
    // UI checks the currently saved destination, refreshed on each state transition.
    const baseNormalize = system.normalizeState.bind(system);
    system.normalizeState = function normalizeWithVillageRestoration(input) {
      const next = baseNormalize(input);
      system.__villageBellRestoration = next.destinations.find((item) => item.id === DESTINATION_ID)?.villageRestoration || null;
      system.__villageBellFacility = next.destinations.find((item) => item.id === DESTINATION_ID)?.villageFacility || null;
      system.__villageMirrorInscription = Boolean(next.destinations.find(item => item.id === "village-forge:mirror-chamber")?.villageMirrorInscription);
      system.__villageMirrorVault = Boolean(next.destinations.find(item => item.id === "village-forge:mirror-chamber")?.villageMirrorVault);
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
    forgeMinePass,
    buildCrystalBeacon,
    revealMirrorChamber,
    prepareMineDelve,
    rewardMineDelve,
    prepareGrottoDetour,
    rewardGrottoDetour,
    prepareMirrorPath,
    rewardMirrorPath,
    discoverMirrorInscription,
    discoverMirrorVault,
    syncStoredReport,
    currentDestination,
    syncChoice,
    installSystemHooks,
    installUi,
    install,
  };
});