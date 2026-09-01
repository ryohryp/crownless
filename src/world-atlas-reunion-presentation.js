(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasReunionPresentation = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasReunionPresentation() {
  "use strict";

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

  function syncReunion(document, root, entry, now = new Date()) {
    const viewer = document && document.getElementById("world-atlas-viewer");
    const detail = viewer && viewer.querySelector(".world-atlas-detail");
    if (!detail) return false;
    const existing = detail.querySelector(".world-atlas-reunion-note");
    if (existing) existing.remove();
    const encounter = reunionForEntry(root, entry, now);
    if (!encounter) return false;

    const previous = reunionRecord(root, encounter);
    const note = document.createElement("p");
    note.className = "world-atlas-reunion-note";
    note.dataset.npcId = encounter.npcId;
    note.textContent = `再会 / ${encounter.message}${previous ? " 以前にもここで会った。" : ""}`;
    const clue = reunionClueForEntry(root, entry, now);
    if (clue) {
      const clueText = document.createElement("span");
      clueText.className = "world-atlas-reunion-clue";
      clueText.textContent = `手がかり / ${clue.text}`;
      note.appendChild(clueText);
    }
    detail.appendChild(note);
    recordReunion(root, encounter, now);
    return true;
  }

  function ensureStyles(document) {
    if (!document || document.getElementById("world-atlas-reunion-styles")) return;
    const style = document.createElement("style");
    style.id = "world-atlas-reunion-styles";
    style.textContent = ".world-atlas-reunion-note{margin:.55rem 0 0;padding:.45rem .55rem;border-left:2px solid currentColor;font-size:.78rem;line-height:1.55;font-style:normal;}.world-atlas-reunion-clue{display:block;margin-top:.3rem;opacity:.88;}";
    document.head.appendChild(style);
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

    function syncFromTarget(target) {
      const entry = entryForTarget(root, target);
      if (!entry) return false;
      return syncReunion(document, root, entry);
    }

    document.addEventListener("pointerup", (event) => { syncFromTarget(event && event.target); }, true);
    document.addEventListener("click", (event) => { syncFromTarget(event && event.target); }, true);

    const observer = new MutationObserver((records) => {
      const opened = records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1 && (
        node.id === "world-atlas-viewer" || node.querySelector?.("#world-atlas-viewer")
      )));
      if (!opened) return;
      queueMicrotask(() => {
        const viewer = document.getElementById("world-atlas-viewer");
        if (viewer) syncReunion(document, root, defaultEntry(root, viewer));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return true;
  }

  return Object.freeze({
    reunionForEntry,
    reunionClueForEntry,
    reunionRecordKey,
    reunionRecord,
    recordReunion,
    syncReunion,
    install
  });
});
