(() => {
  "use strict";
  const Rumor = window.CrownlessCampfireRumor;
  if (!Rumor) return;
  const root = document.querySelector("#game");
  if (!root) return;

  const text = (selector, scope = root) => (scope.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();

  function render() {
    const panel = root.querySelector(".panel");
    const kicker = text(".panel > .kicker");
    if (!panel || (!kicker.startsWith("SAFE RETURN") && !kicker.startsWith("EXPEDITION LOST"))) return;
    if (panel.querySelector(".campfire-rumor")) return;

    const place = kicker.split("/").slice(1).join("/").trim();
    const died = kicker.startsWith("EXPEDITION LOST");
    const gear = Array.from(panel.querySelectorAll(".reward strong")).map((node) => node.textContent.replace(/^失った：/, "").trim());
    const rumor = Rumor.rumorFromReport({ place, died, gear });
    if (!rumor) return;

    const section = document.createElement("section");
    section.className = "campfire-rumor rule-line";
    section.setAttribute("aria-label", "焚き火の噂");
    section.innerHTML = `<p class="kicker">CAMPFIRE RUMOR · 次の未知</p><p>${rumor.text}</p><p><small>手掛かり：${rumor.cue}</small></p>`;
    const actions = panel.querySelector(".button-stack");
    panel.insertBefore(section, actions || null);
  }

  const observer = new MutationObserver(render);
  observer.observe(root, { childList: true, subtree: true });
  render();
})();
