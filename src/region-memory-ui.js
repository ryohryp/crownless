(() => {
  "use strict";
  const Memory = window.CrownlessRegionMemory;
  const Unknown = window.CrownlessUnknownQuarter;
  if (!Memory || !Unknown) return;

  function context() {
    try {
      const mode = localStorage.getItem("crownless-expedition-mode");
      const anchor = JSON.parse(localStorage.getItem("crownless-expedition-v1-walk-anchor") || "null");
      return { mode, region: mode === "walk" ? Unknown.regionKey(anchor) : null };
    } catch { return { mode: null, region: null }; }
  }

  function load() {
    try { return Memory.normalizeMemory(JSON.parse(localStorage.getItem(Memory.STORAGE_KEY) || "[]")); }
    catch { return []; }
  }

  function save(memory) {
    try { localStorage.setItem(Memory.STORAGE_KEY, JSON.stringify(memory)); } catch { /* Optional memory must never block play. */ }
  }

  function currentReport() {
    const { mode } = context();
    if (mode !== "walk") return null;
    try {
      const state = JSON.parse(localStorage.getItem(`crownless-expedition-v1-${mode}`) || "null");
      return state && state.report ? state.report : null;
    } catch { return null; }
  }

  function rememberReturn() {
    const { region } = context();
    const report = currentReport();
    if (!region || !report) return;
    save(Memory.remember(load(), region, report));
  }

  function decorate() {
    const { region } = context();
    if (!region) return;
    const summary = Memory.summary(load(), region);
    const card = document.querySelector(".atlas-memory");
    if (!summary || !card || card.classList.contains("unknown")) return;
    const label = card.querySelector("span");
    const text = card.querySelector("small");
    if (label) label.textContent = summary.title;
    if (text) text.textContent = summary.text;
  }

  document.addEventListener("click", event => {
    if (event.target.closest('[data-action="continue"]')) rememberReturn();
    requestAnimationFrame(decorate);
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  const game = document.querySelector("#game");
  if (game) observer.observe(game, { childList: true, subtree: true });
  requestAnimationFrame(decorate);
})();
