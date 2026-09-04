(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldTraces = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldTraces() {
  "use strict";

  const TRACE_ID = "world-trace:npc:marco:north-route";

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
      canFollow: identified && freshness !== "stale"
    });
  }

  function investigationCopy(trace) {
    if (!trace) return "調べられる痕跡はない。";
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
    if (followable) dispatch.textContent = "痕跡を追って遠征する";
    return followable;
  }

  function appendTracePanel(document, detail, marker, input = new Date()) {
    if (!document || !detail || !marker || !document.createElement) return false;
    if (detail.querySelector && detail.querySelector(".world-trace-investigation")) return false;
    const trace = traceFromSignalSource(marker.dataset && marker.dataset.atlasSignalSource, input);
    if (!trace) return false;

    const dispatch = existingDispatch(detail);
    setDispatchState(dispatch, trace, false);

    const panel = document.createElement("section");
    panel.className = "world-atlas-npc-signal-match world-trace-investigation";

    const heading = document.createElement("strong");
    heading.textContent = "荷車の轍が残っている";
    const copy = document.createElement("span");
    copy.textContent = "詳しく見れば、新しい痕跡かどうか判断できそうだ。追う前に確かめる？";

    const investigate = document.createElement("button");
    investigate.type = "button";
    investigate.className = "world-atlas-npc-signal-match__open world-trace-investigation__inspect";
    investigate.textContent = "轍を詳しく調べる";

    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "world-atlas-npc-signal-match__open world-trace-investigation__leave";
    leave.textContent = "触らず立ち去る";

    investigate.addEventListener("click", () => {
      const result = traceFromSignalSource(marker.dataset && marker.dataset.atlasSignalSource, input);
      heading.textContent = `轍は「${result.freshnessLabel}」`;
      copy.textContent = investigationCopy(result);
      investigate.hidden = true;
      leave.textContent = result.canFollow ? "今回は追わない" : "痕跡を記憶して立ち去る";
      setDispatchState(dispatch, result, true);
      panel.dataset.traceState = "investigated";
      panel.dataset.traceFreshness = result.freshness;
    });

    leave.addEventListener("click", () => {
      const result = traceFromSignalSource(marker.dataset && marker.dataset.atlasSignalSource, input);
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

  function decorateActiveTrace(document, input = new Date()) {
    const marker = activeNpcMarker(document);
    const detail = activeDetail(document);
    return appendTracePanel(document, detail, marker, input);
  }

  function install(document, root) {
    if (!document || !root || root.__worldTracesInstalled) return false;
    const onClick = (event) => {
      const target = event && event.target && event.target.closest
        ? event.target.closest(".world-atlas-nearby-marker--npc-signal")
        : null;
      if (!target) return;
      Promise.resolve().then(() => decorateActiveTrace(document));
    };
    if (typeof document.addEventListener === "function") document.addEventListener("click", onClick);
    root.__worldTracesInstalled = true;
    return true;
  }

  return Object.freeze({
    TRACE_ID,
    normalizedHour,
    freshnessForHour,
    traceFromSignalSource,
    investigationCopy,
    setDispatchState,
    appendTracePanel,
    decorateActiveTrace,
    install
  });
});
