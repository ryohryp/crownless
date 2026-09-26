(() => {
  "use strict";
  const Recap = window.CrownlessExpeditionRecap;
  if (!Recap) return;
  const root = document.querySelector("#game");
  if (!root) return;

  const MAP_CLUES = {
    "囁きの森": ["北東", "鐘のない高みへ続く、細い石段が描かれている。"],
    "鐘なき塔": ["南東", "水辺へ落ちる古道と、青い火の印が残っている。"],
    "星沈みの湿原": ["南西", "灰色の石室へ向かう道だけが、途中で破れている。"],
    "灰冠の廟": ["北西", "森の根元に戻る印。以前とは違う細道が書き足されている。"],
  };

  function text(selector, scope = root) {
    return (scope.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function mapFragment(place, died, scrap, gear) {
    const clue = MAP_CLUES[place];
    if (died || !clue || (scrap + gear.length * 5 + place.length) % 3 !== 0) return "";
    return `<section class="treasure-map-fragment reward" aria-label="次の探索につながる地図の断片"><span class="reward-icon">⌁</span><div><p class="kicker">FOUND CLUE · 次の未知</p><strong>煤けた地図の断片</strong><small>${clue[0]}へ伸びる線。${clue[1]}<br>何があるかは、まだ分からない。</small></div></section>`;
  }

  function render() {
    const panel = root.querySelector(".panel");
    const reportScroll = panel?.querySelector(".report-scroll");
    const kicker = text(".kicker", reportScroll || panel || root);
    if (!panel || (!kicker.startsWith("SAFE RETURN") && !kicker.startsWith("EXPEDITION LOST"))) return;
    if (panel.querySelector(".expedition-recap")) return;

    const place = kicker.split("/").slice(1).join("/").trim();
    const died = kicker.startsWith("EXPEDITION LOST");
    const result = text(".result-number");
    const scrapMatch = result.match(/([0-9]+)/);
    const scrap = scrapMatch ? Number(scrapMatch[1]) : 0;
    const gear = Array.from(panel.querySelectorAll(".reward strong")).map((node) => node.textContent.replace(/^失った：/, "").trim());
    const lines = Recap.recapFromReport({ place, died, scrap, gear });

    const section = document.createElement("section");
    section.className = "expedition-recap rule-line";
    section.setAttribute("aria-label", "今回の遠征記録");
    section.innerHTML = `<p class="kicker">EXPEDITION RECAP · 今回の物語</p>${lines.map((line) => `<p>${line}</p>`).join("")}`;
    const actions = panel.querySelector(".report-actions");
    const reportBody = reportScroll || panel;
    reportBody.insertBefore(section, actions && actions.parentNode === reportBody ? actions : null);
    const fragment = mapFragment(place, died, scrap, gear);
    if (fragment) section.insertAdjacentHTML("afterend", fragment);
  }

  const observer = new MutationObserver(render);
  observer.observe(root, { childList: true, subtree: true });
  render();
})();
