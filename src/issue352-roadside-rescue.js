(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessIssue352RoadsideRescue = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createIssue352RoadsideRescue() {
  "use strict";

  const STORAGE_KEY = "crownless.expedition-poc.v1";
  const INCIDENT_KEY = "issue352RoadsideRescue";
  const BANDIT_SIGNAL_SOURCE = "bandit-ambush";
  const BANDIT_DESTINATION_ID = "world:geo:signal:bandit-ambush";
  const MARCO_ID = "marco";
  const RESCUE_CAUSE = "marco-roadside-rescue";

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

  function coarseCellId(cell) {
    if (typeof cell === "string") return cell.trim();
    if (!cell || typeof cell !== "object") return "";
    return String(cell.id || cell.cellId || cell.key || "").trim();
  }

  function incidentFrom(state) {
    const value = state && state[INCIDENT_KEY];
    return value && typeof value === "object" ? value : null;
  }

  function ensureIncident(state) {
    if (!state || typeof state !== "object") return null;
    if (!incidentFrom(state)) {
      state[INCIDENT_KEY] = {
        signalSource: BANDIT_SIGNAL_SOURCE,
        stage: "sensed",
        anchorCellId: "",
        discoveredCellId: "",
        marcoStatus: "traveling",
        resolved: false
      };
    }
    return state[INCIDENT_KEY];
  }

  function recordScanProgress(stateInput, signalSource, currentCell, nowMs = Date.now()) {
    if (!stateInput || signalSource !== BANDIT_SIGNAL_SOURCE) return stateInput;
    const cellId = coarseCellId(currentCell);
    if (!cellId) return stateInput;
    const state = clone(stateInput);
    const incident = ensureIncident(state);
    if (incident.resolved) return state;
    if (!incident.anchorCellId) {
      incident.anchorCellId = cellId;
      incident.stage = "sensed";
      incident.lastObservedAt = Number(nowMs) || Date.now();
      return state;
    }
    if (cellId !== incident.anchorCellId && incident.stage === "sensed") {
      incident.discoveredCellId = cellId;
      incident.stage = "discovered";
      incident.marcoStatus = "missing";
      incident.discoveredAt = Number(nowMs) || Date.now();
      incident.lastObservedAt = incident.discoveredAt;
    }
    return state;
  }

  function effectiveStage(state, signalSource, fallback = "sensed") {
    if (signalSource !== BANDIT_SIGNAL_SOURCE) return fallback;
    const incident = incidentFrom(state);
    if (!incident || incident.resolved) return fallback;
    return incident.stage || fallback;
  }

  function isBanditReport(report) {
    return Boolean(report && report.destinationId === BANDIT_DESTINATION_ID && report.signalEncounter && report.signalEncounter.kind === "bandit-ambush");
  }

  function wasRescued(report) {
    const aid = report && report.signalEncounter && report.signalEncounter.aid;
    return Boolean(isBanditReport(report) && report.outcome === "success" && aid && aid.id === "bandit-repel-aid");
  }

  function decorateReport(report) {
    if (!isBanditReport(report)) return report;
    if (!Array.isArray(report.log)) report.log = [];
    const rescued = wasRescued(report);
    report.npcOutcome = {
      npcId: MARCO_ID,
      npcName: "マルコ",
      outcome: rescued ? "rescued" : "missing",
      text: rescued
        ? "盗賊を退けた先で、行方の分からなくなっていたマルコを見つけて救出した。"
        : "マルコの荷車の痕跡は残っているが、本人はまだ見つかっていない。"
    };
    if (!report.log.some((entry) => entry && entry.type === "npc-outcome" && Array.isArray(entry.causes) && entry.causes.includes(RESCUE_CAUSE))) {
      const nearby = report.log.at(-1);
      report.log.push({
        minute: Number.isFinite(nearby && nearby.minute) ? nearby.minute + 1 : 92,
        time: nearby && nearby.time || "",
        type: "npc-outcome",
        text: report.npcOutcome.text,
        causes: [RESCUE_CAUSE, MARCO_ID, rescued ? "rescued" : "still-missing"]
      });
      report.log.sort((a, b) => (Number(a && a.minute) || 0) - (Number(b && b.minute) || 0));
    }
    if (!Array.isArray(report.worldChanges)) report.worldChanges = [];
    const change = rescued
      ? "マルコを街道から救出した。灰炉で再会できる。"
      : "マルコは行方不明のまま。街道の異変はまだ終わっていない。";
    if (!report.worldChanges.includes(change)) report.worldChanges.push(change);
    return report;
  }

  function applyMarcoOutcome(state, report) {
    if (!state || !isBanditReport(report)) return state;
    const incident = ensureIncident(state);
    const rescued = wasRescued(report);
    incident.stage = rescued ? "resolved" : "discovered";
    incident.marcoStatus = rescued ? "recovered" : "missing";
    incident.resolved = rescued;
    incident.lastExpeditionId = report.expeditionId || "";
    incident.lastOutcome = rescued ? "rescued" : "missing";
    if (rescued) incident.resolvedAt = Date.now();
    decorateReport(report);
    return state;
  }

  function overlaySnapshot(snapshot, state) {
    const incident = incidentFrom(state);
    if (!incident || !Array.isArray(snapshot)) return snapshot;
    return snapshot.map((resident) => {
      if (!resident || resident.id !== MARCO_ID) return resident;
      if (incident.marcoStatus === "missing") {
        return Object.freeze({
          ...resident,
          location: "north-road",
          locationLabel: "北の街道",
          state: "missing",
          stateLabel: "行方不明",
          atHearth: false,
          activity: ""
        });
      }
      if (incident.marcoStatus === "recovered") {
        return Object.freeze({
          ...resident,
          location: "grey-hearth",
          locationLabel: "灰炉",
          state: "recovered",
          stateLabel: "救出済み",
          atHearth: true,
          activity: "救出され、炉端で休息中"
        });
      }
      return resident;
    });
  }

  function readState(root) {
    try {
      const raw = root && root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function writeState(root, state) {
    try {
      if (!root || !root.localStorage || !state) return false;
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) { return false; }
  }

  function installNpcOverlay(root) {
    const base = root && root.CrownlessNpcLife;
    if (!base || typeof base.snapshotAt !== "function" || root.__issue352NpcOverlayInstalled) return Boolean(base);
    const originalSnapshotAt = base.snapshotAt.bind(base);
    const states = Object.freeze({ ...(base.STATES || {}), MISSING: "missing", RECOVERED: "recovered" });
    root.CrownlessNpcLife = Object.freeze({
      ...base,
      STATES: states,
      snapshotAt(input) {
        return overlaySnapshot(originalSnapshotAt(input), readState(root));
      }
    });
    root.__issue352NpcOverlayInstalled = true;
    return true;
  }

  function installSystemHooks(root) {
    const system = root && root.CrownlessExpeditionSystem;
    if (!system || system.__issue352RoadsideRescueInstalled) return Boolean(system);

    const baseResolve = system.resolveExpedition.bind(system);
    system.resolveExpedition = function resolveWithMarcoRescue(expedition, state) {
      return decorateReport(baseResolve(expedition, state));
    };

    const baseApplyReport = system.applyReport.bind(system);
    system.applyReport = function applyReportWithMarcoRescue(state, report) {
      const applied = baseApplyReport(state, report);
      applyMarcoOutcome(applied, report);
      return applied;
    };

    const baseAdvance = system.advance.bind(system);
    system.advance = function advanceWithMarcoRescue(state, nowMs) {
      const advanced = baseAdvance(state, nowMs);
      if (advanced && advanced.report && advanced.state) applyMarcoOutcome(advanced.state, advanced.report);
      return advanced;
    };

    system.__issue352RoadsideRescueInstalled = true;
    return true;
  }

  function activeSignalSource(document) {
    const marker = document && document.querySelector(".world-atlas-nearby-marker--event-signal.active[data-atlas-signal-source]");
    return marker && marker.dataset ? String(marker.dataset.atlasSignalSource || "") : "";
  }

  function syncBanditDetail(root) {
    const document = root && root.document;
    if (!document) return;
    const state = readState(root);
    const stage = effectiveStage(state, BANDIT_SIGNAL_SOURCE, "sensed");
    const marker = document.querySelector('.world-atlas-nearby-marker--event-signal[data-atlas-signal-source="bandit-ambush"]');
    if (marker && marker.dataset) marker.dataset.signalStage = stage;
    const prompt = document.querySelector("[data-bandit-signal-expedition]");
    if (prompt && stage === "sensed") prompt.remove();
    if (prompt && stage !== "sensed") {
      prompt.firstChild && (prompt.firstChild.textContent = "痕跡を追って、街道を狙う盗賊の待ち伏せだと分かった。マルコの荷車も途切れている。");
    }
  }

  function installLocationProgress(root) {
    if (!root || root.__issue352LocationProgressInstalled) return false;
    root.addEventListener && root.addEventListener("crownless:world-knowledge-updated", (event) => {
      const detail = event && event.detail;
      if (!detail || detail.source !== "atlas-scan" || detail.state !== "ready") return;
      const source = activeSignalSource(root.document);
      if (source !== BANDIT_SIGNAL_SOURCE) return;
      const current = readState(root);
      if (!current) return;
      const next = recordScanProgress(current, source, detail.currentCell);
      if (writeState(root, next)) Promise.resolve().then(() => syncBanditDetail(root));
    });

    root.document && root.document.addEventListener("click", (event) => {
      const button = event && event.target && event.target.closest && event.target.closest(".world-atlas-npc-signal-match__dispatch");
      if (!button) return;
      const marker = root.document.querySelector(".world-atlas-nearby-marker--event-signal.active[data-atlas-signal-source]");
      const source = marker && marker.dataset && marker.dataset.atlasSignalSource;
      if (source !== BANDIT_SIGNAL_SOURCE) return;
      const stage = effectiveStage(readState(root), source, marker.dataset.signalStage || "sensed");
      if (stage !== "sensed") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const detail = button.closest(".world-atlas-detail");
      if (detail && !detail.querySelector("[data-issue352-walk-required]")) {
        const note = root.document.createElement("p");
        note.dataset.issue352WalkRequired = "true";
        note.textContent = "まだ遠征先を特定できない。現在地を一度記録し、別の粗い探索領域まで歩いてから周辺を調べ直して。";
        button.insertAdjacentElement("afterend", note);
      }
    }, true);

    if (root.MutationObserver && root.document && root.document.body) {
      const observer = new root.MutationObserver(() => syncBanditDetail(root));
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    root.__issue352LocationProgressInstalled = true;
    return true;
  }

  function install(root) {
    let attempts = 0;
    const sync = () => {
      attempts += 1;
      const a = installSystemHooks(root);
      const b = installNpcOverlay(root);
      const c = installLocationProgress(root);
      syncBanditDetail(root);
      if ((!a || !b || !c) && root && typeof root.setTimeout === "function" && attempts < 80) root.setTimeout(sync, 50);
    };
    sync();
    return true;
  }

  return Object.freeze({
    STORAGE_KEY,
    INCIDENT_KEY,
    BANDIT_SIGNAL_SOURCE,
    BANDIT_DESTINATION_ID,
    MARCO_ID,
    RESCUE_CAUSE,
    coarseCellId,
    incidentFrom,
    ensureIncident,
    recordScanProgress,
    effectiveStage,
    isBanditReport,
    wasRescued,
    decorateReport,
    applyMarcoOutcome,
    overlaySnapshot,
    installNpcOverlay,
    installSystemHooks,
    installLocationProgress,
    install
  });
});
