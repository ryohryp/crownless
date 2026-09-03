(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasScouting = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasScouting() {
  "use strict";

  const SCOUT_STORAGE_KEY = "crownless.atlas-scout.v1";
  const MARKET_STORAGE_KEY = "crownless.atlas-market.v1";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function storageOf(root) {
    try { return root && root.localStorage ? root.localStorage : null; } catch (_) { return null; }
  }

  function canScout(entry) {
    return Boolean(entry && cleanText(entry.key).startsWith("geo:") && ["discovered", "investigated", "cleared"].includes(cleanText(entry.state, "discovered")));
  }

  function loadScoutState(root) {
    const storage = storageOf(root);
    const raw = storage ? safeJsonParse(storage.getItem(SCOUT_STORAGE_KEY) || "null", null) : null;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  }

  function saveScoutState(root, state) {
    const storage = storageOf(root);
    if (!storage) return false;
    try {
      storage.setItem(SCOUT_STORAGE_KEY, JSON.stringify(state || {}));
      return true;
    } catch (_) {
      return false;
    }
  }

  function dangerLabel(tags) {
    const set = new Set(Array.isArray(tags) ? tags : []);
    if (set.has("bandit")) return "武装した街道荒らしの気配";
    if (set.has("beast")) return "獣の縄張りと追跡痕";
    if (set.has("collapse")) return "足場崩れ・落石の危険";
    if (set.has("wet-ground")) return "濡れた足場と増水の危険";
    return "正体の読めない危険";
  }

  function adviceFor(destination) {
    const danger = new Set(destination && Array.isArray(destination.dangerTags) ? destination.dangerTags : []);
    if (danger.has("bandit")) return "煤けた外套や短刀が使いやすい。人数を増やすか、慎重・通常方針が無難。";
    if (danger.has("beast")) return "狩り弓が有効。森に強い仲間を含めると戦いやすい。";
    if (danger.has("collapse")) return "麻縄を持たせ、慎重方針で崩落に備える価値が高い。";
    if (danger.has("wet-ground")) return "麻縄を持たせ、深追いしない方針が安全。";
    return "正体が読めない。装備を空にせず、慎重方針で様子を見る手がある。";
  }

  function buildScoutIntel(entry, bridge) {
    if (!canScout(entry) || !bridge || typeof bridge.destinationFromKnowledge !== "function") return null;
    const destination = bridge.destinationFromKnowledge(entry);
    if (!destination) return null;
    return {
      discoveryKey: cleanText(entry.key),
      destinationId: cleanText(destination.id),
      destinationName: cleanText(destination.name, cleanText(entry.name, "発見地点")),
      dangerTags: Array.isArray(destination.dangerTags) ? [...destination.dangerTags] : [],
      opportunityTags: Array.isArray(destination.opportunityTags) ? [...destination.opportunityTags] : [],
      dangerLabel: dangerLabel(destination.dangerTags),
      advice: adviceFor(destination)
    };
  }

  function paymentId(item) {
    return cleanText(item && item.id, cleanText(item && item.name, "loot"));
  }

  function spendScoutCost(root) {
    const atlas = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!atlas || typeof atlas.availableTradeLoot !== "function" || typeof atlas.loadMarketState !== "function") {
      return { ok: false, reason: "unavailable", item: null };
    }
    const available = atlas.availableTradeLoot(root);
    const item = Array.isArray(available) ? available[0] : null;
    if (!item) return { ok: false, reason: "insufficient", item: null };
    const id = paymentId(item);
    if (!id) return { ok: false, reason: "invalid", item: null };
    const market = atlas.loadMarketState(root);
    market.spentLootCounts = market.spentLootCounts && typeof market.spentLootCounts === "object" ? { ...market.spentLootCounts } : {};
    market.spentLootCounts[id] = (Number(market.spentLootCounts[id]) || 0) + 1;
    const storage = storageOf(root);
    if (!storage) return { ok: false, reason: "storage", item: null };
    try {
      storage.setItem(MARKET_STORAGE_KEY, JSON.stringify(market));
      return { ok: true, reason: "paid", item };
    } catch (_) {
      return { ok: false, reason: "storage", item: null };
    }
  }

  function intelForEntry(root, entry) {
    const state = loadScoutState(root);
    return state[cleanText(entry && entry.key)] || null;
  }

  function recordIntel(root, entry) {
    const intel = buildScoutIntel(entry, root && root.CrownlessGeographicExpeditionBridge);
    if (!intel) return { ok: false, reason: "invalid", intel: null, payment: null };
    const existing = intelForEntry(root, entry);
    if (existing) return { ok: true, reason: "known", intel: existing, payment: null };
    const payment = spendScoutCost(root);
    if (!payment.ok) return { ok: false, reason: payment.reason, intel: null, payment: null };
    intel.scoutedAt = Date.now();
    intel.paymentName = cleanText(payment.item && payment.item.name, "戦利品");
    const state = loadScoutState(root);
    state[intel.discoveryKey] = intel;
    if (!saveScoutState(root, state)) return { ok: false, reason: "storage", intel: null, payment };
    return { ok: true, reason: "scouted", intel, payment };
  }

  function entryByPanel(root, panel) {
    const key = cleanText(panel && panel.dataset && panel.dataset.discoveryKey);
    const atlas = root && root.CrownlessWorldAtlasActionsPresentation;
    if (!key || !atlas || typeof atlas.entryByKey !== "function") return null;
    return atlas.entryByKey(root, key);
  }

  function formatIntel(intel) {
    if (!intel) return "";
    return `偵察: ${intel.dangerLabel}。${intel.advice}`;
  }

  function syncPanel(document, root, panel) {
    if (!panel || panel.querySelector("[data-atlas-scout]")) return false;
    const entry = entryByPanel(root, panel);
    if (!canScout(entry)) return false;
    const list = panel.querySelector(".world-atlas-actions__list");
    if (!list) return false;
    const known = intelForEntry(root, entry);
    const atlas = root && root.CrownlessWorldAtlasActionsPresentation;
    const available = atlas && typeof atlas.availableTradeLoot === "function" ? atlas.availableTradeLoot(root) : [];

    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-atlas-action world-atlas-action--scout";
    button.dataset.atlasScout = "true";
    const title = document.createElement("strong");
    title.textContent = known ? "偵察情報を見る" : "危険度を偵察する";
    const note = document.createElement("small");
    note.textContent = known
      ? "案内人から得た危険と備えを確認する。"
      : "戦利品1個を案内人への謝礼にして、危険と備えを聞く。";
    if (!known && (!Array.isArray(available) || !available.length)) {
      button.disabled = true;
      note.textContent = "案内人への謝礼にできる戦利品がない。";
    }
    button.append(title, note);
    list.appendChild(button);
    return true;
  }

  function syncPanels(document, root) {
    let changed = false;
    Array.from(document.querySelectorAll(".world-atlas-actions")).forEach((panel) => {
      changed = syncPanel(document, root, panel) || changed;
    });
    return changed;
  }

  function destinationIntel(root, destinationId) {
    const wanted = cleanText(destinationId);
    if (!wanted) return null;
    return Object.values(loadScoutState(root)).find((intel) => cleanText(intel && intel.destinationId) === wanted) || null;
  }

  function syncPrepare(document, root) {
    const form = document.querySelector("#expedition-folio-content form.expedition-prepare");
    if (!form) return false;
    const existing = form.querySelector("[data-scout-intel]");
    const selected = form.querySelector('input[name="destination"]:checked');
    const intel = destinationIntel(root, selected && selected.value);
    if (!intel) {
      if (existing) existing.remove();
      return false;
    }
    const text = `偵察済み — ${intel.dangerLabel}。${intel.advice}`;
    if (existing) {
      if (existing.textContent !== text) existing.textContent = text;
      return true;
    }
    const note = document.createElement("p");
    note.dataset.scoutIntel = "true";
    note.className = "expedition-form-feedback";
    note.textContent = text;
    const destinationGroup = selected && selected.closest("fieldset");
    if (destinationGroup) destinationGroup.insertAdjacentElement("afterend", note);
    else form.prepend(note);
    return true;
  }

  function install(document, root) {
    if (!document || !root || document.documentElement.dataset.worldAtlasScoutingInstalled === "true") return false;
    document.documentElement.dataset.worldAtlasScoutingInstalled = "true";

    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(() => {
        scheduled = false;
        syncPanels(document, root);
        syncPrepare(document, root);
      });
    }

    document.addEventListener("click", (event) => {
      const button = event.target && typeof event.target.closest === "function" ? event.target.closest("[data-atlas-scout]") : null;
      if (!button) return;
      const panel = button.closest(".world-atlas-actions");
      const entry = entryByPanel(root, panel);
      const known = intelForEntry(root, entry);
      const outcome = known ? { ok: true, reason: "known", intel: known } : recordIntel(root, entry);
      const status = panel && panel.querySelector(".world-atlas-actions__status");
      if (status) {
        status.textContent = outcome.ok
          ? `${outcome.reason === "scouted" ? `${outcome.intel.paymentName}を謝礼に渡した。` : ""}${formatIntel(outcome.intel)}`
          : (outcome.reason === "insufficient" ? "案内人への謝礼にできる戦利品がない。" : "偵察情報を記録できなかった。");
      }
      if (outcome.ok && outcome.reason === "scouted") {
        button.querySelector("strong").textContent = "偵察情報を見る";
        button.querySelector("small").textContent = "案内人から得た危険と備えを確認する。";
      }
      schedule();
    }, true);

    document.addEventListener("change", (event) => {
      if (event.target && event.target.name === "destination") syncPrepare(document, root);
    }, true);

    if (typeof MutationObserver === "function" && document.body) {
      const observer = new MutationObserver((records) => {
        const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1 && (
          node.matches?.(".world-atlas-actions, form.expedition-prepare") || node.querySelector?.(".world-atlas-actions, form.expedition-prepare")
        )));
        if (relevant) schedule();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    schedule();
    return true;
  }

  return {
    SCOUT_STORAGE_KEY,
    MARKET_STORAGE_KEY,
    canScout,
    loadScoutState,
    saveScoutState,
    dangerLabel,
    adviceFor,
    buildScoutIntel,
    spendScoutCost,
    intelForEntry,
    recordIntel,
    formatIntel,
    destinationIntel,
    syncPanel,
    syncPanels,
    syncPrepare,
    install
  };
});