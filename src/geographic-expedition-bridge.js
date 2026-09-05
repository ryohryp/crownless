(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessGeographicExpeditionBridge = api;
  if (root && root.document) api.install(root.document, root.CrownlessCore, root.CrownlessExpeditionSystem, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createGeographicExpeditionBridge() {
  "use strict";

  const WORLD_DESTINATION_PREFIX = "world:";
  const DEFAULT_DURATION_MS = 3 * 60 * 1000;

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function terrainSet(entry) {
    return new Set(Array.isArray(entry && entry.terrain) ? entry.terrain.map((item) => cleanText(item)).filter(Boolean) : []);
  }

  function expeditionDestinationId(value) {
    const key = cleanText(value && typeof value === "object" ? value.key : value);
    return key ? `${WORLD_DESTINATION_PREFIX}${key}` : "";
  }

  function discoveryKeyFromDestinationId(value) {
    const id = cleanText(value);
    return id.startsWith(WORLD_DESTINATION_PREFIX) ? id.slice(WORLD_DESTINATION_PREFIX.length) : "";
  }

  function destinationFamily(entry) {
    const terrain = terrainSet(entry);
    if (entry && entry.contentKind === "dungeon") return "cave";
    if (terrain.has("height") || terrain.has("sacred")) return "cave";
    if (terrain.has("settlement") || terrain.has("road_hub") || terrain.has("crossing")) return "village";
    return "forest";
  }

  function destinationDangerTags(entry) {
    const terrain = terrainSet(entry);
    const tags = [];
    if (terrain.has("woods")) tags.push("beast", "thicket");
    if (terrain.has("settlement") || terrain.has("road_hub") || terrain.has("crossing")) tags.push("bandit");
    if (terrain.has("height") || terrain.has("sacred")) tags.push("collapse");
    if (terrain.has("water") || terrain.has("coast")) tags.push("wet-ground");
    if (!tags.length) tags.push(entry && entry.contentKind === "dungeon" ? "collapse" : "unknown");
    return [...new Set(tags)].slice(0, 3);
  }

  function destinationOpportunityTags(entry) {
    const terrain = terrainSet(entry);
    const tags = ["tracks"];
    if (terrain.has("woods")) tags.push("herbs");
    if (terrain.has("settlement") || terrain.has("road_hub")) tags.push("rumor", "salvage");
    if (terrain.has("height") || terrain.has("sacred") || entry && entry.contentKind === "dungeon") tags.push("relic", "ruin");
    if (terrain.has("water") || terrain.has("coast") || terrain.has("crossing")) tags.push("passage");
    return [...new Set(tags)].slice(0, 4);
  }

  function destinationFromKnowledge(entry) {
    if (!entry || typeof entry !== "object") return null;
    const id = expeditionDestinationId(entry);
    if (!id) return null;
    const family = destinationFamily(entry);
    const durationBonus = family === "cave" ? 2 * 60 * 1000 : family === "village" ? 60 * 1000 : 0;
    return {
      id,
      name: cleanText(entry.name, "名もない遠征先"),
      family,
      dangerTags: destinationDangerTags(entry),
      opportunityTags: destinationOpportunityTags(entry),
      durationMs: DEFAULT_DURATION_MS + durationBonus,
      discoveryKey: cleanText(entry.key),
      geographic: true
    };
  }

  function geographicKnowledgeEntries(Core) {
    if (!Core || typeof Core.loadSafeState !== "function") return [];
    const safe = Core.loadSafeState();
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return [];
    return Object.values(discoveries)
      .filter((entry) => entry && typeof entry === "object" && cleanText(entry.key).startsWith("geo:"))
      .sort((left, right) => (Number(right.firstDiscoveredAt) || 0) - (Number(left.firstDiscoveredAt) || 0));
  }

  function geographicDestinations(Core) {
    return geographicKnowledgeEntries(Core).map(destinationFromKnowledge).filter(Boolean);
  }

  function augmentStateWithGeographicDestination(system, Core, stateInput, destinationId) {
    if (!system || typeof system.normalizeState !== "function") return stateInput;
    const normalized = system.normalizeState(stateInput);
    if (!cleanText(destinationId).startsWith(WORLD_DESTINATION_PREFIX)) return normalized;
    if (normalized.destinations.some((item) => item && item.id === destinationId)) return normalized;
    const destination = geographicDestinations(Core).find((item) => item.id === destinationId);
    if (!destination) return normalized;
    return {
      ...normalized,
      destinations: [...normalized.destinations, destination],
      discoveredDestinationIds: [...new Set([...(normalized.discoveredDestinationIds || []), destination.id])]
    };
  }

  function geographicProgressForReport(report, entry) {
    if (!report || !entry) return null;
    const previousState = cleanText(entry.state, "discovered");
    const visits = Math.max(1, Math.floor(Number(entry.visits) || 1)) + 1;
    if (report.outcome !== "success") {
      return { state: previousState, visits, changed: false, summary: `${entry.name}の調査はまだ終わっていない。再び向かう理由が残った。` };
    }
    const hasDiscovery = Array.isArray(report.discoveries) && report.discoveries.length > 0;
    const nextState = previousState === "cleared" ? "cleared" : hasDiscovery ? "cleared" : "investigated";
    return {
      state: nextState,
      visits,
      changed: nextState !== previousState,
      summary: nextState === "cleared"
        ? `${entry.name}を踏破し、痕跡の先まで確かめた。`
        : `${entry.name}を調査し、火影の正体へ一歩近づいた。`
    };
  }

  function appendProgressToReport(report, progress) {
    if (!report || !progress || !progress.summary) return report;
    if (!Array.isArray(report.log)) report.log = [];
    if (!report.log.some((item) => item && item.type === "world-knowledge" && item.text === progress.summary)) {
      report.log.push({ minute: 111, type: "world-knowledge", text: progress.summary, tags: ["atlas", progress.state] });
    }
    report.worldKnowledgeProgress = { state: progress.state, summary: progress.summary };
    return report;
  }

  function dispatchWorldKnowledgeUpdated(root, detail) {
    if (!root || typeof root.dispatchEvent !== "function") return false;
    try {
      const EventCtor = root.CustomEvent || (typeof CustomEvent === "function" ? CustomEvent : null);
      if (EventCtor) root.dispatchEvent(new EventCtor("crownless:world-knowledge-updated", { detail }));
      else root.dispatchEvent({ type: "crownless:world-knowledge-updated", detail });
      return true;
    } catch (_) {
      return false;
    }
  }

  function applyGeographicReport(Core, report, root) {
    const key = discoveryKeyFromDestinationId(report && report.destinationId);
    if (!key.startsWith("geo:") || !Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") return null;
    const safe = Core.loadSafeState();
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    const entry = discoveries && discoveries[key];
    if (!entry) return null;
    const progress = geographicProgressForReport(report, entry);
    if (!progress) return null;
    entry.state = progress.state;
    entry.visits = progress.visits;
    const persisted = Core.saveWorldKnowledge(safe);
    appendProgressToReport(report, progress);
    if (persisted) dispatchWorldKnowledgeUpdated(root, { discoveryKey: key, state: progress.state, outcome: report.outcome });
    return { ...progress, discoveryKey: key, persisted };
  }

  function patchSystem(system, Core, root) {
    if (!system || system.__geographicExpeditionBridgePatched || typeof system.dispatchExpedition !== "function") return false;
    const originalDispatch = system.dispatchExpedition.bind(system);
    system.dispatchExpedition = function dispatchWithGeographicDestination(stateInput, input, nowMs) {
      const destinationId = cleanText(input && input.destinationId);
      const nextState = augmentStateWithGeographicDestination(system, Core, stateInput, destinationId);
      return originalDispatch(nextState, input, nowMs);
    };
    if (typeof system.advance === "function") {
      const originalAdvance = system.advance.bind(system);
      system.advance = function advanceWithGeographicProgress(stateInput, nowMs) {
        const advanced = originalAdvance(stateInput, nowMs);
        if (advanced && advanced.report) {
          applyGeographicReport(Core, advanced.report, root);
          // Earlier decorators may have cloned the report into history. Commit
          // the final geographic projection there too, so reopen tells the same story.
          const reports = advanced.state && advanced.state.completedReports;
          const index = Array.isArray(reports) ? reports.findIndex(r => r.expeditionId === advanced.report.expeditionId) : -1;
          if (index >= 0) reports[index] = JSON.parse(JSON.stringify(advanced.report));
        }
        return advanced;
      };
    }
    system.__geographicExpeditionBridgePatched = true;
    return true;
  }

  function destinationDescription(destination, entry) {
    const terrain = Array.isArray(entry && entry.terrain) && entry.terrain.length ? entry.terrain.join("・") : destination.family;
    return `GPS発見: ${terrain} / 約${Math.round(destination.durationMs / 60000)}分`;
  }

  function injectDestinationChoices(document, Core) {
    const form = document && document.querySelector("#expedition-folio-content form.expedition-prepare");
    if (!form) return 0;
    const first = form.querySelector('input[name="destination"]');
    const group = first && first.closest("fieldset");
    if (!group) return 0;
    const existing = new Set(Array.from(group.querySelectorAll('input[name="destination"]')).map((input) => input.value));
    const entries = geographicKnowledgeEntries(Core);
    let added = 0;
    entries.forEach((entry) => {
      const destination = destinationFromKnowledge(entry);
      if (!destination || existing.has(destination.id)) return;
      const label = document.createElement("label");
      label.className = "expedition-choice__item expedition-choice__item--geographic";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "destination";
      input.value = destination.id;
      const body = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = destination.name;
      const detail = document.createElement("small");
      detail.textContent = destinationDescription(destination, entry);
      body.append(title, detail);
      label.append(input, body);
      group.appendChild(label);
      existing.add(destination.id);
      added += 1;
    });
    return added;
  }

  function install(document, Core, system, root) {
    if (!document || !Core || !system || system.__geographicExpeditionBridgeInstalled) return false;
    patchSystem(system, Core, root);
    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(() => {
        scheduled = false;
        injectDestinationChoices(document, Core);
      });
    }
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    if (root && typeof root.addEventListener === "function") root.addEventListener("crownless:world-knowledge-updated", schedule);
    schedule();
    system.__geographicExpeditionBridgeInstalled = true;
    return true;
  }

  return {
    WORLD_DESTINATION_PREFIX,
    DEFAULT_DURATION_MS,
    expeditionDestinationId,
    discoveryKeyFromDestinationId,
    destinationFamily,
    destinationDangerTags,
    destinationOpportunityTags,
    destinationFromKnowledge,
    geographicKnowledgeEntries,
    geographicDestinations,
    augmentStateWithGeographicDestination,
    geographicProgressForReport,
    appendProgressToReport,
    applyGeographicReport,
    patchSystem,
    destinationDescription,
    injectDestinationChoices,
    install
  };
});
