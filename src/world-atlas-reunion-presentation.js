(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasReunionPresentation = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasReunionPresentation() {
  "use strict";

  const EXPEDITION_STORAGE_KEY = "crownless.expedition-poc.v1";

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function safeState(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return null;
    try { return Core.loadSafeState(); } catch (_) { return null; }
  }

  function reunionForEntry(root, entry, now = new Date()) {
    const key = cleanText(entry && entry.key);
    const NpcLife = root && root.CrownlessNpcLife;
    const Encounter = root && root.CrownlessNpcReunionEncounter;
    if (!key || !NpcLife || typeof NpcLife.snapshotAt !== "function" || !Encounter || typeof Encounter.encounterAtDiscovery !== "function") return null;
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;
    return Encounter.encounterAtDiscovery(NpcLife.snapshotAt(now), discoveries, key);
  }

  function reunionClueForEntry(root, entry, now = new Date()) {
    const reunion = reunionForEntry(root, entry, now);
    const Actions = root && root.CrownlessDiscoveryActions;
    if (!reunion || !Actions || typeof Actions.buildLocalEvent !== "function") return null;
    const eventModel = Actions.buildLocalEvent(entry);
    const hook = cleanText(eventModel && eventModel.hook);
    if (!hook) return null;
    return Object.freeze({
      npcId: reunion.npcId,
      npcName: reunion.npcName,
      eventId: cleanText(eventModel && eventModel.id),
      eventTitle: cleanText(eventModel && eventModel.title),
      text: `${reunion.npcName}はこの辺りの話を教えてくれた。「${hook}」`
    });
  }

  function reunionRecordKey(encounter) {
    const npcId = cleanText(encounter && encounter.npcId);
    const discoveryKey = cleanText(encounter && encounter.discoveryKey);
    return npcId && discoveryKey ? `${npcId}|${discoveryKey}` : "";
  }

  function reunionRecord(root, encounter) {
    const key = reunionRecordKey(encounter);
    if (!key) return null;
    const safe = safeState(root);
    const reunions = safe && safe.npcLife && safe.npcLife.reunions;
    if (!reunions || typeof reunions !== "object" || Array.isArray(reunions)) return null;
    const record = reunions[key];
    if (!record || typeof record !== "object") return null;
    if (cleanText(record.npcId) !== cleanText(encounter.npcId)) return null;
    if (cleanText(record.discoveryKey) !== cleanText(encounter.discoveryKey)) return null;
    return Object.freeze({
      npcId: cleanText(record.npcId),
      discoveryKey: cleanText(record.discoveryKey),
      firstReunitedAt: Math.max(0, Number(record.firstReunitedAt) || 0)
    });
  }

  function recordReunion(root, encounter, now = Date.now()) {
    const Core = root && root.CrownlessCore;
    const key = reunionRecordKey(encounter);
    if (!key || !Core || typeof Core.loadSafeState !== "function" || typeof Core.saveSafeState !== "function") {
      return Object.freeze({ added: false, persisted: false, record: null });
    }
    const safe = safeState(root);
    if (!safe || typeof safe !== "object") return Object.freeze({ added: false, persisted: false, record: null });
    if (!safe.npcLife || typeof safe.npcLife !== "object" || Array.isArray(safe.npcLife)) safe.npcLife = {};
    if (!safe.npcLife.reunions || typeof safe.npcLife.reunions !== "object" || Array.isArray(safe.npcLife.reunions)) safe.npcLife.reunions = {};

    const existing = safe.npcLife.reunions[key];
    if (existing && typeof existing === "object") {
      return Object.freeze({
        added: false,
        persisted: true,
        record: Object.freeze({
          npcId: cleanText(existing.npcId),
          discoveryKey: cleanText(existing.discoveryKey),
          firstReunitedAt: Math.max(0, Number(existing.firstReunitedAt) || 0)
        })
      });
    }

    const timestamp = Number(now instanceof Date ? now.getTime() : now);
    const record = {
      npcId: cleanText(encounter.npcId),
      discoveryKey: cleanText(encounter.discoveryKey),
      firstReunitedAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
    };
    safe.npcLife.reunions[key] = record;
    let persisted = false;
    try { persisted = Core.saveSafeState(safe) === true; } catch (_) { persisted = false; }
    return Object.freeze({ added: persisted, persisted, record: persisted ? Object.freeze({ ...record }) : null });
  }

  function expeditionState(root) {
    const System = root && root.CrownlessExpeditionSystem;
    const storage = root && root.localStorage;
    if (!System || typeof System.normalizeState !== "function" || !storage || typeof storage.getItem !== "function") return null;
    try {
      return System.normalizeState(JSON.parse(storage.getItem(EXPEDITION_STORAGE_KEY) || "null"));
    } catch (_) {
      return null;
    }
  }

  function reunionForExpeditionReport(root, report) {
    const NpcLife = root && root.CrownlessNpcLife;
    const Encounter = root && root.CrownlessNpcReunionEncounter;
    const state = expeditionState(root);
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!report || !state || !NpcLife || typeof NpcLife.snapshotAt !== "function" || !Encounter || typeof Encounter.encounterForExpedition !== "function") return null;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;
    const completedAt = Number(report.completedAt);
    if (!Number.isFinite(completedAt) || completedAt <= 0) return null;
    return Encounter.encounterForExpedition(
      NpcLife.snapshotAt(new Date(completedAt)),
      discoveries,
      state,
      { inputs: { destinationId: cleanText(report.destinationId) } }
    );
  }

  function expeditionReportReunion(root, report) {
    const state = expeditionState(root);
    const encounter = reunionForExpeditionReport(root, report);
    if (!state || !encounter) return null;
    const latest = Array.isArray(state.completedReports) && state.completedReports[0] && cleanText(state.completedReports[0].expeditionId) === cleanText(report.expeditionId);
    let record = reunionRecord(root, encounter);
    if (!record && latest) record = recordReunion(root, encounter, report.completedAt).record;
    if (!record) return null;
    return Object.freeze({ encounter, record, latest });
  }

  function latestExpeditionReport(root) {
    const state = expeditionState(root);
    return state && Array.isArray(state.completedReports) ? state.completedReports[0] || null : null;
  }

  function syncLatestExpeditionReunion(root) {
    const report = latestExpeditionReport(root);
    return report ? expeditionReportReunion(root, report) : null;
  }

  function reportForFolio(document, root) {
    const summary = document && document.querySelector && document.querySelector("#expedition-folio-content [data-expedition-summary]");
    if (!summary) return null;
    const state = expeditionState(root);
    if (!state || !Array.isArray(state.completedReports) || !state.completedReports.length) return null;
    const history = document.querySelector("#expedition-folio-content .expedition-report-history select");
    const expeditionId = cleanText(history && history.value) || cleanText(state.completedReports[0].expeditionId);
    return state.completedReports.find((report) => cleanText(report && report.expeditionId) === expeditionId) || null;
  }

  function npcInteractionApi(root) {
    if (root && root.CrownlessNpcInteraction) return root.CrownlessNpcInteraction;
    if (typeof require === "function") {
      try { return require("./npc-interaction.js"); } catch (_) {}
    }
    return null;
  }

  function createInteractionPanel(document, root, reunion, report) {
    const Interaction = npcInteractionApi(root);
    const container = document.createElement("div");
    container.className = "npc-interaction-panel";
    container.dataset.npcId = reunion.encounter.npcId;

    if (!Interaction || typeof Interaction.getAvailableActions !== "function") {
      return container;
    }

    const completedAt = Number(report && report.completedAt) || Date.now();
    const context = {
      npcId: reunion.encounter.npcId,
      npcName: reunion.encounter.npcName,
      location: reunion.encounter.location,
      locationLabel: reunion.encounter.locationLabel,
      destinationName: reunion.encounter.destinationName,
      discoveryKey: reunion.encounter.discoveryKey,
      isHearth: false,
      hour: new Date(completedAt).getHours(),
      reunionCount: reunion.record ? 1 : 1
    };

    const actions = Interaction.getAvailableActions(context);
    if (!actions || !actions.length) return container;

    const actionRow = document.createElement("div");
    actionRow.className = "npc-interaction-actions";
    actionRow.setAttribute("role", "group");
    actionRow.setAttribute("aria-label", `${reunion.encounter.npcName}との対話`);

    const output = document.createElement("div");
    output.className = "npc-interaction-output";
    output.setAttribute("role", "status");
    output.setAttribute("aria-live", "polite");

    actions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "npc-interaction-btn";
      btn.dataset.action = action.id;
      btn.textContent = action.label;

      btn.addEventListener("click", () => {
        const safe = safeState(root);
        const outcome = Interaction.resolveAction(action.id, context, safe);
        output.replaceChildren();

        const block = document.createElement("blockquote");
        block.className = `npc-interaction-dialogue npc-topic-${outcome.topic || "general"}`;
        const speaker = document.createElement("strong");
        speaker.textContent = action.id === "ask-info" ? `${outcome.npcName}（情報）` : outcome.npcName;
        const speech = document.createElement("span");
        speech.textContent = `「${outcome.text}」`;
        block.append(speaker, speech);
        output.appendChild(block);

        if (outcome.isComplete) {
          const finished = document.createElement("small");
          finished.className = "npc-interaction-finished";
          finished.textContent = "会話を終えた。";
          output.appendChild(finished);
          actionRow.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        }
      });

      actionRow.appendChild(btn);
    });

    container.append(actionRow, output);
    return container;
  }

  function syncExpeditionReunion(document, root) {
    syncLatestExpeditionReunion(root);
    const summary = document && document.querySelector && document.querySelector("#expedition-folio-content [data-expedition-summary]");
    const existing = document && document.querySelector && document.querySelector("#expedition-folio-content .expedition-reunion-note");
    if (!summary) {
      if (existing) existing.remove();
      return false;
    }
    const report = reportForFolio(document, root);
    const reunion = expeditionReportReunion(root, report);
    if (!reunion) {
      if (existing) existing.remove();
      return false;
    }
    if (existing && existing.dataset.expeditionId === cleanText(report.expeditionId)) {
      return true;
    }
    if (existing) existing.remove();

    const note = document.createElement("section");
    note.className = "expedition-reunion-note";
    note.dataset.expeditionId = cleanText(report.expeditionId);
    note.dataset.npcId = reunion.encounter.npcId;

    const message = document.createElement("p");
    message.className = "expedition-reunion-message";
    message.textContent = `再会 / ${reunion.encounter.message}`;
    note.appendChild(message);

    const interactionPanel = createInteractionPanel(document, root, reunion, report);
    if (interactionPanel) note.appendChild(interactionPanel);

    summary.parentNode.insertBefore(note, summary);
    return true;
  }

  function syncReunion(document, root, entry, now = new Date()) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail) return false;
    const existing = detail.querySelector(".world-atlas-reunion-note");
    if (existing) existing.remove();
    const encounter = reunionForEntry(root, entry, now);
    if (!encounter) return false;

    const note = document.createElement("section");
    note.className = "world-atlas-reunion-note";
    note.dataset.npcId = encounter.npcId;
    const presence = document.createElement("p");
    presence.textContent = `再会候補 / ${encounter.npcName}がこの辺りを旅している。遠征で会えるかもしれない。`;
    note.appendChild(presence);

    const clue = reunionClueForEntry(root, entry, now);
    if (clue) {
      const clueText = document.createElement("p");
      clueText.className = "world-atlas-reunion-clue";
      clueText.textContent = clue.text;
      const follow = document.createElement("button");
      follow.type = "button";
      follow.className = "world-atlas-reunion-follow";
      follow.textContent = `${clue.npcName}の話を手掛かりに調べる`;
      follow.addEventListener("click", () => {
        const ActionsPresentation = root && root.CrownlessWorldAtlasActionsPresentation;
        if (ActionsPresentation && typeof ActionsPresentation.openEvent === "function") {
          ActionsPresentation.openEvent(document, root, entry);
        }
      });
      note.append(clueText, follow);
    }

    detail.appendChild(note);
    return true;
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("world-atlas-reunion-styles")) return;
    const style = document.createElement("style");
    style.id = "world-atlas-reunion-styles";
    style.textContent = ".world-atlas-reunion-note{margin:.55rem 0 0;padding:.45rem .55rem;border-left:2px solid currentColor;font-size:.78rem;line-height:1.55;font-style:normal;}.world-atlas-reunion-note>p{margin:0;}.world-atlas-reunion-clue{display:block;margin-top:.3rem!important;opacity:.88;}.world-atlas-reunion-follow{margin-top:.45rem;padding:.4rem .55rem;font:inherit;cursor:pointer;}.expedition-reunion-note{margin:.7rem 0;padding:.55rem .65rem;border-left:2px solid currentColor;font-size:.86rem;line-height:1.55;}.expedition-reunion-message{margin:0;}.npc-interaction-panel{margin-top:.45rem;padding-top:.4rem;border-top:1px dashed rgba(160,140,110,.35);}.npc-interaction-actions{display:flex;gap:.4rem;flex-wrap:wrap;margin:0 0 .35rem;}.npc-interaction-btn{padding:.25rem .55rem;font-size:.8rem;font-family:inherit;background:rgba(30,25,20,.08);border:1px solid currentColor;border-radius:2px;cursor:pointer;}.npc-interaction-btn:hover,.npc-interaction-btn:focus-visible{background:rgba(30,25,20,.18);}.npc-interaction-btn:disabled{opacity:.45;cursor:default;}.npc-interaction-dialogue{margin:.35rem 0 0;padding:.35rem .5rem;font-style:normal;border-left:2px solid rgba(160,140,110,.6);background:rgba(0,0,0,.03);}.npc-interaction-dialogue strong{display:block;font-size:.78rem;opacity:.85;margin-bottom:.15rem;}.npc-interaction-finished{display:block;margin-top:.3rem;font-size:.76rem;opacity:.7;}";
    document.head.appendChild(style);
  }

  function ensureInteractionScript(document, root) {
    if (root && root.CrownlessNpcInteraction) return;
    if (!document || typeof document.createElement !== "function" || !document.head) return;
    if (document.querySelector('script[src*="npc-interaction.js"]')) return;
    const script = document.createElement("script");
    script.src = "src/npc-interaction.js";
    script.defer = true;
    document.head.appendChild(script);
  }

  function entryForTarget(root, target) {
    const Preview = root && root.CrownlessWorldAtlasPreview;
    return Preview && typeof Preview.entryForTarget === "function" ? Preview.entryForTarget(root, target) : null;
  }

  function defaultEntry(root, viewer) {
    const Preview = root && root.CrownlessWorldAtlasPreview;
    return Preview && typeof Preview.defaultEntry === "function" ? Preview.defaultEntry(root, viewer) : null;
  }

  function install(document, root) {
    if (!document || !root || document.documentElement.dataset.worldAtlasReunionInstalled === "true") return false;
    document.documentElement.dataset.worldAtlasReunionInstalled = "true";
    ensureStyles(document);
    ensureInteractionScript(document, root);

    function syncFromTarget(target) {
      const entry = entryForTarget(root, target);
      if (!entry) return false;
      return syncReunion(document, root, entry);
    }

    document.addEventListener("pointerup", (event) => { syncFromTarget(event && event.target); }, true);
    document.addEventListener("click", (event) => {
      syncFromTarget(event && event.target);
      queueMicrotask(() => syncExpeditionReunion(document, root));
    }, true);

    const observer = new MutationObserver((records) => {
      const opened = records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1 && (
        node.id === "world-atlas-viewer" || node.querySelector?.("#world-atlas-viewer")
      )));
      queueMicrotask(() => {
        if (opened) {
          const viewer = document.getElementById("world-atlas-viewer");
          if (viewer) syncReunion(document, root, defaultEntry(root, viewer));
        }
        syncExpeditionReunion(document, root);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    queueMicrotask(() => syncLatestExpeditionReunion(root));
    return true;
  }

  return Object.freeze({
    reunionForEntry,
    reunionClueForEntry,
    reunionRecordKey,
    reunionRecord,
    recordReunion,
    expeditionState,
    reunionForExpeditionReport,
    expeditionReportReunion,
    latestExpeditionReport,
    syncLatestExpeditionReunion,
    reportForFolio,
    syncExpeditionReunion,
    syncReunion,
    createInteractionPanel,
    install
  });
});