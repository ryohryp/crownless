(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessHiddenShortcut = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHiddenShortcut() {
  "use strict";

  const SHORTCUT_ID = "ash-eater-mine-service-cut";

  function ensureState(state) {
    if (!state.hiddenShortcuts) state.hiddenShortcuts = {};
    if (!state.hiddenShortcuts[SHORTCUT_ID]) {
      state.hiddenShortcuts[SHORTCUT_ID] = { discovered: false, uses: 0 };
    }
    return state.hiddenShortcuts[SHORTCUT_ID];
  }

  function discover(state) {
    if (!state) return state;
    ensureState(state).discovered = true;
    return state;
  }

  function choices(state) {
    const entry = state && state.hiddenShortcuts && state.hiddenShortcuts[SHORTCUT_ID];
    if (!entry || !entry.discovered) return [];
    return [
      {
        id: "normal",
        title: "通常ルート",
        detail: "浅層を進む。時間はかかるが、戦利品を拾う機会を残す。",
        skipRooms: 0,
        lootOpportunity: true,
      },
      {
        id: "shortcut",
        title: "見つけた近道",
        detail: "浅層1区画を飛ばす。早いが、その区画の戦利品は諦める。",
        skipRooms: 1,
        lootOpportunity: false,
      },
    ];
  }

  function choose(state, choiceId) {
    if (!state) return null;
    const available = choices(state);
    const choice = available.find((candidate) => candidate.id === choiceId);
    if (!choice) return null;
    if (choice.id === "shortcut") ensureState(state).uses += 1;
    return { ...choice };
  }

  function applyToExpedition(state, choiceId) {
    if (!state || !state.expedition || state.expedition.stage !== "path" || state.expedition.room !== 0) return null;
    const choice = choose(state, choiceId);
    if (!choice) return null;
    if (choice.skipRooms) {
      state.expedition.room = Math.min(4, state.expedition.room + choice.skipRooms);
      state.expedition.log = ["見つけた近道を抜けた。浅層の戦利品は霧の向こうへ置いてきた。"]; 
    }
    return choice;
  }

  return { SHORTCUT_ID, ensureState, discover, choices, choose, applyToExpedition };
});
