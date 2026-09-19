(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CrownlessCampfireRumor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCampfireRumor() {
  "use strict";

  const RUMORS = Object.freeze([
    Object.freeze({ match: /森|wood/i, text: "森を抜けた旅人が、霧の向こうで鐘ではない金属音を聞いたという。" }),
    Object.freeze({ match: /塔|tower/i, text: "塔から戻った者の外套に、湿地のものらしい黒い葦が絡んでいた。" }),
    Object.freeze({ match: /湿|沼|fen/i, text: "水辺の泥に、古い石段へ続く乾いた足跡が残っていたらしい。" }),
    Object.freeze({ match: /廟|墓|crypt/i, text: "廟の石粉を見た鍛冶師が、もっと古い武具が深部に眠ると呟いた。" })
  ]);

  function rumorFromReport(report) {
    const place = String(report && report.place || "").trim();
    const died = Boolean(report && report.died);
    const gear = Array.isArray(report && report.gear) ? report.gear.filter(Boolean) : [];
    if (!place) return null;
    if (died) return { text: `${place}から逃げ帰った旅人がいる。失った荷の近くで、まだ火が揺れていたという。`, cue: "次は備えを整えて確かめる" };
    if (gear.length) return { text: `${gear[0]}を見た旅商人が、${place}のさらに奥にも同じ意匠の武具があると話した。`, cue: "同じ土地の深部を探す" };
    const matched = RUMORS.find((item) => item.match.test(place));
    return { text: matched ? matched.text : `${place}の帰還話を聞いた旅人が、別の道にも似た痕跡があると教えてくれた。`, cue: "次の未知を探す" };
  }

  return Object.freeze({ rumorFromReport });
});
