(() => {
  "use strict";

  const Core = window.CrownlessCore;
  if (!Core || Core.__noncombatPresentationInstalled) return;
  Core.__noncombatPresentationInstalled = true;

  let transition = { phase: null, kind: null, origin: null };

  const EVENT_LABELS = {
    cache: "探索イベント / 隠し荷",
    shrine: "探索イベント / 祠",
    traveler: "探索イベント / 人物",
    combat: "戦闘 / 敵影",
    ambush: "戦闘 / 待ち伏せ",
    hunt: "標的",
    dungeon: "ダンジョン / 入口",
    "dungeon-trap": "坑道 / 罠",
    "dungeon-combat": "坑道 / 戦闘",
    "dungeon-elite": "坑道 / エリート",
    "dungeon-boss": "坑道 / 最奥"
  };

  function discoveryKind(state) {
    return state && state.expedition && state.expedition.lastDiscovery
      ? state.expedition.lastDiscovery.eventKind
      : null;
  }

  function remember(state, origin) {
    transition = {
      phase: state ? state.phase : null,
      kind: discoveryKind(state),
      origin
    };
    queueMicrotask(syncPresentation);
    return state;
  }

  function ensureEventBadge() {
    const inner = document.querySelector("#loot-reveal .loot-reveal-inner");
    if (!inner) return null;
    let badge = inner.querySelector(".event-kind-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "event-kind-badge";
      inner.prepend(badge);
    }
    return badge;
  }

  function syncPresentation() {
    const combatScreen = document.getElementById("combat-screen");
    if (!combatScreen) return;

    const nonCombat = transition.phase && transition.phase !== "combat" && transition.origin !== "combat-result";
    combatScreen.classList.toggle("noncombat-mode", Boolean(nonCombat));

    const badge = ensureEventBadge();
    if (badge) {
      if (nonCombat) {
        badge.textContent = EVENT_LABELS[transition.kind] || "探索イベント / 戦闘なし";
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .event-kind-badge {
      width: fit-content;
      margin-bottom: 14px;
      padding: 7px 10px;
      border: 1px solid rgba(240,199,114,.25);
      background: rgba(240,199,114,.07);
      color: #d8bd83;
      font: 800 10px/1.2 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: .12em;
    }

    .combat-screen.noncombat-mode .touch-controls,
    .combat-screen.noncombat-mode .combat-help,
    .combat-screen.noncombat-mode .combat-bars {
      display: none !important;
    }

    .combat-screen:has(.loot-reveal.show) .touch-controls,
    .combat-screen:has(.loot-reveal.show) .combat-help {
      display: none !important;
    }

    @media (max-width: 700px) {
      .combat-screen.noncombat-mode .arena-wrap {
        min-height: 0;
      }

      .combat-screen.noncombat-mode .loot-reveal-inner {
        width: min(100% - 22px, 620px);
        max-height: calc(100dvh - 170px);
        overflow: auto;
      }
    }
  `;
  document.head.appendChild(style);

  const baseGenerate = Core.generateExplorationChoices;
  Core.generateExplorationChoices = function generateExplorationChoicesWithClearSignals(state) {
    return baseGenerate(state).map((choice) => {
      if (choice.eventKind === "hunt") return choice;
      const label = EVENT_LABELS[choice.eventKind];
      return label ? { ...choice, signal: label } : choice;
    });
  };

  const baseDiscover = Core.discoverLocation;
  Core.discoverLocation = function discoverLocationWithPresentation(state, choiceId) {
    const next = baseDiscover(state, choiceId);
    return remember(next, next.phase === "combat" ? "combat" : "exploration-event");
  };

  const baseResolveEventChoice = Core.resolveEventChoice;
  Core.resolveEventChoice = function resolveEventChoiceWithPresentation(state, optionId) {
    const next = baseResolveEventChoice(state, optionId);
    return remember(next, next.phase === "combat" ? "combat" : "exploration-event");
  };

  const baseResolveVictory = Core.resolveVictory;
  Core.resolveVictory = function resolveVictoryWithPresentation(state, remainingHealth) {
    return remember(baseResolveVictory(state, remainingHealth), "combat-result");
  };

  syncPresentation();
})();
