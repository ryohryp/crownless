(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldTraces = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldTraces() {
  "use strict";

  const TRACE_ID = "world-trace:npc:marco:north-route";
  const TRACKING_KNOWLEDGE_KEY = "knowledge:tracking:rut-reading";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function normalizedHour(input = new Date()) {
    if (input instanceof Date) return input.getHours();
    const numeric = Number(input);
    return Number.isFinite(numeric) ? ((Math.floor(numeric) % 24) + 24) % 24 : new Date().getHours();
  }

  function freshnessForHour(input = new Date()) {
    const hour = normalizedHour(input);
    if (hour <= 11) return "fresh";
    if (hour <= 13) return "fading";
    return "stale";
  }

  function traceFromSignalSource(signalSource, input = new Date()) {
    const source = cleanText(signalSource);
    if (source !== "npc-travel" && source !== "npc-rumor") return null;
    const freshness = freshnessForHour(input);
    const identified = source === "npc-rumor";
    return Object.freeze({
      id: TRACE_ID,
      kind: "tracks",
      sourceType: "npc",
      sourceId: identified ? "marco" : null,
      discoveryState: "hinted",
      freshness,
      freshnessLabel: freshness === "fresh" ? "新しい" : freshness === "fading" ? "薄れかけ" : "古い",
      identified,
      canFollow: identified && freshness !== "stale",
      trackingKnown: false
    });
  }

  function applyTrackingKnowledge(trace, known) {
    if (!trace || !known) return trace;
    return Object.freeze({
      ...trace,
      trackingKnown: true,
      canFollow: Boolean(trace.identified)
    });
  }

  function trackingKnowledgeKnown(root) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function") return false;
    try {
      const safe = Core.loadSafeState();
      const discoveries = safe && safe.worldKnowledge && safe.worldKnowledge.discoveries;
      return Boolean(discoveries && typeof discoveries === "object" && discoveries[TRACKING_KNOWLEDGE_KEY]);
    } catch (_) {
      return false;
    }
  }

  function rememberTrackingKnowledge(root, now = Date.now()) {
    const Core = root && root.CrownlessCore;
    if (!Core || typeof Core.loadSafeState !== "function" || typeof Core.saveWorldKnowledge !== "function") {
      return { changed: false, known: false };
    }
    try {
      const safe = Core.loadSafeState();
      if (!safe || typeof safe !== "object") return { changed: false, known: false };
      if (typeof Core.sanitizeWorldKnowledge === "function") safe.worldKnowledge = Core.sanitizeWorldKnowledge(safe.worldKnowledge);
      if (!safe.worldKnowledge || typeof safe.worldKnowledge !== "object") safe.worldKnowledge = { discoveries: {} };
      if (!safe.worldKnowledge.discoveries || typeof safe.worldKnowledge.discoveries !== "object" || Array.isArray(safe.worldKnowledge.discoveries)) {
        safe.worldKnowledge.discoveries = {};
      }
      if (safe.worldKnowledge.discoveries[TRACKING_KNOWLEDGE_KEY]) return { changed: false, known: true };
      safe.worldKnowledge.discoveries[TRACKING_KNOWLEDGE_KEY] = {
        key: TRACKING_KNOWLEDGE_KEY,
        name: "《轍読み》",
        baseTitle: "荷車の轍を追った経験から、古い痕跡でも進行方向を読み取れるようになった。",
        terrain: [],
        contentKind: "knowledge",
        state: "discovered",
        firstDiscoveredAt: Number(now) > 0 ? Number(now) : Date.now(),
        visits: 1
      };
      const saved = Core.saveWorldKnowledge(safe) !== false;
      if (saved && root && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
        root.dispatchEvent(new root.CustomEvent("crownless:world-knowledge-updated", { detail: { source: "tracking-knowledge", key: TRACKING_KNOWLEDGE_KEY } }));
      }
      return { changed: saved, known: saved };
    } catch (_) {
      return { changed: false, known: false };
    }
  }

  function investigationCopy(trace) {
    if (!trace) return "調べられる痕跡はない。";
    if (trace.trackingKnown) {
      if (trace.freshness === "fresh") return "轍の沈み方から、荷を積んだ一台が北へ急いでいると読める。まだ十分に追いつける。";
      if (trace.freshness === "fading") return "崩れた車輪跡の重なりから、一台の荷車が北へ進んだと読める。痕跡は薄いが追跡できる。";
      return "古い轍だが、片側の車輪跡と土の崩れ方が残っている。北の街道へ抜けた一台の荷車を追える。";
    }
    if (trace.freshness === "fresh") {
      return trace.identified
        ? "轍はまだ新しい。マルコの荷車と同じ癖があり、今なら追いつけそうだ。"
        : "轍はまだ新しい。ただし、誰の荷車かまでは分からない。";
    }
    if (trace.freshness === "fading") {
      return trace.identified
        ? "轍は薄れかけている。マルコの荷車らしいが、追うなら今が最後の機会だ。"
        : "轍は薄れかけている。持ち主を断定できる材料はない。";
    }
    return trace.identified
      ? "轍は古い。マルコのものらしいが、この痕跡だけを頼りに追うのは危険だ。"
      : "轍は古い。誰のものかも、どこへ続くかも確かめられない。";
  }

  function activeNpcMarker(document) {
    return document && document.querySelector
      ? document.querySelector(".world-atlas-nearby-marker--npc-signal.active")
      : null;
  }

  function activeDetail(document) {
    const viewer = document && document.getElementById ? document.getElementById("world-atlas-viewer") : null;
    return viewer && viewer.querySelector ? viewer.querySelector(".world-atlas-detail") : null;
  }

  function existingDispatch(detail) {
    return detail && detail.querySelector ? detail.querySelector(".world-atlas-npc-signal-match__dispatch") : null;
  }

  function setDispatchState(dispatch, trace, investigated, declined = false) {
    if (!dispatch) return false;
    const followable = Boolean(investigated && !declined && trace && trace.canFollow);
    dispatch.hidden = !followable;
    dispatch.disabled = !followable;
    if (followable) dispatch.textContent = trace.trackingKnown ? "轍を読み、痕跡を追って遠征する" : "痕跡を追って遠征する";
    return followable;
  }

  function bindTrackingLesson(dispatch, root) {
    if (!dispatch || !root || (dispatch.dataset && dispatch.dataset.trackingLessonBound === "true")) return false;
    if (dispatch.dataset) dispatch.dataset.trackingLessonBound = "true";
    dispatch.addEventListener("click", () => { rememberTrackingKnowledge(root); }, { once: true });
    return true;
  }

  function appendTracePanel(document, detail, marker, input = new Date(), root = null) {
    if (!document || !detail || !marker || !document.createElement) return false;
    if (detail.querySelector && detail.querySelector(".world-trace-investigation")) return false;
    const known = trackingKnowledgeKnown(root);
    const trace = applyTrackingKnowledge(traceFromSignalSource(marker.dataset && marker.dataset.atlasSignalSource, input), known);
    if (!trace) return false;

    const dispatch = existingDispatch(detail);
    setDispatchState(dispatch, trace, false);

    const panel = document.createElement("section");
    panel.className = "world-atlas-npc-signal-match world-trace-investigation";

    const heading = document.createElement("strong");
    heading.textContent = trace.trackingKnown ? "見慣れた荷車の轍が残っている" : "荷車の轍が残っている";
    const copy = document.createElement("span");
    copy.textContent = trace.trackingKnown
      ? "追跡の経験がある。轍の崩れ方まで読めば、古い痕跡でも行き先を絞れそうだ。"
      : "詳しく見れば、新しい痕跡かどうか判断できそうだ。追う前に確かめる？";

    const investigate = document.createElement("button");
    investigate.type = "button";
    investigate.className = "world-atlas-npc-signal-match__open world-trace-investigation__inspect";
    investigate.textContent = trace.trackingKnown ? "《轍読み》で詳しく調べる" : "轍を詳しく調べる";

    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "world-atlas-npc-signal-match__open world-trace-investigation__leave";
    leave.textContent = "触らず立ち去る";

    investigate.addEventListener("click", () => {
      const result = applyTrackingKnowledge(
        traceFromSignalSource(marker.dataset && marker.dataset.atlasSignalSource, input),
        trackingKnowledgeKnown(root)
      );
      heading.textContent = result.trackingKnown ? `《轍読み》— 轍は「${result.freshnessLabel}」` : `轍は「${result.freshnessLabel}」`;
      copy.textContent = investigationCopy(result);
      investigate.hidden = true;
      leave.textContent = result.canFollow ? "今回は追わない" : "痕跡を記憶して立ち去る";
      if (setDispatchState(dispatch, result, true)) bindTrackingLesson(dispatch, root);
      panel.dataset.traceState = "investigated";
      panel.dataset.traceFreshness = result.freshness;
      panel.dataset.trackingKnown = String(Boolean(result.trackingKnown));
    });

    leave.addEventListener("click", () => {
      const result = applyTrackingKnowledge(
        traceFromSignalSource(marker.dataset && marker.dataset.atlasSignalSource, input),
        trackingKnowledgeKnown(root)
      );
      heading.textContent = "今回は追わない";
      copy.textContent = "痕跡には手を加えず、今の探索を優先することにした。";
      investigate.hidden = true;
      leave.hidden = true;
      setDispatchState(dispatch, result, true, true);
      panel.dataset.traceState = "left";
    });

    panel.append(heading, copy, investigate, leave);
    detail.appendChild(panel);
    return true;
  }

  function decorateActiveTrace(document, input = new Date(), root = null) {
    const marker = activeNpcMarker(document);
    const detail = activeDetail(document);
    return appendTracePanel(document, detail, marker, input, root);
  }

  function install(document, root) {
    if (!document || !root || root.__worldTracesInstalled) return false;
    const onClick = (event) => {
      const target = event && event.target && event.target.closest
        ? event.target.closest(".world-atlas-nearby-marker--npc-signal")
        : null;
      if (!target) return;
      Promise.resolve().then(() => decorateActiveTrace(document, new Date(), root));
    };
    if (typeof document.addEventListener === "function") document.addEventListener("click", onClick);
    root.__worldTracesInstalled = true;
    return true;
  }

  return Object.freeze({
    TRACE_ID,
    TRACKING_KNOWLEDGE_KEY,
    normalizedHour,
    freshnessForHour,
    traceFromSignalSource,
    applyTrackingKnowledge,
    trackingKnowledgeKnown,
    rememberTrackingKnowledge,
    investigationCopy,
    setDispatchState,
    bindTrackingLesson,
    appendTracePanel,
    decorateActiveTrace,
    install
  });
});
