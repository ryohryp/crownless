(() => {
  "use strict";

  const desktopQuery = window.matchMedia("(min-width: 901px) and (pointer: fine)");
  const directionByCode = new Map([
    ["ArrowUp", { x: 0, y: -1 }],
    ["KeyW", { x: 0, y: -1 }],
    ["ArrowDown", { x: 0, y: 1 }],
    ["KeyS", { x: 0, y: 1 }],
    ["ArrowLeft", { x: -1, y: 0 }],
    ["KeyA", { x: -1, y: 0 }],
    ["ArrowRight", { x: 1, y: 0 }],
    ["KeyD", { x: 1, y: 0 }]
  ]);

  const style = document.createElement("style");
  style.id = "desktop-input-styles";
  style.textContent = `
    .desktop-key-hint { display:none; }

    @media (min-width:901px) and (pointer:fine) {
      .desktop-key-hint {
        position:fixed;
        z-index:80;
        right:18px;
        bottom:14px;
        display:flex;
        align-items:center;
        gap:9px;
        padding:7px 10px;
        border:1px solid rgba(232,214,181,.12);
        background:rgba(8,8,7,.82);
        color:rgba(218,205,181,.56);
        font-size:9px;
        letter-spacing:.05em;
        pointer-events:none;
        backdrop-filter:blur(8px);
        transition:opacity .15s ease;
      }

      body[data-pc-input="keyboard"] .desktop-key-hint {
        color:rgba(235,220,194,.82);
        border-color:rgba(240,199,114,.2);
      }

      .desktop-key-hint kbd {
        padding:2px 5px;
        border:1px solid rgba(232,214,181,.16);
        background:rgba(255,255,255,.025);
        color:var(--paper);
        font-size:8px;
      }

      body:has(#combat-screen.active) .desktop-key-hint { display:none; }
      body:has(#combat-screen.active .loot-reveal.show) .desktop-key-hint { display:flex; }

      body[data-pc-input="keyboard"] button:focus,
      body[data-pc-input="keyboard"] a:focus {
        outline:2px solid var(--gold-2);
        outline-offset:3px;
      }

      body[data-pc-input="keyboard"] .exploration-map-cell:focus {
        outline:none;
        box-shadow:inset 0 0 0 2px var(--gold-2), 0 0 24px rgba(240,199,114,.22);
        z-index:4;
      }
    }
  `;
  document.head.appendChild(style);

  const hint = document.createElement("div");
  hint.className = "desktop-key-hint";
  hint.setAttribute("aria-hidden", "true");
  hint.innerHTML = '<kbd>WASD</kbd><span>/</span><kbd>矢印</kbd><span>選択</span><kbd>ENTER</kbd><span>決定</span>';
  document.body.appendChild(hint);

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function activeScreen() {
    return document.querySelector(".screen.active");
  }

  function activeOverlay() {
    const overlay = document.querySelector(".loot-reveal.show");
    return isVisible(overlay) ? overlay : null;
  }

  function navigationRoot() {
    return activeOverlay() || activeScreen();
  }

  function actionables(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'))
      .filter(isVisible);
  }

  function preferredAction(root) {
    const overlay = activeOverlay();
    if (overlay) {
      const option = Array.from(overlay.querySelectorAll("#loot-reveal-items button:not(:disabled)")).find(isVisible);
      if (option) return option;
      const next = overlay.querySelector("#loot-reveal-continue");
      if (isVisible(next)) return next;
      return actionables(overlay)[0] || null;
    }

    const screen = activeScreen();
    if (!screen) return null;

    if (screen.id === "hub-screen") {
      const start = document.getElementById("start-expedition");
      if (isVisible(start)) return start;
    }

    if (screen.id === "explore-screen") {
      const detailAction = [
        document.getElementById("map-investigate"),
        document.getElementById("map-travel")
      ].find(isVisible);
      if (detailAction) return detailAction;

      const current = screen.querySelector("button.exploration-map-cell.current");
      if (isVisible(current)) return current;
      const frontier = screen.querySelector("button.exploration-map-cell.frontier");
      if (isVisible(frontier)) return frontier;
    }

    if (screen.id === "decision-screen") {
      const continueButton = document.getElementById("continue-expedition");
      if (isVisible(continueButton)) return continueButton;
    }

    if (screen.id === "return-screen") {
      const again = document.getElementById("return-again");
      if (isVisible(again)) return again;
    }

    return actionables(root)[0] || null;
  }

  function center(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function directionalTarget(base, candidates, direction) {
    const origin = center(base);
    let best = null;
    let bestScore = Infinity;

    candidates.forEach((candidate) => {
      if (candidate === base) return;
      const target = center(candidate);
      const vx = target.x - origin.x;
      const vy = target.y - origin.y;
      const along = vx * direction.x + vy * direction.y;
      if (along <= 3) return;

      const distance = Math.hypot(vx, vy);
      if (!distance) return;
      const alignment = along / distance;
      if (alignment < 0.28) return;

      const perpendicular = Math.abs(vx * direction.y - vy * direction.x);
      const score = along + perpendicular * 2.4 + distance * (1 - alignment) * 0.5;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    });

    return best;
  }

  function focusAction(element) {
    if (!element) return;
    document.body.dataset.pcInput = "keyboard";
    try { element.focus({ preventScroll: true }); }
    catch (_) { element.focus(); }
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function moveSelection(direction) {
    const root = navigationRoot();
    const candidates = actionables(root);
    if (!candidates.length) return;

    const current = candidates.includes(document.activeElement) ? document.activeElement : preferredAction(root);
    if (!current) return;

    const target = directionalTarget(current, candidates, direction);
    focusAction(target || current);
  }

  function activateSelection() {
    const root = navigationRoot();
    const candidates = actionables(root);
    if (!candidates.length) return false;

    const focused = candidates.includes(document.activeElement) ? document.activeElement : null;
    const target = focused || preferredAction(root);
    if (!target) return false;

    document.body.dataset.pcInput = "keyboard";
    target.click();
    return true;
  }

  window.addEventListener("keydown", (event) => {
    if (!desktopQuery.matches || event.altKey || event.ctrlKey || event.metaKey) return;
    // Atlas owns native controls and modal focus; hub shortcuts must not steal
    // arrows / Enter from its map, place picker or action sheets.
    if (document.getElementById("world-atlas-viewer")) return;

    const overlay = activeOverlay();
    const screen = activeScreen();
    const liveCombat = screen && screen.id === "combat-screen" && !overlay;
    if (liveCombat) return;

    const direction = directionByCode.get(event.code);
    if (direction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      moveSelection(direction);
      return;
    }

    if (event.code === "Enter" && !event.repeat) {
      if (!activateSelection()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener("pointerdown", () => {
    if (desktopQuery.matches) document.body.dataset.pcInput = "pointer";
  }, true);
})();
