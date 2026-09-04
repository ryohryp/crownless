(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessWorldAtlasSignalRescanFeedback = api;
  if (root && root.document) api.install(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function createWorldAtlasSignalRescanFeedback() {
  "use strict";

  const LABEL = "現在地周辺を調べる";
  const PENDING_LABEL = "周辺を調査中…";
  const STATUS_CLASS = "world-atlas-npc-signal-rescan-status";

  function cleanText(value, fallback = "") {
    const text = String(value == null ? "" : value).trim();
    return text || fallback;
  }

  function isSignalRescanButton(target) {
    return Boolean(target && target.matches && target.matches("button.world-atlas-npc-signal-match__open") && cleanText(target.textContent) === LABEL);
  }

  function statusForButton(document, button) {
    const detail = button && button.closest ? button.closest(".world-atlas-detail") : null;
    if (!detail) return null;
    let status = detail.querySelector(`.${STATUS_CLASS}`);
    if (!status) {
      status = document.createElement("p");
      status.className = STATUS_CLASS;
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      button.insertAdjacentElement("afterend", status);
    }
    return status;
  }

  function resultMessage(Atlas, result) {
    if (Atlas && typeof Atlas.scanResultText === "function") return Atlas.scanResultText(result, false);
    if (result && result.state === "denied") return "位置情報を使えない。端末の許可を確認して、もう一度試して。";
    if (result && result.state === "unavailable") return "現在地の周辺調査を利用できない。少ししてからもう一度試して。";
    return "周辺情報を読み取れなかった。少ししてからもう一度試して。";
  }

  function restoreButton(button) {
    if (!button || !button.isConnected) return;
    button.disabled = false;
    button.dataset.signalRescanPending = "false";
    button.textContent = LABEL;
  }

  async function rescanFromSignalDetail(document, root, button) {
    if (!document || !root || !button || button.dataset.signalRescanPending === "true") return { state: "ignored" };
    const Atlas = root.CrownlessWorldAtlas;
    const Core = root.CrownlessCore;
    const status = statusForButton(document, button);
    if (!Atlas || !Core || typeof Atlas.scanNearby !== "function" || typeof Atlas.openAtlas !== "function") {
      if (status) status.textContent = "周辺調査を開始できない。地図を閉じて、もう一度開いて試して。";
      return { state: "unavailable" };
    }

    button.dataset.signalRescanPending = "true";
    button.disabled = true;
    button.textContent = PENDING_LABEL;
    if (status) status.textContent = typeof Atlas.scanResultText === "function"
      ? Atlas.scanResultText(null, true)
      : "現在地を読み取り、周辺を調べている…";

    try {
      const result = await Atlas.scanNearby(Core, root, { force: true });
      if (result && result.state === "ready") {
        Atlas.openAtlas(document, Core, root, { autoScan: false, scanResult: result, view: "nearby" });
        return result;
      }
      if (status) status.textContent = resultMessage(Atlas, result);
      restoreButton(button);
      return result || { state: "failed" };
    } catch (_) {
      if (status) status.textContent = "現在地を取得できなかった。位置情報の許可や通信状態を確認して、もう一度試して。";
      restoreButton(button);
      return { state: "failed" };
    }
  }

  function install(document, root) {
    if (!document || !root || root.__worldAtlasSignalRescanFeedbackInstalled) return false;
    document.addEventListener("click", (event) => {
      const button = event && event.target && event.target.closest ? event.target.closest("button.world-atlas-npc-signal-match__open") : null;
      if (!isSignalRescanButton(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void rescanFromSignalDetail(document, root, button);
    }, true);
    root.__worldAtlasSignalRescanFeedbackInstalled = true;
    return true;
  }

  return Object.freeze({
    LABEL,
    PENDING_LABEL,
    STATUS_CLASS,
    isSignalRescanButton,
    resultMessage,
    restoreButton,
    rescanFromSignalDetail,
    install
  });
});
