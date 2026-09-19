(() => {
  "use strict";
  const Recap = window.CrownlessExpeditionRecap;
  if (!Recap) return;
  const root = document.querySelector("#game");
  if (!root) return;

  function text(selector, scope = root) {
    return (scope.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function render() {
    const panel = root.querySelector(".panel");
    const kicker = text(".panel > .kicker");
    if (!panel || (!kicker.startsWith("SAFE RETURN") && !kicker.startsWith("EXPEDITION LOST"))) return;
    if (panel.querySelector(".expedition-recap")) return;

    const place = kicker.split("/").slice(1).join("/").trim();
    const died = kicker.startsWith("EXPEDITION LOST");
    const result = text(".result-number");
    const scrapMatch = result.match(/([0-9]+)/);
    const gear = Array.from(panel.querySelectorAll(".reward strong")).map((node) => node.textContent.replace(/^失った：/, "").trim());
    const lines = Recap.recapFromReport({ place, died, scrap: scrapMatch ? Number(scrapMatch[1]) : 0, gear });

    const section = document.createElement("section");
    section.className = "expedition-recap rule-line";
    section.setAttribute("aria-label", "今回の遠征記録");
    section.innerHTML = `<p class="kicker">EXPEDITION RECAP · 今回の物語</p>${lines.map((line) => `<p>${line}</p>`).join("")}`;
    const actions = panel.querySelector(".button-stack");
    panel.insertBefore(section, actions || null);
  }

  const observer = new MutationObserver(render);
  observer.observe(root, { childList: true, subtree: true });
  render();
})();
