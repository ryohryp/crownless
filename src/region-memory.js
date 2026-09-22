(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessRegionMemory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "crownless-expedition-v1-region-memory";
  const MAX_REGIONS = 24;

  function normalizeEntry(value) {
    if (!value || typeof value !== "object") return null;
    const region = typeof value.region === "string" ? value.region : "";
    if (!region) return null;
    return {
      region,
      visits: Math.max(0, Math.min(99, Number(value.visits) || 0)),
      maxDepth: Math.max(0, Math.min(99, Number(value.maxDepth) || 0)),
      discovery: typeof value.discovery === "string" ? value.discovery.slice(0, 80) : "",
      loot: typeof value.loot === "string" ? value.loot.slice(0, 60) : ""
    };
  }

  function normalizeMemory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map(normalizeEntry).filter(entry => {
      if (!entry || seen.has(entry.region)) return false;
      seen.add(entry.region);
      return true;
    }).slice(-MAX_REGIONS);
  }

  function remember(memory, region, report) {
    if (!region) return normalizeMemory(memory);
    const list = normalizeMemory(memory);
    const previous = list.find(entry => entry.region === region) || { region, visits: 0, maxDepth: 0, discovery: "", loot: "" };
    const gear = report && Array.isArray(report.newGear) && report.newGear[0];
    const next = {
      region,
      visits: Math.min(99, previous.visits + 1),
      maxDepth: Math.max(previous.maxDepth, Number(report && report.depth) || 0),
      discovery: (report && (report.discovery || report.place)) ? String(report.discovery || report.place).slice(0, 80) : previous.discovery,
      loot: gear ? String(gear.name || gear.label || gear).slice(0, 60) : previous.loot
    };
    return [...list.filter(entry => entry.region !== region), next].slice(-MAX_REGIONS);
  }

  function summary(memory, region) {
    const entry = normalizeMemory(memory).find(item => item.region === region);
    if (!entry) return null;
    const parts = [];
    if (entry.discovery) parts.push(entry.discovery);
    if (entry.maxDepth) parts.push(`最深部 ${entry.maxDepth}`);
    if (entry.loot) parts.push(`持ち帰り：${entry.loot}`);
    return {
      title: entry.visits > 1 ? `この土地の記憶 · ${entry.visits}回` : "この土地の記憶",
      text: parts.slice(0, 2).join(" / ") || "以前ここを探索した。"
    };
  }

  return { STORAGE_KEY, MAX_REGIONS, normalizeMemory, remember, summary };
});