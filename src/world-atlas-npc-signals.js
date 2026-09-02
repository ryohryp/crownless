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
  const NORTH_ROUTE_POSITIONS = Object.freeze([
    Object.freeze({ x: 44, y: 28, direction: "北寄り", phase: "街道へ出たばかり" }),
    Object.freeze({ x: 50, y: 19, direction: "北寄り", phase: "街道を進んでいる" }),
    Object.freeze({ x: 56, y: 13, direction: "北寄り", phase: "さらに北へ進んだ気配" })
  ]);
  const NORTH_ROUTE_POSITION = NORTH_ROUTE_POSITIONS[1];

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function safeState(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return null;
    try { return Core.loadSafeState(); } catch (_) { return null; }
  }

  function northRoutePositionForHour(hour) {
    const numeric = Number(hour);
    const normalized = Number.isFinite(numeric) ? ((Math.floor(numeric) % 24) + 24) % 24 : 0;
    if (normalized <= 10) return NORTH_ROUTE_POSITIONS[0];
    if (normalized >= 13) return NORTH_ROUTE_POSITIONS[2];
    return NORTH_ROUTE_POSITIONS[1];
  }

  function positionForLead(npcLife, lead, index, resident) {
    const northRoad = npcLife && npcLife.LOCATIONS ? npcLife.LOCATIONS.ROAD : "north-road";
    if (lead && lead.location === northRoad) return northRoutePositionForHour(resident && resident.hour);
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
        const slot = positionForLead(npcLife, leadByTarget.get(cleanText(resident.id)), index, resident);
        return Object.freeze({
          id: `npc-signal:${cleanText(resident.id, String(index + 1))}`,
          residentId: cleanText(resident.id),
          name: `${cleanText(resident.name, "旅人")}の気配`,
          shortName: cleanText(resident.role, "旅人"),
          x: slot.x,
          y: slot.y,
          direction: slot.direction,
          distanceBand: "街道筋の気配",
          movementHint: cleanText(slot.phase, "街道を移動中"),
          stateLabel: "未確認 / 噂の足取り"
        });
      });
  }

  function knownDestinationForSignal(root, npcLife, signal, input = new Date()) {
    if (!signal || !npcLife || typeof npcLife.snapshotAt !== "function" || typeof npcLife.reunionCandidates !== "function") return null;
    const safe = safeState(root);
    const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
    if (!discoveries || typeof discoveries !== "object" || Array.isArray(discoveries)) return null;
    const residentId = cleanText(signal.residentId);
    if (!residentId) return null;
    const candidate = npcLife.reunionCandidates(npcLife.snapshotAt(input), discoveries)
      .find((entry) => cleanText(entry && entry.targetId) === residentId);
    const discoveryKey = cleanText(candidate && candidate.discoveryKey);
    const entry = discoveryKey ? discoveries[discoveryKey] : null;
    if (!candidate || !entry || typeof entry !== "object") return null;
    return Object.freeze({ candidate, entry });
  }

  function openKnownDestination(document, root, match, input = new Date()) {
    if (!match || !match.entry) return false;
    let changed = false;
    const Preview = root && root.CrownlessWorldAtlasPreview;
    const Actions = root && root.CrownlessWorldAtlasActionsPresentation;
    const Reunion = root && root.CrownlessWorldAtlasReunionPresentation;
    if (Preview && typeof Preview.syncSelection === "function") changed = Preview.syncSelection(document, root, match.entry) || changed;
    if (Actions && typeof Actions.syncActions === "function") changed = Actions.syncActions(document, root, match.entry) || changed;
    if (Reunion && typeof Reunion.syncReunion === "function") changed = Reunion.syncReunion(document, root, match.entry, input) || changed;
    return changed;
  }

  function selectedSignalDetail(document, signal, match = null, onOpenKnown = null) {
    const fragment = document.createDocumentFragment();
    const kicker = document.createElement("small");
    kicker.textContent = "ROUTE RUMOR / 人の気配";
    const title = document.createElement("strong");
    title.textContent = signal.name;
    const state = document.createElement("span");
    state.textContent = `${signal.direction}・${signal.distanceBand}。${signal.movementHint}。まだ確認済み地点ではない。`;
    const note = document.createElement("em");
    note.textContent = "炉端で聞いた足取りを時間帯ごとに粗く重ねたもの。正確な位置や経路を示す印ではない。";
    fragment.append(kicker, title, state, note);

    if (match && match.candidate && match.entry) {
      const known = document.createElement("p");
      known.className = "world-atlas-npc-signal-match";
      known.textContent = `探索録の「${cleanText(match.candidate.destinationName, cleanText(match.entry.name, "既知の地点"))}」と足取りが重なる。`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-atlas-npc-signal-match__open";
      button.textContent = "既知の探索地点を開く";
      if (typeof onOpenKnown === "function") button.addEventListener("click", onOpenKnown);
      fragment.append(known, button);
    }
    return fragment;
  }

  function inject(document, root, input = new Date()) {
    const map = document && document.querySelector(".world-atlas-map--nearby");
    if (!map) return 0;

    Array.from(map.querySelectorAll(".world-atlas-nearby-marker--npc-signal")).forEach((node) => node.remove());
    const npcLife = root && root.CrownlessNpcLife;
    const signals = travelingSignals(npcLife, input);
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
      marker.setAttribute("aria-label", `${signal.name}。${signal.direction}、${signal.distanceBand}。${signal.movementHint}。${signal.stateLabel}。`);

      const glyph = document.createElement("i");
      glyph.textContent = "◌";
      const number = document.createElement("small");
      number.textContent = `N${index + 1}`;
      const label = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = signal.name;
      const em = document.createElement("em");
      em.textContent = `${signal.direction} · ${signal.movementHint}`;
      label.append(strong, em);
      marker.append(glyph, number, label);

      marker.addEventListener("click", () => {
        const viewer = document.getElementById("world-atlas-viewer");
        const detail = viewer && viewer.querySelector(".world-atlas-detail");
        const match = knownDestinationForSignal(root, npcLife, signal, input);
        if (detail) {
          detail.replaceChildren(selectedSignalDetail(document, signal, match, () => {
            openKnownDestination(document, root, match, input);
          }));
        }
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
    NORTH_ROUTE_POSITIONS,
    NORTH_ROUTE_POSITION,
    northRoutePositionForHour,
    positionForLead,
    travelingSignals,
    knownDestinationForSignal,
    openKnownDestination,
    selectedSignalDetail,
    inject,
    addedNearbyMap,
    install
  });
});
