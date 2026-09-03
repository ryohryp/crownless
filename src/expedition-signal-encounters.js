(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessExpeditionSignalEncounters = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createExpeditionSignalEncounters() {
  "use strict";

  const ROADSIDE_SIGNAL_SOURCE = "roadside-disturbance";
  const ROADSIDE_DISCOVERY_KEY = "geo:signal:roadside-disturbance";
  const ROADSIDE_DESTINATION_ID = `world:${ROADSIDE_DISCOVERY_KEY}`;
  const ROADSIDE_ENCOUNTER_ID = "roadside-injured-traveler";
  const ROADSIDE_HERB_AID_ID = "roadside-herb-aid";


  const BANDIT_SIGNAL_SOURCE = "bandit-ambush";
  const BANDIT_DISCOVERY_KEY = "geo:signal:bandit-ambush";
  const BANDIT_DESTINATION_ID = `world:${BANDIT_DISCOVERY_KEY}`;
  const BANDIT_ENCOUNTER_ID = "roadside-bandit-ambush";
  const BANDIT_REPEL_AID_ID = "bandit-repel-aid";

  const CAMPFIRE_SIGNAL_SOURCE = "suspicious-campfire";
  const CAMPFIRE_DISCOVERY_KEY = "geo:signal:suspicious-campfire";
  const CAMPFIRE_DESTINATION_ID = `world:${CAMPFIRE_DISCOVERY_KEY}`;
  const CAMPFIRE_ENCOUNTER_ID = "roadside-suspicious-campfire";
  const CAMPFIRE_INVESTIGATE_AID_ID = "campfire-investigate-aid";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function hasEquipment(expedition, equipmentId) {
    const ids = expedition && expedition.inputs && Array.isArray(expedition.inputs.equipmentIds)
      ? expedition.inputs.equipmentIds
      : [];
    return ids.includes(equipmentId);
  }

  function ensureRoadsideDiscovery(root, nowMs = Date.now()) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") return null;
    try {
      const state = Core.loadSafeState();
      if (!state || typeof state !== "object") return null;
      if (typeof Core.sanitizeWorldKnowledge === "function") state.worldKnowledge = Core.sanitizeWorldKnowledge(state.worldKnowledge);
      else if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
      if (!state.worldKnowledge.discoveries || typeof state.worldKnowledge.discoveries !== "object" || Array.isArray(state.worldKnowledge.discoveries)) {
        state.worldKnowledge.discoveries = {};
      }
      const existing = state.worldKnowledge.discoveries[ROADSIDE_DISCOVERY_KEY];
      if (existing && typeof existing === "object") return existing;
      const entry = {
        key: ROADSIDE_DISCOVERY_KEY,
        name: "街道の異変",
        baseTitle: "街道の方から断続的な物音がする。何が起きているかは、まだ分からない。",
        terrain: ["road_hub"],
        contentKind: "signal",
        state: "discovered",
        firstDiscoveredAt: Number(nowMs) || Date.now(),
        visits: 1
      };
      state.worldKnowledge.discoveries[ROADSIDE_DISCOVERY_KEY] = entry;
      return Core.saveWorldKnowledge(state) ? entry : null;
    } catch (_) {
      return null;
    }
  }

  function ensureBanditDiscovery(root, nowMs = Date.now()) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") return null;
    try {
      const state = Core.loadSafeState();
      if (!state || typeof state !== "object") return null;
      if (typeof Core.sanitizeWorldKnowledge === "function") state.worldKnowledge = Core.sanitizeWorldKnowledge(state.worldKnowledge);
      else if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
      if (!state.worldKnowledge.discoveries || typeof state.worldKnowledge.discoveries !== "object" || Array.isArray(state.worldKnowledge.discoveries)) {
        state.worldKnowledge.discoveries = {};
      }
      const existing = state.worldKnowledge.discoveries[BANDIT_DISCOVERY_KEY];
      if (existing && typeof existing === "object") return existing;
      const entry = {
        key: BANDIT_DISCOVERY_KEY,
        name: "街道の物陰",
        baseTitle: "街道の茂みから金属音がする。何者かが潜んでいるかもしれない。",
        terrain: ["road_hub", "woods"],
        contentKind: "signal",
        state: "discovered",
        firstDiscoveredAt: Number(nowMs) || Date.now(),
        visits: 1
      };
      state.worldKnowledge.discoveries[BANDIT_DISCOVERY_KEY] = entry;
      return Core.saveWorldKnowledge(state) ? entry : null;
    } catch (_) {
      return null;
    }
  }

  function ensureCampfireDiscovery(root, nowMs = Date.now()) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") return null;
    try {
      const state = Core.loadSafeState();
      if (!state || typeof state !== "object") return null;
      if (typeof Core.sanitizeWorldKnowledge === "function") state.worldKnowledge = Core.sanitizeWorldKnowledge(state.worldKnowledge);
      else if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
      if (!state.worldKnowledge.discoveries || typeof state.worldKnowledge.discoveries !== "object" || Array.isArray(state.worldKnowledge.discoveries)) {
        state.worldKnowledge.discoveries = {};
      }
      const existing = state.worldKnowledge.discoveries[CAMPFIRE_DISCOVERY_KEY];
      if (existing && typeof existing === "object") return existing;
      const entry = {
        key: CAMPFIRE_DISCOVERY_KEY,
        name: "暗がりの火影",
        baseTitle: "夜陰に紛れて小さな火が揺れている。誰かの野営だろうか。",
        terrain: ["road_hub", "settlement"],
        contentKind: "signal",
        state: "discovered",
        firstDiscoveredAt: Number(nowMs) || Date.now(),
        visits: 1
      };
      state.worldKnowledge.discoveries[CAMPFIRE_DISCOVERY_KEY] = entry;
      return Core.saveWorldKnowledge(state) ? entry : null;
    } catch (_) {
      return null;
    }
  }

  function openRoadsideExpedition(document, root) {
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!Actions || typeof Actions.openExpedition !== "function") return false;
    const entry = ensureRoadsideDiscovery(root);
    if (!entry) return false;
    return Actions.openExpedition(document, root, entry, null) === true;
  }

  function openBanditExpedition(document, root) {
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!Actions || typeof Actions.openExpedition !== "function") return false;
    const entry = ensureBanditDiscovery(root);
    if (!entry) return false;
    return Actions.openExpedition(document, root, entry, null) === true;
  }

  function openCampfireExpedition(document, root) {
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!Actions || typeof Actions.openExpedition !== "function") return false;
    const entry = ensureCampfireDiscovery(root);
    if (!entry) return false;
    return Actions.openExpedition(document, root, entry, null) === true;
  }

  function openSignalExpedition(document, root, signalSource) {
    if (signalSource === BANDIT_SIGNAL_SOURCE) return openBanditExpedition(document, root);
    if (signalSource === CAMPFIRE_SIGNAL_SOURCE) return openCampfireExpedition(document, root);
    return openRoadsideExpedition(document, root);
  }

  function ensureRoadsideAction(document, root) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail || detail.querySelector("[data-roadside-signal-expedition]")) return false;
    const note = Array.from(detail.querySelectorAll("small, strong, span, em, p")).some((node) => /異変の気配|街道の方から騒がしい気配|負傷者/.test(cleanText(node && node.textContent)));
    if (!note) return false;

    const prompt = document.createElement("p");
    prompt.className = "world-atlas-npc-signal-match";
    prompt.dataset.roadsideSignalExpedition = "true";
    prompt.textContent = "正体は分からない。近づく代わりに、遠征隊を送って確かめられる。";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-atlas-npc-signal-match__open world-atlas-npc-signal-match__dispatch";
    button.textContent = "異変へ遠征隊を送る";
    button.addEventListener("click", () => openRoadsideExpedition(document, root));
    prompt.appendChild(button);
    detail.appendChild(prompt);
    return true;
  }

  function ensureBanditAction(document, root) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail || detail.querySelector("[data-bandit-signal-expedition]")) return false;
    const note = Array.from(detail.querySelectorAll("small, strong, span, em, p")).some((node) => /不穏な気配|街道の茂みから不穏な物音|盗賊/.test(cleanText(node && node.textContent)));
    if (!note) return false;

    const prompt = document.createElement("p");
    prompt.className = "world-atlas-npc-signal-match";
    prompt.dataset.banditSignalExpedition = "true";
    prompt.textContent = "盗賊が潜んでいる。遠征隊を送って討伐・安全確保できる。";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-atlas-npc-signal-match__open world-atlas-npc-signal-match__dispatch";
    button.textContent = "物陰へ遠征隊を送る";
    button.addEventListener("click", () => openBanditExpedition(document, root));
    prompt.appendChild(button);
    detail.appendChild(prompt);
    return true;
  }

  function ensureCampfireAction(document, root) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail || detail.querySelector("[data-campfire-signal-expedition]")) return false;
    const note = Array.from(detail.querySelectorAll("small, strong, span, em, p")).some((node) => /遠くの火影|暗がりに揺れる火影|焚き火/.test(cleanText(node && node.textContent)));
    if (!note) return false;

    const prompt = document.createElement("p");
    prompt.className = "world-atlas-npc-signal-match";
    prompt.dataset.campfireSignalExpedition = "true";
    prompt.textContent = "夜陰の火影だ。遠征隊を送って調査できる。";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-atlas-npc-signal-match__open world-atlas-npc-signal-match__dispatch";
    button.textContent = "火影へ遠征隊を送る";
    button.addEventListener("click", () => openCampfireExpedition(document, root));
    prompt.appendChild(button);
    detail.appendChild(prompt);
    return true;
  }

  function qualifiesForRoadsideEncounter(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    const destinationId = cleanText(expedition.inputs.destinationId, cleanText(report.destinationId));
    return report.outcome === "success" && destinationId === ROADSIDE_DESTINATION_ID;
  }

  function qualifiesForBanditEncounter(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    const destinationId = cleanText(expedition.inputs.destinationId, cleanText(report.destinationId));
    return report.outcome === "success" && destinationId === BANDIT_DESTINATION_ID;
  }

  function qualifiesForCampfireEncounter(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    const destinationId = cleanText(expedition.inputs.destinationId, cleanText(report.destinationId));
    return report.outcome === "success" && destinationId === CAMPFIRE_DESTINATION_ID;
  }

  function applyRoadsideEncounter(report, expedition) {
    if (!qualifiesForRoadsideEncounter(report, expedition)) return report;
    if (!report.signalEncounter) {
      report.signalEncounter = {
        id: ROADSIDE_ENCOUNTER_ID,
        kind: "injured-traveler",
        signalSource: ROADSIDE_SIGNAL_SOURCE
      };
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes(ROADSIDE_ENCOUNTER_ID))) {
      const nearby = report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 90,
        time: nearby && nearby.time || "",
        type: "signal-encounter",
        text: "物音の正体は、街道脇で動けなくなっていた負傷した旅人だった。遠征隊は居場所を確かめ、帰還報告へ記した。",
        causes: [ROADSIDE_ENCOUNTER_ID, "injured-traveler", "roadside-signal"]
      });
    }

    if (hasEquipment(expedition, "herb-kit")) {
      report.signalEncounter.aid = {
        id: ROADSIDE_HERB_AID_ID,
        equipmentId: "herb-kit",
        outcome: "stabilized"
      };
      if (!report.log.some((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(ROADSIDE_HERB_AID_ID))) {
        const encounterEntry = report.log.find((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes(ROADSIDE_ENCOUNTER_ID));
        report.log.push({
          minute: Number.isFinite(encounterEntry && encounterEntry.minute) ? encounterEntry.minute + 1 : 91,
          time: encounterEntry && encounterEntry.time || "",
          type: "signal-aid",
          text: "備えていた薬草包みで旅人を応急手当した。遠征前の備えが、発見だけで終わらず救助につながった。",
          causes: [ROADSIDE_HERB_AID_ID, "herb-kit", "injured-traveler", "stabilized"]
        });
      }
      report.notableEvent = report.log.find((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(ROADSIDE_HERB_AID_ID)) || report.notableEvent;
    }

    report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    return report;
  }

  function applyBanditEncounter(report, expedition) {
    if (!qualifiesForBanditEncounter(report, expedition)) return report;
    if (!report.signalEncounter) {
      report.signalEncounter = {
        id: BANDIT_ENCOUNTER_ID,
        kind: "bandit-ambush",
        signalSource: BANDIT_SIGNAL_SOURCE
      };
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_ENCOUNTER_ID))) {
      const nearby = report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 90,
        time: nearby && nearby.time || "",
        type: "signal-encounter",
        text: "街道の物陰から盗賊が現れた。遠征隊は交戦し、盗賊を撃退して街道の安全を確保した。",
        causes: [BANDIT_ENCOUNTER_ID, "bandit-ambush", "roadside-signal"]
      });
    }

    const hasWeapon = hasEquipment(expedition, "shortbow") || hasEquipment(expedition, "iron-blade") || hasEquipment(expedition, "spear")
      || (Array.isArray(expedition.inputs && expedition.inputs.companionIds) && expedition.inputs.companionIds.includes("edgar"));

    if (hasWeapon) {
      report.signalEncounter.aid = {
        id: BANDIT_REPEL_AID_ID,
        outcome: "repelled"
      };
      if (!report.log.some((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_REPEL_AID_ID))) {
        const encounterEntry = report.log.find((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_ENCOUNTER_ID));
        report.log.push({
          minute: Number.isFinite(encounterEntry && encounterEntry.minute) ? encounterEntry.minute + 1 : 91,
          time: encounterEntry && encounterEntry.time || "",
          type: "signal-aid",
          text: "備えていた武器と武勇で盗賊を完全に打ち負かした。街道の安全を取り戻し、戦利品を回収した。",
          causes: [BANDIT_REPEL_AID_ID, "bandit-repelled", "stabilized"]
        });
      }
      report.notableEvent = report.log.find((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(BANDIT_REPEL_AID_ID)) || report.notableEvent;
      if (!Array.isArray(report.loot)) report.loot = [];
      if (!report.loot.some((item) => item && item.id === "iron-scrap")) {
        report.loot.push({ id: "iron-scrap", name: "鉄屑", count: 1 });
      }
    }

    report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    return report;
  }

  function applyCampfireEncounter(report, expedition) {
    if (!qualifiesForCampfireEncounter(report, expedition)) return report;
    if (!report.signalEncounter) {
      report.signalEncounter = {
        id: CAMPFIRE_ENCOUNTER_ID,
        kind: "suspicious-campfire",
        signalSource: CAMPFIRE_SIGNAL_SOURCE
      };
    }
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes(CAMPFIRE_ENCOUNTER_ID))) {
      const nearby = report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 90,
        time: nearby && nearby.time || "",
        type: "signal-encounter",
        text: "暗がりの火影を追った遠征隊は、古い焚き火の跡から石片を見つけ出した。",
        causes: [CAMPFIRE_ENCOUNTER_ID, "suspicious-campfire", "roadside-signal"]
      });
    }

    report.signalEncounter.aid = {
      id: CAMPFIRE_INVESTIGATE_AID_ID,
      outcome: "clue-found"
    };
    if (!report.log.some((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(CAMPFIRE_INVESTIGATE_AID_ID))) {
      const encounterEntry = report.log.find((entry) => entry && entry.type === "signal-encounter" && Array.isArray(entry.causes) && entry.causes.includes(CAMPFIRE_ENCOUNTER_ID));
      report.log.push({
        minute: Number.isFinite(encounterEntry && encounterEntry.minute) ? encounterEntry.minute + 1 : 91,
        time: encounterEntry && encounterEntry.time || "",
        type: "signal-aid",
        text: "夜陰の焚き火跡の灰から、失われた遺構の印が刻まれた古い石片を回収した。",
        causes: [CAMPFIRE_INVESTIGATE_AID_ID, "relic-clue", "stabilized"]
      });
    }
    report.notableEvent = report.log.find((entry) => entry && entry.type === "signal-aid" && Array.isArray(entry.causes) && entry.causes.includes(CAMPFIRE_INVESTIGATE_AID_ID)) || report.notableEvent;
    if (!Array.isArray(report.loot)) report.loot = [];
    if (!report.loot.some((item) => item && item.id === "ancient-stone-fragment")) {
      report.loot.push({ id: "ancient-stone-fragment", name: "刻印のある石片", count: 1 });
    }

    report.log.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    return report;
  }

  function applySignalEncounters(report, expedition) {
    applyRoadsideEncounter(report, expedition);
    applyBanditEncounter(report, expedition);
    applyCampfireEncounter(report, expedition);
    return report;
  }

  function resolveDirectEncounter(root, signalSource, nowMs = Date.now()) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") {
      return { success: false, message: "処理に失敗した。" };
    }
    try {
      const state = Core.loadSafeState();
      if (!state || typeof state !== "object") return { success: false, message: "状態の読み込みに失敗した。" };
      if (!state.worldKnowledge || typeof state.worldKnowledge !== "object") state.worldKnowledge = { discoveries: {} };
      if (!state.worldKnowledge.discoveries) state.worldKnowledge.discoveries = {};

      if (signalSource === ROADSIDE_SIGNAL_SOURCE) {
        ensureRoadsideDiscovery(root, nowMs);
        const fresh = Core.loadSafeState();
        if (fresh && fresh.worldKnowledge && fresh.worldKnowledge.discoveries && fresh.worldKnowledge.discoveries[ROADSIDE_DISCOVERY_KEY]) {
          fresh.worldKnowledge.discoveries[ROADSIDE_DISCOVERY_KEY].resolved = true;
          fresh.worldKnowledge.discoveries[ROADSIDE_DISCOVERY_KEY].resolvedAt = Number(nowMs) || Date.now();
          Core.saveWorldKnowledge(fresh);
        }
        return {
          success: true,
          outcome: "rescued",
          message: "街道脇の旅人に応急手当を行い、安全な場所へ避難させた。旅人は感謝の言葉を残した。"
        };
      }

      if (signalSource === BANDIT_SIGNAL_SOURCE) {
        ensureBanditDiscovery(root, nowMs);
        const fresh = Core.loadSafeState();
        if (fresh && fresh.worldKnowledge && fresh.worldKnowledge.discoveries && fresh.worldKnowledge.discoveries[BANDIT_DISCOVERY_KEY]) {
          fresh.worldKnowledge.discoveries[BANDIT_DISCOVERY_KEY].resolved = true;
          fresh.worldKnowledge.discoveries[BANDIT_DISCOVERY_KEY].resolvedAt = Number(nowMs) || Date.now();
          Core.saveWorldKnowledge(fresh);
        }
        return {
          success: true,
          outcome: "repelled",
          message: "身構えて街道の盗賊を撃退した。街道の安全を取り戻し、戦利品を回収した。"
        };
      }

      if (signalSource === CAMPFIRE_SIGNAL_SOURCE) {
        ensureCampfireDiscovery(root, nowMs);
        const fresh = Core.loadSafeState();
        if (fresh && fresh.worldKnowledge && fresh.worldKnowledge.discoveries && fresh.worldKnowledge.discoveries[CAMPFIRE_DISCOVERY_KEY]) {
          fresh.worldKnowledge.discoveries[CAMPFIRE_DISCOVERY_KEY].resolved = true;
          fresh.worldKnowledge.discoveries[CAMPFIRE_DISCOVERY_KEY].resolvedAt = Number(nowMs) || Date.now();
          Core.saveWorldKnowledge(fresh);
        }
        return {
          success: true,
          outcome: "investigated",
          message: "焚き火の灰の中から、失われた遺構の印が刻まれた古い石片を発見した。"
        };
      }

      return { success: false, message: "未知のシグナルだ。" };
    } catch (_) {
      return { success: false, message: "処理中に例外が発生した。" };
    }
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__signalEncountersInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithSignalEncounter(expedition, state) {
      return applySignalEncounters(baseResolve(expedition, state), expedition);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithSignalEncounter(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) applySignalEncounters(advanced.report, expedition);
      return advanced;
    };

    system.__signalEncountersInstalled = true;
    return true;
  }

  function install(document, root) {
    if (!document || !root || root.__expeditionSignalEncountersInstalled) return false;
    root.__expeditionSignalEncountersInstalled = true;
    installSystemHooks(root);
    document.addEventListener("click", (event) => {
      const marker = event && event.target && typeof event.target.closest === "function"
        ? event.target.closest("[data-atlas-signal-source]")
        : null;
      if (!marker) return;
      const source = marker.dataset.atlasSignalSource;
      if (source === ROADSIDE_SIGNAL_SOURCE) {
        Promise.resolve().then(() => ensureRoadsideAction(document, root));
      } else if (source === BANDIT_SIGNAL_SOURCE) {
        Promise.resolve().then(() => ensureBanditAction(document, root));
      } else if (source === CAMPFIRE_SIGNAL_SOURCE) {
        Promise.resolve().then(() => ensureCampfireAction(document, root));
      }
    });
    return true;
  }

  return {
    ROADSIDE_SIGNAL_SOURCE,
    ROADSIDE_DISCOVERY_KEY,
    ROADSIDE_DESTINATION_ID,
    ROADSIDE_ENCOUNTER_ID,
    ROADSIDE_HERB_AID_ID,
    BANDIT_SIGNAL_SOURCE,
    BANDIT_DISCOVERY_KEY,
    BANDIT_DESTINATION_ID,
    BANDIT_ENCOUNTER_ID,
    BANDIT_REPEL_AID_ID,
    CAMPFIRE_SIGNAL_SOURCE,
    CAMPFIRE_DISCOVERY_KEY,
    CAMPFIRE_DESTINATION_ID,
    CAMPFIRE_ENCOUNTER_ID,
    CAMPFIRE_INVESTIGATE_AID_ID,
    ensureRoadsideDiscovery,
    ensureBanditDiscovery,
    ensureCampfireDiscovery,
    openRoadsideExpedition,
    openBanditExpedition,
    openCampfireExpedition,
    openSignalExpedition,
    ensureRoadsideAction,
    ensureBanditAction,
    ensureCampfireAction,
    qualifiesForRoadsideEncounter,
    qualifiesForBanditEncounter,
    qualifiesForCampfireEncounter,
    applyRoadsideEncounter,
    applyBanditEncounter,
    applyCampfireEncounter,
    applySignalEncounters,
    resolveDirectEncounter,
    installSystemHooks,
    install
  };
});
