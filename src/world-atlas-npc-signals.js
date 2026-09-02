(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasNpcSignals = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasNpcSignals() {
  "use strict";

  const SIGNAL_POSITIONS = Object.freeze([
    Object.freeze({ x: 74, y: 24, direction: "北東寄り" }),
    Object.freeze({ x: 24, y: 32, direction: "北西寄り" }),
    Object.freeze({ x: 78, y: 70, direction: "南東寄り" })
  ]);
  const NORTH_ROUTE_POSITION = Object.freeze({ x: 50, y: 18, direction: "北寄り" });

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function positionForLead(npcLife, lead, index) {
    const northRoad = npcLife && npcLife.LOCATIONS ? npcLife.LOCATIONS.ROAD : "north-road";
    if (lead && lead.location === northRoad) return NORTH_ROUTE_POSITION;
    return SIGNAL_POSITIONS[index % SIGNAL_POSITIONS.length];
  }

  function travelingSignals(npcLife, input = new Date()) {
    if (!npcLife || typeof npcLife.snapshotAt !== "function") return [];
    const snapshot = npcLife.snapshotAt(input);
    const travelingState = npcLife.STATES && npcLife.STATES.TRAVELING ? npcLife.STATES.TRAVELING : "traveling";
    const leads = typeof npcLife.explorationLeads === "function" ? npcLife.explorationLeads(snapshot) : [];
    const leadByTarget = new Map(leads.map((lead) => [cleanText(lead && lead.targetId), lead]).filter(([targetId]) => targetId));

    return snapshot
      .filter((resident) => resident && resident.state === travelingState && leadByTarget.has(cleanText(resident.id)))
      .map((resident, index) => {
        const slot = positionForLead(npcLife, leadByTarget.get(cleanText(resident.id)), index);
        return Object.freeze({
          id: `npc-signal:${cleanText(resident.id, String(index + 1))}`,
          residentId: cleanText(resident.id),
          name: `${cleanText(resident.name, "旅人")}の気配`,
          shortName: cleanText(resident.role, "旅人"),
          x: slot.x,
          y: slot.y,
          direction: slot.direction,
          distanceBand: "街道筋の気配",
          stateLabel: "未確認 / 噂の足取り"
        });
      });
  }

  function selectedSignalDetail(document, signal) {
    const fragment = document.createDocumentFragment();
    const kicker = document.createElement("small");
    kicker.textContent = "ROUTE RUMOR / 人の気配";
    const title = document.createElement("strong");
    title.textContent = signal.name;
    const state = document.createElement("span");
    state.textContent = `${signal.direction}・${signal.distanceBand}。まだ確認済み地点ではない。`;
    const note = document.createElement("em");
    note.textContent = "炉端で聞いた足取りを粗く重ねたもの。正確な位置や経路を示す印ではない。";
    fragment.append(kicker, title, state, note);
    return fragment;
  }

  function inject(document, root, input = new Date()) {
    const map = document && document.querySelector(".world-atlas-map--nearby");
    if (!map) return 0;

    Array.from(map.querySelectorAll(".world-atlas-nearby-marker--npc-signal")).forEach((node) => node.remove());
    const signals = travelingSignals(root && root.CrownlessNpcLife, input);
    if (!signals.length) return 0;

    signals.forEach((signal, index) => {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "world-atlas-nearby-marker world-atlas-nearby-marker--npc-signal";
      marker.style.left = `${signal.x}%`;
      marker.style.top = `${signal.y}%`;
      marker.dataset.labelHorizontal = signal.x >= 72 ? "inset-right" : signal.x <= 28 ? "inset-left" : "center";
      marker.dataset.labelVertical = signal.y >= 66 ? "above" : "below";
      marker.dataset.atlasSignalSource = "npc-rumor";
      marker.setAttribute("aria-label", `${signal.name}。${signal.direction}、${signal.distanceBand}。${signal.stateLabel}。`);

      const glyph = document.createElement("i");
      glyph.textContent = "◌";
      const number = document.createElement("small");
      number.textContent = `N${index + 1}`;
      const label = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = signal.name;
      const em = document.createElement("em");
      em.textContent = `${signal.direction} · 未確認`;
      label.append(strong, em);
      marker.append(glyph, number, label);

      marker.addEventListener("click", () => {
        const viewer = document.getElementById("world-atlas-viewer");
        const detail = viewer && viewer.querySelector(".world-atlas-detail");
        if (detail) detail.replaceChildren(selectedSignalDetail(document, signal));
        Array.from(map.querySelectorAll(".world-atlas-nearby-marker")).forEach((node) => node.classList.toggle("active", node === marker));
      });
      map.appendChild(marker);
    });
    return signals.length;
  }

  function addedNearbyMap(record) {
    return Array.from(record && record.addedNodes || []).some((node) => node && node.nodeType === 1 && (
      node.matches?.(".world-atlas-map--nearby, #world-atlas-viewer")
      || node.querySelector?.(".world-atlas-map--nearby")
    ));
  }

  function install(document, root) {
    if (!document || !root || root.__worldAtlasNpcSignalsInstalled) return false;
    const refresh = () => inject(document, root);
    const observer = typeof root.MutationObserver === "function"
      ? new root.MutationObserver((records) => {
        if (records.some(addedNearbyMap)) refresh();
      })
      : null;
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
    if (typeof root.addEventListener === "function") root.addEventListener("crownless:world-knowledge-updated", refresh);
    root.__worldAtlasNpcSignalsInstalled = true;
    refresh();
    return true;
  }

  return Object.freeze({
    SIGNAL_POSITIONS,
    NORTH_ROUTE_POSITION,
    positionForLead,
    travelingSignals,
    selectedSignalDetail,
    inject,
    addedNearbyMap,
    install
  });
});
