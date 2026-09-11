(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessRebootTerritoryAdapter = api;
  if (root && root.document) api.install(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WORLD_STORAGE_KEY = "crownless.reboot.territory-world.v1";

  function clean(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function sanitizeWorldKnowledge(value) {
    const source = value && typeof value === "object" ? value : {};
    const discoveries = source.discoveries && typeof source.discoveries === "object" && !Array.isArray(source.discoveries)
      ? source.discoveries : {};
    const safe = {};
    Object.entries(discoveries).forEach(([fallbackKey, raw]) => {
      if (!raw || typeof raw !== "object") return;
      const key = clean(raw.key || fallbackKey);
      if (!key) return;
      safe[key] = {
        key,
        name: clean(raw.name, "名もない発見"),
        baseTitle: clean(raw.baseTitle),
        terrain: [...new Set((Array.isArray(raw.terrain) ? raw.terrain : []).map((item) => clean(item)).filter(Boolean))].slice(0, 8),
        contentKind: clean(raw.contentKind, "unknown"),
        state: ["discovered", "investigated", "cleared"].includes(raw.state) ? raw.state : "discovered",
        firstDiscoveredAt: Math.max(0, Number(raw.firstDiscoveredAt) || 0),
        visits: Math.max(1, Math.floor(Number(raw.visits) || 1))
      };
    });
    return { discoveries: safe };
  }

  function installCore(root) {
    if (root.CrownlessCore?.loadSafeState && root.CrownlessCore?.saveWorldKnowledge) return root.CrownlessCore;
    const storage = () => { try { return root.localStorage || null; } catch (_) { return null; } };
    const loadSafeState = () => {
      try {
        const parsed = JSON.parse(storage()?.getItem(WORLD_STORAGE_KEY) || "null");
        return { worldKnowledge: sanitizeWorldKnowledge(parsed?.worldKnowledge) };
      } catch (_) {
        return { worldKnowledge: { discoveries: {} } };
      }
    };
    const saveWorldKnowledge = (state) => {
      try {
        storage()?.setItem(WORLD_STORAGE_KEY, JSON.stringify({ version: 1, worldKnowledge: sanitizeWorldKnowledge(state?.worldKnowledge) }));
        return Boolean(storage());
      } catch (_) {
        return false;
      }
    };
    root.CrownlessCore = { loadSafeState, saveWorldKnowledge, sanitizeWorldKnowledge };
    return root.CrownlessCore;
  }

  function simulatedDiscoveries() {
    const origin = { latitude: 35.68, longitude: 139.77 };
    return [
      { title: "黒鴉の丘", sourceRef: "reboot:black-raven-hill", contentKind: "dungeon", features: ["height"], mapOrigin: origin, representativeCoordinate: { latitude: 35.6832, longitude: 139.77 } },
      { title: "古い渡り場", sourceRef: "reboot:old-crossing", contentKind: "event", features: ["crossing", "water"], mapOrigin: origin, representativeCoordinate: { latitude: 35.679, longitude: 139.7732 } },
      { title: "鐘なき塔", sourceRef: "reboot:bell-tower", contentKind: "facility", features: ["settlement", "sacred"], mapOrigin: origin, representativeCoordinate: { latitude: 35.6784, longitude: 139.767 } }
    ];
  }

  function installLocationRuntime(root) {
    if (root.CrownlessLocationDiscoveryRuntime) return root.CrownlessLocationDiscoveryRuntime;
    const runtime = {
      state: "ready",
      mode: "reboot-simulated-territory",
      discoveries: simulatedDiscoveries(),
      worldKnowledgeKey(discovery) {
        const features = [...new Set((discovery?.features || []).map((item) => clean(item)).filter(Boolean))].sort();
        return `geo:${clean(discovery?.sourceRef, "reboot:unknown")}:${clean(discovery?.contentKind, "unknown")}:${features.join("+") || "unknown"}`;
      },
      async reload() { runtime.state = "ready"; return runtime.discoveries; }
    };
    root.CrownlessLocationDiscoveryRuntime = runtime;
    return runtime;
  }

  function ensureEntry(root) {
    if (!root.CrownlessWorldAtlas?.openAtlas) return false;
    if (root.document.querySelector(".world-atlas-home-entry")) return true;
    const button = root.document.createElement("button");
    button.type = "button";
    button.className = "secondary-action world-atlas-home-entry";
    button.textContent = "勢力図を開く →";
    button.addEventListener("click", () => root.CrownlessWorldAtlas.openAtlas(root.document, root.CrownlessCore, root));
    (root.document.querySelector(".location-actions") || root.document.body).appendChild(button);
    return true;
  }

  function install(root) {
    installCore(root);
    installLocationRuntime(root);
    if (root.document.readyState === "complete") ensureEntry(root);
    else root.addEventListener("load", () => ensureEntry(root), { once: true });
    return true;
  }

  return Object.freeze({ WORLD_STORAGE_KEY, sanitizeWorldKnowledge, simulatedDiscoveries, installCore, installLocationRuntime, ensureEntry, install });
});
