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

  function openRoadsideExpedition(document, root) {
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!Actions || typeof Actions.openExpedition !== "function") return false;
    const entry = ensureRoadsideDiscovery(root);
    if (!entry) return false;
    return Actions.openExpedition(document, root, entry, null) === true;
  }

  function ensureRoadsideAction(document, root) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail || detail.querySelector("[data-roadside-signal-expedition]")) return false;
    const note = Array.from(detail.querySelectorAll("small, strong, span, em, p")).some((node) => /異変の気配|街道の方から騒がしい気配/.test(cleanText(node && node.textContent)));
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

  function qualifiesForRoadsideEncounter(report, expedition) {
    if (!report || !expedition || !expedition.inputs) return false;
    const destinationId = cleanText(expedition.inputs.destinationId, cleanText(report.destinationId));
    return report.outcome === "success" && destinationId === ROADSIDE_DESTINATION_ID;
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

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__signalEncountersInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithSignalEncounter(expedition, state) {
      return applyRoadsideEncounter(baseResolve(expedition, state), expedition);
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithSignalEncounter(state, nowMs) {
      const expedition = state && state.activeExpedition;
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && expedition) applyRoadsideEncounter(advanced.report, expedition);
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
      if (!marker || marker.dataset.atlasSignalSource !== ROADSIDE_SIGNAL_SOURCE) return;
      Promise.resolve().then(() => ensureRoadsideAction(document, root));
    });
    return true;
  }

  return {
    ROADSIDE_SIGNAL_SOURCE,
    ROADSIDE_DISCOVERY_KEY,
    ROADSIDE_DESTINATION_ID,
    ROADSIDE_ENCOUNTER_ID,
    ROADSIDE_HERB_AID_ID,
    ensureRoadsideDiscovery,
    openRoadsideExpedition,
    ensureRoadsideAction,
    qualifiesForRoadsideEncounter,
    applyRoadsideEncounter,
    installSystemHooks,
    install
  };
});
